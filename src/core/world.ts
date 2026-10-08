/**
 * The world and the tick.
 *
 * Implements `01-architecture/simulation-core.md` § The tick and `04-implementation/tick-order.md`:
 * commands, systems in order, the connectivity rebuild, event dispatch, then `calendar.advance()`.
 */

import { Calendar } from './calendar';
import { CommandLog, CommandQueue, ownerOf, reject, type Command, type CommandResult } from './commands';
import { EventListeners, EventQueue, type EventListener, type GameEvent, type Unsubscribe } from './events';
import { Map3D, type Designation, type TileFlag, type TileKind } from './map3d';
import { POPULATION_CAP_DEFAULT } from './constants';
import { ReaderSet } from './readers';
import { Registrations, NO_JOBS_API, NO_SPAWN_API, type Clock, type CoreServices, type GameSystem, type InitContext, type SystemId, type TerrainApi, type TickContext } from './system';
import { RngStream, seedFor } from './rng';
import { Scheduler, TimingWindow, isDue, type SystemTiming } from './scheduler';
import { createEntityStore, type FortressState } from './components';
import type { EntityStore } from './entities';
import type { Registry } from './registry';
import type { Tick, TileIndex } from './types';

export interface WorldOptions {
  readonly seed: string;
  readonly registry: Registry;
  readonly map?: Map3D;
  readonly startTick?: Tick;
  readonly fortressName?: string;
  /** From the platform; `core` never reads a wall clock itself. */
  readonly now?: Clock;
}

export interface HostStats {
  tick: number;
  lastTickMs: number;
  systems: readonly SystemTiming[];
  movingAverageTickMs?: number;
  rollingWorstTickMs?: number;
}

export function defaultFortressState(name = 'Deepholm'): FortressState {
  return {
    name,
    embarkTick: 0,
    regionId: 0,
    wealthCached: 0,
    populationCached: 0,
    hallSpiritCached: 0,
    alert: 'calm',
    deepPressure: 0,
    deepLevel: 0,
    reputation: { mountainhome: 0, hillfolk: 0, wildwood: 0, gloam: 0 },
    populationCap: POPULATION_CAP_DEFAULT,
    milestones: [],
    hintsShown: [],
    deepsilverConfirmed: false,
  };
}

/**
 * The sanctioned tile mutation path of `data-model.md` § Terrain API. In M0 the core owns it;
 * 03 terrain takes it over in M1 and batches the `TilesChanged` events it accumulates here.
 */
class CoreTerrainApi implements TerrainApi {
  private readonly changed: TileIndex[] = [];

  constructor(private readonly map: Map3D) {}

  setKind(i: TileIndex, kind: TileKind, material: number): void {
    if (!this.map.validIndex(i)) throw new RangeError(`tile index out of range: ${i}`);
    this.map.setKind(i, kind, material);
    this.changed.push(i);
  }

  setFlag(i: TileIndex, flag: TileFlag, value: boolean): void {
    if (!this.map.validIndex(i)) throw new RangeError(`tile index out of range: ${i}`);
    this.map.setFlag(i, flag, value);
    this.changed.push(i);
  }

  setDesignation(i: TileIndex, kind: Designation, priority: number): void {
    if (!this.map.validIndex(i)) throw new RangeError(`tile index out of range: ${i}`);
    this.map.setDesignation(i, kind, priority);
    this.changed.push(i);
  }

  /** One batched `TilesChanged` per tick, per `simulation-core.md` § Events. */
  flush(emit: (event: GameEvent) => void): void {
    if (this.changed.length === 0) return;
    const tiles = Array.from(new Set(this.changed)).sort((a, b) => a - b);
    this.changed.length = 0;
    emit({ type: 'TilesChanged', tiles });
  }
}

export class World {
  readonly seed: string;
  readonly registry: Registry;
  readonly map: Map3D;
  readonly entities: EntityStore;
  readonly calendar: Calendar;
  readonly fortress: FortressState;
  readonly events = new EventQueue();
  readonly commands = new CommandQueue();
  readonly commandLog = new CommandLog();
  readonly listeners = new EventListeners();
  readonly readers: ReaderSet;
  readonly registrations = new Registrations();
  readonly scheduler: Scheduler;

  private readonly rngStreams = new Map<SystemId, RngStream>();
  /**
   * The mutation services every tick context carries. 03 installs its terrain API, 11 its jobs
   * API and the host the spawn API and the movement helper; until then the M0 implementations
   * stand (D-017, D-049).
   */
  readonly services: CoreServices;
  private readonly now: Clock;
  private initialised = false;
  private lastTickMs = 0;
  private readonly tickTimings = new TimingWindow();

  /** Called between step 2 and step 3; 22 installs the connectivity rebuild here (T-M0-09). */
  connectivityPass: (() => void) | null = null;

  constructor(options: WorldOptions) {
    this.seed = options.seed;
    this.registry = options.registry;
    this.map = options.map ?? new Map3D();
    this.entities = createEntityStore();
    this.calendar = new Calendar(options.startTick ?? 0);
    this.fortress = defaultFortressState(options.fortressName);
    this.now = options.now ?? ((): number => 0);
    this.scheduler = new Scheduler(this.now);
    this.readers = new ReaderSet(this.map, this.entities, this.calendar, this.fortress);
    this.services = { terrain: new CoreTerrainApi(this.map), jobs: NO_JOBS_API, spawn: NO_SPAWN_API, movement: null, items: null, spatial: null, combat: null };
    // `data-model.md` § Store API: destroy has no core event; owning systems emit
    // `ItemDestroyed` / `CreatureDied` as listed in `04-implementation/event-catalog.md`.
  }

  /** `simulation-core.md` § Random numbers: one persistent stream per system. */
  rngFor(systemId: SystemId): RngStream {
    const existing = this.rngStreams.get(systemId);
    if (existing !== undefined) return existing;
    const stream = new RngStream(seedFor(this.seed, systemId));
    this.rngStreams.set(systemId, stream);
    return stream;
  }

  /** The saved state of every stream, in id order. */
  rngState(): { id: SystemId; state: ReturnType<RngStream['state']> }[] {
    return Array.from(this.rngStreams.keys())
      .sort()
      .map((id) => ({ id, state: (this.rngStreams.get(id) as RngStream).state() }));
  }

  /**
   * `save-format.md` § Load procedure step 4: "for each system in order call `deserialize(state)`".
   * Every stream is restored first, so a system that reads its stream in `deserialize` sees the
   * saved state. Systems without a saved entry keep their initial state.
   */
  deserializeSystems(states: Readonly<Record<SystemId, { stateVersion: number; state: unknown }>>): void {
    for (const system of this.scheduler.inOrder()) {
      const entry = states[system.id];
      if (entry === undefined) continue;
      system.deserialize(entry.state, this.initContext(system));
    }
  }

  /** Restore a saved stream (`rng` section), creating it when this run has not used it yet. */
  restoreRng(systemId: SystemId, state: ReturnType<RngStream['state']>): void {
    this.rngFor(systemId).setState(state);
  }

  addSystem(system: GameSystem): void {
    if (this.initialised) throw new Error('systems must be added before init()');
    this.scheduler.add(system);
  }

  /** `simulation-core.md` § Startup sequence step 3. */
  init(options: { loading?: boolean } = {}): void {
    if (this.initialised) return;
    for (const system of this.scheduler.inOrder()) {
      system.init({ ...this.initContext(system), loading: options.loading === true });
      this.readers.register(system.id, system.reader());
    }
    this.initialised = true;
  }

  private initContext(system: GameSystem): InitContext {
    return {
      world: this,
      registry: this.registry,
      rng: this.rngFor(system.id),
      readers: this.readers,
      register: this.registrations,
    };
  }

  private tickContext(system: GameSystem): TickContext {
    return {
      ...this.initContext(system),
      tick: this.calendar.tick,
      emit: (event: GameEvent) => this.events.emit(event),
      terrain: this.services.terrain,
      jobs: this.services.jobs,
      spawn: this.services.spawn,
    };
  }

  /** Queue an event for this tick's dispatch (or the next, while a batch is being dispatched). */
  emit(event: GameEvent): void {
    this.events.emit(event);
  }

  /** Queue a command; it is applied at the start of the next tick. */
  submit(command: Command): void {
    this.commands.submit(command);
  }

  onEvents(listener: EventListener): Unsubscribe {
    return this.listeners.add(listener);
  }

  /** The next tick's command phase, without systems, connectivity or calendar advancement. */
  commandPhase(immediateRejections = false): void {
    const rejections: GameEvent[] = [];
    for (const command of this.commands.drain()) {
      const result = this.applyCommand(command);
      this.commandLog.append(this.calendar.tick, command, result);
      if (!result.ok) {
        const event: GameEvent = { type: 'CommandRejected', command, reason: result.reason };
        if (immediateRejections) rejections.push(event);
        else this.events.emit(event);
      }
    }
    // Rejections have no simulation subscribers. Other command events keep their normal dispatch
    // boundary so paused commands and replayed commands cause identical system reactions.
    if (immediateRejections && rejections.length > 0) {
      this.events.seal();
      try {
        this.listeners.deliver(rejections);
      } finally {
        this.events.unseal();
      }
    }
  }

  /** The whole simulation tick, exactly as `tick-order.md` sequences it. */
  step(): void {
    const started = this.now();
    const tick = this.calendar.tick;
    const contexts = new Map<SystemId, TickContext>();
    const context = (system: GameSystem): TickContext => {
      let ctx = contexts.get(system.id);
      if (ctx === undefined) { ctx = this.tickContext(system); contexts.set(system.id, ctx); }
      return ctx;
    };

    // 1. Commands, FIFO, before any system ticks.
    this.commandPhase();

    // 2. Systems, in the fixed order, when their cadence and phase are due.
    for (const system of this.scheduler.inOrder()) {
      if (!isDue(tick, system.cadence, system.phase)) continue;
      const ctx = context(system);
      this.scheduler.runTick(system, () => system.tick(ctx));
    }
    this.services.terrain.flush?.((event) => this.events.emit(event));

    // 3. Connectivity rebuild for dirty chunks (22).
    this.connectivityPass?.();

    // 4. Events: the batch queued in steps 1-3, delivered to subscribers in system order and then
    //    to the presentation listeners. Anything emitted now stays for the next tick.
    const batch = this.events.drain();
    for (const event of batch) {
      for (const system of this.scheduler.subscribersTo(event.type)) {
        system.handle(event, context(system));
      }
    }
    this.events.seal();
    try {
      this.listeners.deliver(batch);
    } finally {
      this.events.unseal();
    }

    // 5. Calendar: tick++, boundary events queued for the next tick's dispatch. "The command log
    //    keeps every command of the current season" (`simulation-core.md` § Commands): it starts
    //    afresh with the first tick of a season (docs/01-architecture/simulation-core.md § Commands).
    const season = this.calendar.season;
    this.calendar.advance((event) => this.events.emit(event));
    if (this.calendar.season !== season) this.commandLog.startSeason();

    this.lastTickMs = this.now() - started;
    this.tickTimings.add(this.lastTickMs);
    this.scheduler.finishTick();
  }

  /** Run `n` ticks synchronously. */
  run(n: number): void {
    for (let i = 0; i < n; i += 1) this.step();
  }

  /**
   * Route a command to its owning system. `core` commands are handled here; a command whose owner
   * is not registered is rejected with `not_found` rather than silently dropped.
   */
  applyCommand(command: Command): CommandResult {
    const owner = ownerOf(command.type);
    if (owner === 'core') return this.applyCoreCommand(command);
    const system = this.scheduler.byId(owner);
    if (system === undefined) return reject('not_found');
    if (!system.ownsCommands.includes(command.type)) return reject('not_found');
    return system.applyCommand(command, this.tickContext(system));
  }

  /** The core owns exactly one command: `RenameFortress` (command-catalog.md). */
  private applyCoreCommand(command: Command): CommandResult {
    if (command.type !== 'RenameFortress') return reject('not_found');
    const name = command['name'];
    if (typeof name !== 'string' || name.length < 1 || name.length > 32) return reject('bad_name');
    this.fortress.name = name;
    return { ok: true };
  }

  stats(): HostStats {
    return {
      tick: this.calendar.tick,
      lastTickMs: this.lastTickMs,
      movingAverageTickMs: this.tickTimings.average,
      rollingWorstTickMs: this.tickTimings.worst,
      systems: this.scheduler.stats(),
    };
  }
}
