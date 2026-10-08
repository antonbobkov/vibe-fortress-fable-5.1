/**
 * The simulation host and the frame loop.
 *
 * Implements `01-architecture/simulation-core.md` § The simulation host (`InProcessHost`) and
 * § The frame loop, verbatim: the accumulator, the 250 ms cap, `MAX_TICKS_PER_FRAME`, "fell
 * behind: run slower, never skip", and the hidden-tab pause of `tech-stack.md` § Frame and
 * simulation loop ("When the tab is hidden, the simulation pauses. On return it does not catch
 * up.").
 *
 * `save` and `load` write and read the container of `save-format.md` through `game-save.ts`
 * (T-M2-11).
 */

import { HeadlessGame, type HeadlessEmbark, type HeadlessOptions } from '@app/headless';
import { MAX_TICKS_PER_FRAME, SIM_TICKS_PER_SECOND } from '@core/constants';
import { C } from '@core/components';
import { LOAD_SHEDDING_RATE_SAMPLE_MS } from '@core/performance-constants';
import { AnimalsSystem } from '@systems/animals';
import { LoadShedding, type SheddingRule } from './load-shedding';
import { loadGame, saveGame, type LoadedGame, type SaveOptions } from '@app/game-save';
import type { Command } from '@core/commands';
import type { GameEvent } from '@core/events';
import type { ReaderSet } from '@core/readers';
import type { HostStats, World } from '@core/world';
import type { LocalMapSpec } from '@systems/embark';
import type { WorldMap } from '@systems/worldgen';

/** `simulation-core.md` § The simulation host: 0 is paused. */
export type Speed = 0 | 1 | 2 | 4;

export type Unsubscribe = () => void;

/**
 * `NewGameSpec`: the world seed and what to build. `'flat-test'` is the fixture map; `'local'`
 * generates the local map of `spec` (03) and runs 02's arrival with `embark` (T-M1-12, T-M1-13).
 */
export interface NewGameSpec {
  readonly seed: string;
  readonly world?: 'flat-test' | 'local';
  readonly fortressName?: string;
  /** The region's `LocalMapSpec` (`world: 'local'`). */
  readonly spec?: LocalMapSpec;
  /** The party: `'none'`, a preset, or the embark screen's session. */
  readonly embark?: HeadlessEmbark;
  /** The generated world the region belongs to; kept for the world-level readers. */
  readonly worldMap?: WorldMap;
}

export interface SimulationHost {
  /** Actual progress includes explicit host.step calls as well as frame-driven ticks. */
  readonly tick?: number;
  readonly rateEpoch?: number;
  observeTickRate?(nowMs: number, actualRate: number, requestedRate: number): void;
  interruptTickRate?(): void;
  newGame(spec: NewGameSpec): Promise<void>;
  setSpeed(speed: Speed): void;
  speed(): Speed;
  submit(command: Command): void;
  step(ticks: number): void;
  readonly readers: ReaderSet;
  onEvents(listener: (events: readonly GameEvent[]) => void): Unsubscribe;
  stats(): HostStats;
}

/**
 * The in-process host of version 1: `readers` are the world's own readers and `step` runs the
 * world synchronously. A `WorkerHost` would implement the same interface behind a snapshot
 * protocol; nothing in presentation would change.
 */
export class InProcessHost implements SimulationHost {
  /** Platform clock injection keeps core and systems independent of wall time. */
  constructor(private readonly now: () => number = () => performance.now()) {}
  private game: HeadlessGame | null = null;
  private current: Speed = 0;
  private readonly shedding = new LoadShedding((rule, enabled) => this.applyShedding(rule, enabled));
  private epoch = 0;

  get tick(): number { return this.game?.tick ?? 0; }
  get rateEpoch(): number { return this.epoch; }
  get loadSheddingActive(): boolean { return this.shedding.active; }
  observeTickRate(nowMs: number, actualRate: number, requestedRate: number): void {
    this.shedding.observe(nowMs, actualRate, requestedRate);
  }
  interruptTickRate(): void { this.shedding.interrupt(); }

  private applyShedding(rule: SheddingRule, enabled: boolean): void {
    if (rule === 2) this.game?.pathing.pathfinder.setLoadShedding(enabled);
    if (rule === 3) {
      const animals = this.game?.world.scheduler.byId('08');
      if (animals instanceof AnimalsSystem) animals.setLoadShedding(enabled);
    }
  }

  private configureShedding(): void {
    const game = this.require();
    const dwarf = game.registry.table('creatures').index('dwarf');
    game.pathing.pathfinder.setLoadShedding(false, (id) => {
      const creature = game.world.entities.get(id, C.Creature);
      return creature !== undefined && creature.species !== dwarf;
    });
    this.epoch += 1;
  }
  /** Final saves are inspectable but cannot accept commands or advance. */
  private finalView = false;
  /**
   * Commands accepted since the running game was created or loaded. Not saved: the app compares it
   * with its value at the last save to find changes made while paused (24 § Game menu).
   */
  commandCount = 0;
  /** The generated world of the running game, or `null` for the fixture map. */
  worldMap: WorldMap | null = null;

  /** The world, once `newGame` has built one. */
  get world(): World {
    return this.require().world;
  }

  get headless(): HeadlessGame {
    return this.require();
  }

  get started(): boolean {
    return this.game !== null;
  }

  /**
   * `simulation-core.md` § Startup sequence steps 3 and 4. The `flat-test` world is built through
   * `app/headless.ts`, which already wires the pathing stack, the spatial index and the
   * connectivity pass; the generated world arrives with T-M1-05.
   */
  async newGame(spec: NewGameSpec): Promise<void> {
    const options: HeadlessOptions = {
      seed: spec.seed,
      now: this.now,
      world: spec.world ?? 'flat-test',
      ...(spec.fortressName === undefined ? {} : { fortressName: spec.fortressName }),
      ...(spec.spec === undefined ? {} : { spec: spec.spec }),
      ...(spec.embark === undefined ? {} : { embark: spec.embark }),
    };
    this.shedding.reset();
    this.game = new HeadlessGame(options);
    this.commandCount = 0;
    this.configureShedding();
    this.finalView = false;
    this.worldMap = spec.worldMap ?? null;
    // Step 5: "begins the frame loop paused".
    this.current = 0;
    return Promise.resolve();
  }

  /**
   * `save-format.md` § Load procedure: the loaded game replaces the running one and starts paused
   * (step 6). The caller restores the `ui` section it returns.
   */
  async load(blob: Uint8Array): Promise<LoadedGame> {
    const loaded = await loadGame(blob, { now: this.now });
    this.shedding.reset();
    this.game = loaded.game;
    this.commandCount = 0;
    this.configureShedding();
    this.finalView = loaded.header.kind === 'final';
    this.worldMap = loaded.worldMap;
    this.current = 0;
    return loaded;
  }

  /**
   * `persistence.md` § Autosave and snapshots: "Saving runs synchronously on the simulation (the
   * world is paused for the duration of `serialize`) and asynchronously for compression and
   * storage". Every section is taken before the first `await`.
   */
  save(options: Omit<SaveOptions, 'worldMap'>): Promise<Uint8Array> {
    return saveGame(this.require(), { ...options, worldMap: this.worldMap });
  }

  /** Called after every tick `step` runs; the app takes its autosave there, between ticks. */
  afterTick: (() => void) | null = null;

  get viewOnly(): boolean { return this.finalView; }
  setViewOnly(value: boolean): void { this.finalView = value; if (value) this.setSpeed(0); }

  setSpeed(speed: Speed): void {
    if (this.finalView && speed !== 0) return;
    if (speed !== this.current) { this.epoch += 1; this.interruptTickRate(); }
    this.current = speed;
  }

  speed(): Speed {
    return this.current;
  }

  submit(command: Command): boolean {
    if (this.finalView) return false;
    const world = this.require().world;
    world.submit(command);
    this.commandCount += 1;
    // A presentation listener may submit, but its batch must finish before another command
    // mutates the world. Those submissions remain queued for the next command phase.
    if (this.current === 0 && !world.events.isSealed) world.commandPhase(true);
    return true;
  }

  step(ticks: number): void {
    if (ticks <= 0 || this.finalView) return;
    const game = this.require();
    for (let k = 0; k < ticks; k += 1) {
      game.step(1);
      this.afterTick?.();
    }
  }

  get readers(): ReaderSet {
    return this.require().world.readers;
  }

  onEvents(listener: (events: readonly GameEvent[]) => void): Unsubscribe {
    return this.require().world.onEvents(listener);
  }

  stats(): HostStats {
    return this.require().world.stats();
  }

  private require(): HeadlessGame {
    if (this.game === null) throw new Error('host: no game; call newGame() first');
    return this.game;
  }
}

export interface FrameDriverOptions {
  readonly host: SimulationHost;
  readonly render: () => void;
}

/**
 * `simulation-core.md` § The frame loop, as written:
 *
 * ```
 * onFrame(nowMs):
 *   if document.hidden: accumulatorMs = 0; render(); return
 *   if speed == 0: accumulatorMs = 0; render(); return
 *   tickIntervalMs = 1000 / (SIM_TICKS_PER_SECOND × speed)
 *   accumulatorMs += min(nowMs − lastFrameMs, 250)
 *   while accumulatorMs ≥ tickIntervalMs and ticksThisFrame < MAX_TICKS_PER_FRAME: host.step(1) …
 *   if ticksThisFrame == MAX_TICKS_PER_FRAME: accumulatorMs = 0
 *   render(); lastFrameMs = nowMs
 * ```
 */
export class FrameDriver {
  /** The cap on the time a single frame may contribute; a long stall does not burst. */
  static readonly MAX_FRAME_MS = 250;

  private readonly host: SimulationHost;
  private readonly render: () => void;
  private accumulatorMs = 0;
  private lastFrameMs = 0;
  private ticks = 0;
  private completedTicks = 0;
  private rateStartMs: number | null = null;
  private rateStartTick = 0;
  private rateSpeed: Speed = 0;
  private rateEpoch = 0;

  private resetRate(nowMs: number): void {
    this.host.interruptTickRate?.();
    this.rateStartMs = nowMs;
    this.rateStartTick = this.host.tick ?? this.completedTicks;
    this.rateSpeed = this.host.speed();
    this.rateEpoch = this.host.rateEpoch ?? 0;
  }

  private sampleRate(nowMs: number, speed: Speed): void {
    const start = this.rateStartMs;
    if (start === null || nowMs - start < LOAD_SHEDDING_RATE_SAMPLE_MS) return;
    const tick = this.host.tick ?? this.completedTicks;
    const actual = (tick - this.rateStartTick) * 1000 / (nowMs - start);
    const requested = SIM_TICKS_PER_SECOND * speed;
    // One completed wall-time window is evidence over its whole interval (D-210).
    this.host.observeTickRate?.(start, actual, requested);
    this.host.observeTickRate?.(nowMs, actual, requested);
    this.rateStartMs = nowMs;
    this.rateStartTick = tick;
  }

  constructor(options: FrameDriverOptions) {
    this.host = options.host;
    this.render = options.render;
  }

  /** Ticks simulated in the last frame; the status bar reads the rate from it. */
  get lastFrameTicks(): number {
    return this.ticks;
  }

  get accumulator(): number {
    return this.accumulatorMs;
  }

  onFrame(nowMs: number, hidden: boolean): void {
    this.ticks = 0;
    const speed = this.host.speed();
    if (hidden || speed === 0) {
      this.resetRate(nowMs);
      this.accumulatorMs = 0;
      // The pseudo-code returns without moving `lastFrameMs`, which would let the first frame
      // after a pause add up to the 250 ms cap; "On return it does not catch up" is the rule.
      // See docs/01-architecture/simulation-core.md § Commands.
      this.lastFrameMs = nowMs;
      this.render();
      return;
    }
    if (this.rateStartMs === null || speed !== this.rateSpeed || (this.host.rateEpoch ?? 0) !== this.rateEpoch) this.resetRate(nowMs);
    const tickIntervalMs = 1000 / (SIM_TICKS_PER_SECOND * speed);
    this.accumulatorMs += Math.min(nowMs - this.lastFrameMs, FrameDriver.MAX_FRAME_MS);
    while (this.accumulatorMs >= tickIntervalMs && this.ticks < MAX_TICKS_PER_FRAME) {
      this.host.step(1);
      this.accumulatorMs -= tickIntervalMs;
      this.ticks += 1;
      this.completedTicks += 1;
    }
    if (this.ticks === MAX_TICKS_PER_FRAME) this.accumulatorMs = 0;
    if (this.host.speed() === speed && (this.host.rateEpoch ?? 0) === this.rateEpoch) this.sampleRate(nowMs, speed);
    else this.resetRate(nowMs);
    this.render();
    this.lastFrameMs = nowMs;
  }

  /** The frame clock starts where the first frame does, so the first frame simulates nothing. */
  reset(nowMs: number): void {
    this.accumulatorMs = 0;
    this.lastFrameMs = nowMs;
    this.ticks = 0;
    this.resetRate(nowMs);
  }
}
