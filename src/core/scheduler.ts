/**
 * The scheduler.
 *
 * Implements `01-architecture/simulation-core.md` § The scheduler and `04-implementation/
 * tick-order.md`: the systems in their fixed order with their cadence and phase; a system runs
 * when `(tick - phase) mod cadence == 0`.
 */

import { EventDispatchTable } from './events';
import type { EventType } from './event-types';
import type { Clock, GameSystem, SystemId } from './system';
import { SIM_TICKS_PER_SECOND } from './constants';

/** Diagnostic only: timings never participate in simulation state or persistence. */
export class TimingWindow {
  private readonly samples = new Float64Array(SIM_TICKS_PER_SECOND);
  private cursor = 0;
  private count = 0;
  private total = 0;

  add(ms: number): void {
    this.total += ms - (this.samples[this.cursor] as number);
    this.samples[this.cursor] = ms;
    this.cursor = (this.cursor + 1) % this.samples.length;
    this.count = Math.min(this.count + 1, this.samples.length);
  }

  get average(): number { return this.count === 0 ? 0 : this.total / this.count; }
  get worst(): number { return Math.max(...this.samples); }
}

/** `(tick - phase) mod cadence == 0`, with a modulo that is never negative. */
export function isDue(tick: number, cadence: number, phase: number): boolean {
  if (cadence <= 0) throw new RangeError(`cadence must be positive, got ${cadence}`);
  const m = (tick - phase) % cadence;
  return (m < 0 ? m + cadence : m) === 0;
}

export interface SystemTiming {
  id: SystemId;
  lastMs: number;
  worstMs: number;
  totalMs: number;
  runs: number;
  movingAverageMs: number;
  rollingWorstMs: number;
}

/**
 * The scheduler table of `simulation-core.md` § The scheduler. Systems are held in ascending
 * `order`; `add` keeps the list sorted so registration order does not matter.
 */
export class Scheduler {
  private readonly systems: GameSystem[] = [];
  private readonly byIdMap = new Map<SystemId, GameSystem>();
  private dispatch: EventDispatchTable<GameSystem> | null = null;
  private readonly timings = new Map<SystemId, SystemTiming>();
  private readonly windows = new Map<SystemId, TimingWindow>();
  private readonly pending = new Map<SystemId, number>();
  private readonly now: Clock;

  /** `now` comes from the platform; `core` never reads a wall clock itself. */
  constructor(now: Clock = () => 0) {
    this.now = now;
  }

  add(system: GameSystem): void {
    if (this.byIdMap.has(system.id)) throw new Error(`duplicate system id ${system.id}`);
    if (system.cadence <= 0) throw new RangeError(`system ${system.id} has cadence ${system.cadence}`);
    this.byIdMap.set(system.id, system);
    let at = this.systems.length;
    while (at > 0 && (this.systems[at - 1] as GameSystem).order > system.order) at -= 1;
    this.systems.splice(at, 0, system);
    this.timings.set(system.id, { id: system.id, lastMs: 0, worstMs: 0, totalMs: 0, runs: 0, movingAverageMs: 0, rollingWorstMs: 0 });
    this.windows.set(system.id, new TimingWindow());
    this.dispatch = null;
  }

  /** Every system, in the fixed order of `02-systems/README.md`. */
  inOrder(): readonly GameSystem[] {
    return this.systems;
  }

  byId(id: SystemId): GameSystem | undefined {
    return this.byIdMap.get(id);
  }

  has(id: SystemId): boolean {
    return this.byIdMap.has(id);
  }

  get size(): number {
    return this.systems.length;
  }

  /** The systems whose cadence and phase make them due on `tick`, in system order. */
  due(tick: number): GameSystem[] {
    return this.systems.filter((s) => isDue(tick, s.cadence, s.phase));
  }

  /** The dispatch table built from each system's static `subscribes` list. */
  subscribersTo(type: EventType): readonly GameSystem[] {
    if (this.dispatch === null) this.dispatch = new EventDispatchTable(this.systems);
    return this.dispatch.subscribersTo(type);
  }

  /** Run one system's `tick`, recording its timing. */
  runTick(system: GameSystem, run: () => void): void {
    const started = this.now();
    run();
    const timing = this.timings.get(system.id);
    if (timing !== undefined) {
      timing.lastMs = this.now() - started;
      timing.worstMs = Math.max(timing.worstMs, timing.lastMs);
      timing.totalMs += timing.lastMs;
      timing.runs += 1;
      this.pending.set(system.id, (this.pending.get(system.id) ?? 0) + timing.lastMs);
    }
  }

  stats(): readonly SystemTiming[] {
    return this.systems.map((s) => ({ ...this.timings.get(s.id) as SystemTiming,
      movingAverageMs: this.windows.get(s.id)?.average ?? 0,
      rollingWorstMs: this.windows.get(s.id)?.worst ?? 0 }));
  }

  /** Include zero-cost cadence ticks so the moving average is amortized per world tick. */
  finishTick(): void {
    for (const system of this.systems) this.windows.get(system.id)?.add(this.pending.get(system.id) ?? 0);
    this.pending.clear();
  }

  resetStats(): void {
    for (const s of this.systems) {
      this.timings.set(s.id, { id: s.id, lastMs: 0, worstMs: 0, totalMs: 0, runs: 0, movingAverageMs: 0, rollingWorstMs: 0 });
      this.windows.set(s.id, new TimingWindow());
    }
    this.pending.clear();
  }

  clear(): void {
    this.systems.length = 0;
    this.byIdMap.clear();
    this.timings.clear();
    this.windows.clear();
    this.pending.clear();
    this.dispatch = null;
  }
}
