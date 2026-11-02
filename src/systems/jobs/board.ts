/**
 * The job board: `02-systems/11-jobs-and-labor.md` § The board, § Assignment, § Blocking and
 * retry, § Cancellation, and `algorithms/jobs-and-hauling.md` § Jobs tick, § Assignment.
 *
 * The board is the jobs API every tick context carries (D-049): producers create and cancel
 * through it, and 10 queues workers and steps them through it (`steps.ts`).
 */

import { C, ItemFlag, type Worker } from '@core/components';
import { PRIORITY_DEFAULT, TICKS_PER_YEAR } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { JobProducer, JobsApi, MovementApi, ReaderSetLike, TickContext, WorldLike } from '@core/system';
import type { Registry } from '@core/registry';
import type { EntityId, Priority, TileIndex } from '@core/types';
import { ADULT_AGE_YEARS, THREAT_RADIUS } from '@systems/dwarves/constants';
import { burnsNear } from '@systems/dwarves/fire';
import { shelterArea } from '@systems/dwarves/shelter';
import { AMMO_FETCH } from '@systems/foraging/constants';
import { choose, effectivePriority, estDistance, type Candidate } from './assign';
import {
  ASSIGN_WORKERS_PER_TICK,
  BLOCKED_RETRIES_PER_TICK,
  BLOCKED_RETRY_TICKS,
  JOB_HOLD_BACK_TICKS,
  JOB_HOLD_TICKS,
  PATIENT_SUMMON_PRIORITY,
  RESERVE_KEEP_TICKS,
  STANDING_ORDERS,
} from './constants';
import { NO_ITEMS, type ItemSource, type JobSink, type JobSpec } from './producers';
import type { Job, JobsStateV1, Tool } from './state';
import { stepWorker } from './steps';
import { applySetLabor } from './commands';

export interface JobTypeRow {
  readonly id: string;
  readonly labor: string;
  readonly skill: string | null;
  readonly baseTicks: number | string;
  readonly tool: string | null;
  readonly xp: number;
  readonly producer: string;
  readonly interruptible: boolean;
}

interface LaborRow {
  readonly id: string;
  readonly children: boolean;
}

/** The reasons a blocked job retries on, and the events that retry them (`11` § Blocking and retry). */
export const RETRY_TRIGGERS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  no_worker: ['ImmigrantsArrived'],
  unreachable: ['TilesChanged', 'BuildingStateChanged', 'FluidsChanged'],
  missing_input: ['ItemCreated', 'ItemReleased', 'StocksChanged'],
  no_tool: ['ItemCreated', 'ToolDropped'],
  no_magma: ['FluidsChanged'],
});

const FORTRESS_WALKER = Object.freeze({ faction: 'fortress' });

/** Jobs sharing a reachable connectivity label and labor. Only unusual worker rules need jobs. */
interface WorkAvailability {
  plain: boolean;
  tools: Job[];
  restricted: Job[];
}

export class JobBoard implements JobsApi, JobSink {
  readonly jobs = new Map<number, Job>();
  /** Every job id, ascending (creation order). */
  readonly ids: number[] = [];
  private readonly byKeyMap = new Map<string, number>();
  private readonly byEntityTarget = new Map<EntityId, Set<number>>();
  private readonly unsubscribeDestroyed: () => void;
  private readonly unsubscribeBeforeDestroyed: () => void;
  nextJobId = 1;
  readonly laborPriorities: number[];
  readonly standingOrders: Record<string, boolean> = {};
  readonly assignQueue: EntityId[] = [];
  blockedRetryCursor = 0;
  /**
   * During one `retryBlocked` pass, whether some worker holds or can fetch each tool. Nothing in the
   * pass moves an item or a worker, so every `no_tool` job of the pass gets the same answer, and the
   * kit search over every worker runs once a pass instead of once a job.
   */
  private toolOnHandMemo: Map<Tool, boolean> | null = null;
  readonly producers: JobProducer[] = [];
  /** 13's item search and handling (the D-054 seam); the jobs system installs the real one. */
  items: ItemSource = NO_ITEMS;

  readonly registry: Registry;
  readonly world: WorldLike;
  readonly readers: ReaderSetLike;
  private readonly types: (JobTypeRow | undefined)[] = [];
  private readonly laborIndex = new Map<string, number>();
  private readonly laborChildren: boolean[] = [];
  private readonly skillIndex = new Map<string, number>();
  /** The context of the call in progress, for the events a sink call emits. */
  private emitter: ((event: GameEvent) => void) | null = null;
  private workAvailabilityTick = -1;
  private readonly workAvailability = new Map<number, Map<number, WorkAvailability>>();

  private invalidateWorkAvailability(): void {
    this.workAvailabilityTick = -1;
  }

  constructor(world: WorldLike, registry: Registry, readers: ReaderSetLike) {
    this.world = world;
    this.unsubscribeBeforeDestroyed = world.entities.onBeforeDestroy((target, kind) => {
      if (kind !== 'creature') return;
      const pos = world.entities.get(target, C.Position);
      if (pos === undefined) return;
      for (const id of Array.from(this.byEntityTarget.get(target) ?? []).sort((a, b) => a - b)) {
        const job = this.jobs.get(id);
        if (job === undefined || job.workerId === 0 || this.typeId(job) !== 'hunt') continue;
        // 09's successful hunt continues by waiting for its own corpse, not its dead quarry.
        this.unindexTarget(job);
        job.data['animal'] = target;
        // `HuntKill` names the quarry's species after the quarry is gone.
        job.data['preySpecies'] = world.entities.get(target, C.Creature)?.species ?? 0;
        job.data['anchorTile'] = world.map.index(pos.x, pos.y, pos.z);
        job.target = { kind: 'tile', ref: job.data['anchorTile'] as TileIndex };
        this.invalidateWorkAvailability();
      }
    });
    this.unsubscribeDestroyed = world.entities.onDestroy((target) => {
      for (const id of Array.from(this.byEntityTarget.get(target) ?? []).sort((a, b) => a - b)) {
        const job = this.jobs.get(id);
        // A deconstruction's own completion destroys its target as part of success.
        if (job !== undefined && job.state !== 'completing') this.cancel(id, 'target_gone');
      }
    });
    this.registry = registry;
    this.readers = readers;
    const types = registry.table<JobTypeRow>('jobTypes');
    for (let t = 1; t <= types.size; t += 1) this.types[t] = types.byIndex(t);
    const labors = registry.table<LaborRow>('labors');
    this.laborPriorities = new Array<number>(labors.size + 1).fill(PRIORITY_DEFAULT);
    this.laborPriorities[0] = 0;
    for (let l = 1; l <= labors.size; l += 1) {
      const row = labors.byIndex(l) as LaborRow;
      this.laborIndex.set(row.id, l);
      this.laborChildren[l] = row.children;
    }
    const skills = registry.table('skills');
    for (let s = 1; s <= skills.size; s += 1) this.skillIndex.set(skills.idOf(s), s);
    for (const name of STANDING_ORDERS) this.standingOrders[name] = true;
  }

  dispose(): void {
    this.unsubscribeDestroyed();
    this.unsubscribeBeforeDestroyed();
  }

  private indexTarget(job: Job): void {
    if (job.target.kind !== 'entity' && job.target.kind !== 'building' && job.target.kind !== 'zone') return;
    let bucket = this.byEntityTarget.get(job.target.ref);
    if (bucket === undefined) {
      bucket = new Set<number>();
      this.byEntityTarget.set(job.target.ref, bucket);
    }
    bucket.add(job.id);
  }

  private unindexTarget(job: Job): void {
    const bucket = this.byEntityTarget.get(job.target.ref);
    bucket?.delete(job.id);
    if (bucket?.size === 0) this.byEntityTarget.delete(job.target.ref);
  }

  // ---------- lookups ----------

  get now(): number {
    return this.world.calendar.tick;
  }

  get movement(): MovementApi | null {
    return this.world.services.movement;
  }

  typeRow(job: Job): JobTypeRow {
    const row = this.types[job.type];
    if (row === undefined) throw new RangeError(`jobs: unknown job type index ${job.type}`);
    return row;
  }

  typeId(job: Job): string {
    return this.typeRow(job).id;
  }

  laborOf(id: string): number {
    return this.laborIndex.get(id) ?? 0;
  }

  /** The labor index of a job; 0 for a job whose labor the producer decides (`build`: "by category"). */
  jobLabor(job: Job): number {
    const override = job.data['labor'];
    if (typeof override === 'string') return this.laborOf(override);
    return this.laborOf(this.typeRow(job).labor);
  }

  skillIndexOf(id: string | null): number {
    return id === null ? 0 : (this.skillIndex.get(id) ?? 0);
  }

  /** The worker's level in a job's skill (0 when the job type has none). */
  skillFor(workerId: EntityId, job: Job): number {
    const override = job.data['skill'];
    const s = this.skillIndexOf(typeof override === 'string' ? override : this.typeRow(job).skill);
    if (s === 0) return 0;
    const skills = this.world.entities.get(workerId, C.Skills);
    return skills?.level[s] ?? 0;
  }

  /** `dwarves.productivity(id)` (15 × 17) when 10 is present; 100 otherwise. */
  productivity(workerId: EntityId): number {
    if (!this.readers.has('10')) return 100;
    const r = this.readers.of<{ productivity(id: EntityId): number }>('10');
    return r.productivity(workerId);
  }

  /** `JobsApi.setLabor`: `SetLabor`'s rule, for another system's command (25's apprentices). */
  setLabor(workerId: EntityId, labor: string, on: boolean): boolean {
    return applySetLabor(this, { type: 'SetLabor', dwarfId: workerId, labor, on }).ok;
  }

  isChild(workerId: EntityId): boolean {
    if (this.readers.has('10')) return this.readers.of<{ isChild(id: EntityId): boolean }>('10').isChild(workerId);
    const creature = this.world.entities.get(workerId, C.Creature);
    return creature !== undefined && creature.ageTicks < ADULT_AGE_YEARS * TICKS_PER_YEAR;
  }

  /** `11` § Labors: children have `hauling` only, fixed. */
  laborEnabled(workerId: EntityId, labor: number): boolean {
    if (labor <= 0) return false;
    if (this.isChild(workerId)) return this.laborChildren[labor] === true;
    const labors = this.world.entities.get(workerId, C.Labors);
    if (labors === undefined) return false;
    return (((labors.enabled[labor >> 3] ?? 0) as number) & (1 << (labor & 7))) !== 0;
  }

  /** Every living entity with `Labors`, ascending. */
  workers(): EntityId[] {
    return this.world.entities.with(C.Labors).filter((id) => this.world.entities.alive(id));
  }

  workerTile(workerId: EntityId): TileIndex {
    const p = this.world.entities.get(workerId, C.Position);
    if (p === undefined) return -1;
    return this.world.map.index(p.x, p.y, p.z);
  }

  workerOf(workerId: EntityId): Worker {
    return this.world.entities.get(workerId, C.Worker) ?? { jobId: 0, phase: 0, carrying: 0, toolId: 0 };
  }

  setWorker(workerId: EntityId, patch: Partial<Worker>): void {
    this.world.entities.add(workerId, C.Worker, { ...this.workerOf(workerId), ...patch });
  }

  /**
   * The tiles a worker may stand on for a job: `at` the target, `adjacent` the walkable
   * 8-neighbours on the target's level, or the given tile (`jobs.md` workTile column).
   */
  standTiles(job: Job): TileIndex[] {
    const map = this.world.map;
    const wt = job.workTile;
    if (typeof wt === 'number') return [wt];
    const target = this.anchorTile(job);
    if (!map.validIndex(target)) return [];
    if (wt === 'at') return [target];
    const out: TileIndex[] = [];
    for (const n of map.neighbors8(target)) {
      if (this.readers.pathing.passable(n, 'walker', FORTRESS_WALKER)) out.push(n);
    }
    // A producer may add stand tiles its rules allow (03: the stairs above a stairwell tile).
    const producer = this.producers.find((p) => p.id === job.producer);
    for (const extra of producer?.extraStandTiles?.(job) ?? []) {
      if (!out.includes(extra) && this.readers.pathing.passable(extra, 'walker', FORTRESS_WALKER)) out.push(extra);
    }
    return out.sort((a, b) => a - b);
  }

  /**
   * The tile a job is anchored at, for stand tiles and distances: `data.anchorTile` when a producer
   * gives one (a building job targets the building's id), a numeric work tile, else the target.
   */
  anchorTile(job: Job): TileIndex {
    const a = job.data['anchorTile'];
    if (typeof a === 'number') return a;
    if (typeof job.workTile === 'number') return job.workTile;
    if (job.target.kind === 'entity') {
      const pos = this.world.entities.get(job.target.ref, C.Position);
      if (pos) return this.world.map.index(pos.x, pos.y, pos.z);
    }
    return job.target.ref;
  }

  /**
   * Where a worker stands to take an item: the item's tile, or, when nobody can stand there (what
   * lies in a built chest), the nearest walkable tile beside it that the worker reaches (by
   * estimated distance, ties by tile index).
   */
  fetchTile(itemTile: TileIndex, workerId: EntityId): TileIndex {
    const map = this.world.map;
    const pathing = this.readers.pathing;
    if (!map.validIndex(itemTile) || pathing.labelOf(itemTile, 'walker') !== 0) return itemTile;
    const from = this.workerTile(workerId);
    if (from < 0) return itemTile;
    const label = pathing.labelOf(from, 'walker');
    const at = map.unpack(from);
    let best = itemTile;
    let bestD = Number.POSITIVE_INFINITY;
    for (const n of map.neighbors8(itemTile).sort((a, b) => a - b)) {
      if (pathing.labelOf(n, 'walker') !== label || !pathing.passable(n, 'walker', FORTRESS_WALKER)) continue;
      const d = estDistance(at, map.unpack(n));
      if (d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  /** The stand tiles that share the worker's connectivity label. */
  reachableStands(job: Job, workerId: EntityId): TileIndex[] {
    const from = this.workerTile(workerId);
    if (from < 0) return [];
    const label = this.readers.pathing.labelOf(from, 'walker');
    return this.standTiles(job).filter((t) => this.readers.pathing.labelOf(t, 'walker') === label);
  }

  /** True when at least one stand tile of the job shares the worker's connectivity label without allocating arrays. */
  hasReachableStand(job: Job, workerId: EntityId): boolean {
    const from = this.workerTile(workerId);
    if (from < 0) return false;
    const label = this.readers.pathing.labelOf(from, 'walker');
    const wt = job.workTile;
    if (typeof wt === 'number') return this.readers.pathing.labelOf(wt, 'walker') === label;
    const target = this.anchorTile(job);
    const map = this.world.map;
    if (!map.validIndex(target)) return false;
    if (wt === 'at') return this.readers.pathing.labelOf(target, 'walker') === label;
    for (const n of map.neighbors8(target)) {
      if (this.readers.pathing.passable(n, 'walker', FORTRESS_WALKER) && this.readers.pathing.labelOf(n, 'walker') === label) {
        return true;
      }
    }
    const producer = this.producers.find((p) => p.id === job.producer);
    for (const extra of producer?.extraStandTiles?.(job) ?? []) {
      if (this.readers.pathing.passable(extra, 'walker', FORTRESS_WALKER) && this.readers.pathing.labelOf(extra, 'walker') === label) {
        return true;
      }
    }
    return false;
  }

  private emit(event: GameEvent): void {
    if (this.emitter !== null) this.emitter(event);
    else this.world.emit(event);
  }

  /** Run `fn` with a context's emit as the sink for the events it causes. */
  withContext<T>(emit: (event: GameEvent) => void, fn: () => T): T {
    const before = this.emitter;
    this.emitter = emit;
    try {
      return fn();
    } finally {
      this.emitter = before;
    }
  }

  private notify(job: Job, event: GameEvent): void {
    this.emit(event);
    const producer = this.producers.find((p) => p.id === job.producer);
    producer?.onJobEvent?.(event);
  }

  // ---------- the sink ----------

  exists(key: string): boolean {
    return this.byKeyMap.has(key);
  }

  keysWithPrefix(prefix: string): string[] {
    return Array.from(this.byKeyMap.keys()).filter((key) => key.startsWith(prefix)).sort();
  }

  byKey(key: string): Readonly<Job> | undefined {
    const id = this.byKeyMap.get(key);
    return id === undefined ? undefined : this.jobs.get(id);
  }

  create(key: string, specIn: Readonly<Record<string, unknown>> | JobSpec): number {
    const existing = this.byKeyMap.get(key);
    if (existing !== undefined) return existing;
    const spec = specIn as JobSpec;
    const types = this.registry.table<JobTypeRow>('jobTypes');
    const type = types.index(spec.type);
    const row = types.byIndex(type) as JobTypeRow;
    const priority = spec.priority ?? PRIORITY_DEFAULT;
    const id = this.nextJobId;
    this.nextJobId += 1;
    const job: Job = {
      id,
      key,
      type,
      producer: row.producer,
      priority: priority as Priority,
      target: { ...spec.target },
      workTile: spec.workTile,
      inputs: (spec.inputs ?? []).map((i) => ({
        filter: { ...i.filter },
        count: i.count,
        ...(i.wholeItem ? { wholeItem: true as const } : {}),
        reserved: [],
        delivered: [],
      })),
      tool: spec.tool !== undefined ? spec.tool : ((row.tool as Job['tool']) ?? null),
      state: 'open',
      blockedReason: null,
      retryTick: 0,
      workerId: 0,
      progress: 0,
      createdTick: this.now,
      claimedTick: 0,
      data: { ...(spec.data ?? {}) },
    };
    this.jobs.set(id, job);
    this.indexTarget(job);
    this.invalidateWorkAvailability();
    this.ids.push(id);
    this.byKeyMap.set(key, id);
    this.notify(job, { type: 'JobCreated', jobId: id, jobType: row.id, target: job.target.ref });
    const reason = this.openProblem(job);
    if (reason !== null) this.block(job, reason);
    return id;
  }

  cancelKey(key: string, reason: string): void {
    const id = this.byKeyMap.get(key);
    if (id !== undefined) this.cancel(id, reason);
  }

  /** `11` § Cancellation: reservations release; the worker is freed; the job is removed. */
  cancel(jobId: number, reason: string): void {
    const job = this.jobs.get(jobId);
    if (job === undefined || job.state === 'done' || job.state === 'cancelled') return;
    this.releaseReservations(job);
    this.freeWorker(job, true);
    job.state = 'cancelled';
    this.remove(job);
    this.notify(job, { type: 'JobCancelled', jobId: job.id, jobType: this.typeId(job), reason, target: job.target.ref });
  }

  setPriority(jobId: number, priority: Priority): void {
    const job = this.jobs.get(jobId);
    if (job !== undefined) job.priority = priority;
  }

  /** A done job leaves the board. */
  finish(job: Job): void {
    this.remove(job);
  }

  private remove(job: Job): void {
    this.invalidateWorkAvailability();
    this.unindexTarget(job);
    this.jobs.delete(job.id);
    this.byKeyMap.delete(job.key);
    const at = this.ids.indexOf(job.id);
    if (at >= 0) this.ids.splice(at, 1);
  }

  // ---------- blocking ----------

  /**
   * Why an open job cannot be worked by anyone right now: `no_worker` when no dwarf has its labor,
   * `unreachable` when no dwarf with the labor shares a label with a stand tile; null otherwise.
   */
  openProblem(job: Job): string | null {
    const labor = this.jobLabor(job);
    if (labor === 0) return null;
    const workers = this.workers().filter((w) => this.laborEnabled(w, labor));
    if (workers.length === 0) return 'no_worker';
    for (const w of workers) if (this.reachableStands(job, w).length > 0) return null;
    return 'unreachable';
  }

  block(job: Job, reason: string): void {
    this.invalidateWorkAvailability();
    job.state = 'blocked';
    job.blockedReason = reason;
    job.retryTick = this.now + BLOCKED_RETRY_TICKS;
    this.notify(job, { type: 'JobBlocked', jobId: job.id, jobType: this.typeId(job), reason, target: job.target.ref });
  }

  /**
   * `unclaim(job, reason)`: release undelivered inputs, free the worker, block. A walk that found no route
   * (`reason` unreachable) waits for a reachability trigger. A walk that failed to reach `walkedTo` while
   * the labels no longer connect the worker to it did not fail despite connected labels (a door locked
   * on its way): it retries on the timer.
   */
  unclaim(job: Job, reason: string, walkedTo: TileIndex = -1): void {
    const worker = job.workerId;
    this.releaseReservations(job, true);
    this.freeWorker(job, true);
    if (reason === 'unreachable' && !this.labelsApart(worker, walkedTo)) job.failedWalk = true;
    else delete job.failedWalk;
    this.block(job, reason);
  }

  /** Whether the labels now keep a worker from a tile its walk was bound for. */
  private labelsApart(workerId: EntityId, tile: TileIndex): boolean {
    const from = this.workerTile(workerId);
    if (tile < 0 || from < 0 || !this.world.map.validIndex(tile)) return false;
    const pathing = this.readers.pathing;
    return pathing.labelOf(from, 'walker') !== pathing.labelOf(tile, 'walker');
  }

  /** A trigger fired: blocked jobs with this reason (and, for tiles, in a changed chunk) retry now. */
  trigger(reason: string, chunks: ReadonlySet<number> | null = null): void {
    const map = this.world.map;
    for (const id of this.ids) {
      const job = this.jobs.get(id) as Job;
      if (job.state !== 'blocked' || job.blockedReason !== reason) continue;
      if (chunks !== null && job.target.kind === 'tile' && map.validIndex(job.target.ref) && !chunks.has(map.chunkOf(job.target.ref))) {
        continue;
      }
      delete job.failedWalk;
      job.retryTick = Math.min(job.retryTick, this.now);
    }
  }

  /**
   * `retryBlocked(n)`: blocked jobs whose retry is due, in creation order from the cursor, at most
   * `BLOCKED_RETRIES_PER_TICK` of them. A blocked job opens only once its reason is gone: `no_worker`
   * and `unreachable` (D-054), and `missing_input` and `no_tool` (Decision F-01a, D-153).
   */
  retryBlocked(): void {
    const due = this.ids.filter((id) => {
      const job = this.jobs.get(id) as Job;
      return job.state === 'blocked' && job.retryTick <= this.now && job.failedWalk !== true;
    });
    if (due.length === 0) return;
    this.toolOnHandMemo = new Map();
    try {
      this.retryDue(due);
    } finally {
      this.toolOnHandMemo = null;
    }
  }

  private retryDue(due: readonly number[]): void {
    let start = due.findIndex((id) => id > this.blockedRetryCursor);
    if (start < 0) start = 0;
    const n = Math.min(BLOCKED_RETRIES_PER_TICK, due.length);
    for (let k = 0; k < n; k += 1) {
      const id = due[(start + k) % due.length] as number;
      const job = this.jobs.get(id) as Job;
      this.blockedRetryCursor = id;
      const reason = job.blockedReason;
      if (reason === 'no_magma' && job.producer === 'workshops' && this.readers.has('12') &&
        !this.readers.of<{ isMagmaPowered(id: EntityId): boolean }>('12').isMagmaPowered(job.target.ref)) {
        job.retryTick = this.now + BLOCKED_RETRY_TICKS;
        continue;
      }
      if (reason === 'no_worker' || reason === 'unreachable') {
        const still = this.openProblem(job);
        if (still !== null) {
          job.blockedReason = still;
          job.retryTick = this.now + BLOCKED_RETRY_TICKS;
          continue;
        }
      }
      if (reason === 'missing_input' || reason === 'no_tool') {
        if (!this.inputsAvailable(job)) {
          job.retryTick = this.now + BLOCKED_RETRY_TICKS;
          continue;
        }
      }
      job.state = 'open';
      this.invalidateWorkAvailability();
      job.blockedReason = null;
      this.notify(job, { type: 'JobUnblocked', jobId: job.id, jobType: this.typeId(job), target: job.target.ref });
    }
  }

  private inputsAvailable(job: Job): boolean {
    const stands = this.standTiles(job);
    const from = stands.length > 0 ? (stands[0] as TileIndex) : this.anchorTile(job);
    if (from < 0 || !this.world.map.validIndex(from)) return false;

    if (job.blockedReason === 'missing_input') {
      this.revalidateDelivered(job);
      for (const input of job.inputs) {
        const units = job.data['inputUnits'] === true && input.wholeItem !== true;
        const count = (id: EntityId): number => (units ? (this.items.countOf?.(id) ?? 1) : 1);
        const needed =
          input.count -
          input.delivered.reduce((sum, id) => sum + count(id), 0) -
          input.reserved.filter((id) => !input.delivered.includes(id)).reduce((sum, id) => sum + count(id), 0);
        if (needed <= 0) continue;
        const filter = { ...input.filter, excludeIds: [...input.reserved, ...input.delivered] };
        const found =
          units && this.items.findUnits !== undefined
            ? this.items.findUnits(filter, needed, from, false)
            : this.items.findItems(filter, needed, from);
        if (found.reduce((sum, id) => sum + count(id), 0) < needed) {
          return false;
        }
      }
      return true;
    }

    if (job.blockedReason === 'no_tool') {
      const tool = job.tool;
      if (tool !== null && job.data['toolToFetch'] === undefined) {
        if (!this.toolOnHand(tool) && this.items.findTool(tool, from) === 0) {
          return false;
        }
      }
      return true;
    }

    return true;
  }

  /** Whether some worker holds the tool, or, for a launcher, holds one or can fetch a kit for itself. */
  private toolOnHand(tool: Tool): boolean {
    const known = this.toolOnHandMemo?.get(tool);
    if (known !== undefined) return known;
    const carried = this.workers().some((w) => this.items.hasTool(w, tool));
    // A worker that holds a launcher may need only its ammunition.
    const kit = !carried && tool === 'ranged' && this.items.findRangedKit !== undefined &&
      this.workers().some((w) => (this.items.findRangedKit?.(w, this.workerTile(w)) ?? null) !== null);
    const onHand = carried || kit;
    this.toolOnHandMemo?.set(tool, onHand);
    return onHand;
  }

  // ---------- reservations ----------

  /**
   * F-17b (`11` § Job steps, `12` § Operation): a delivered input counts only while it exists,
   * is unconsumed and is reserved to this job. Delivered build and workshop inputs retain that
   * reservation through interruptions and blocks, but an external release, destruction or changed
   * holder still invalidates them. Whatever this job no longer holds leaves `delivered` and is
   * fetched again: an item that
   * is still free is reserved again first (it is usually still lying at the workshop), one that is
   * gone or another job's is replaced by `reserveInputs`. True when nothing was dropped.
   */
  revalidateDelivered(job: Job): boolean {
    const reservedFor = this.items.reservedFor;
    if (reservedFor === undefined) return true;
    // ItemDestroyed already pruned its ids on dispatch; completion must still refetch.
    let intact = job.data['inputsInvalidated'] !== true;
    delete job.data['inputsInvalidated'];
    for (const input of job.inputs) {
      for (let k = input.delivered.length - 1; k >= 0; k -= 1) {
        const it = input.delivered[k] as EntityId;
        const holder = reservedFor(it);
        if (holder === job.id) {
          if (!input.reserved.includes(it)) input.reserved.push(it);
          continue;
        }
        input.delivered.splice(k, 1);
        const at = input.reserved.indexOf(it);
        if (at >= 0) input.reserved.splice(at, 1);
        if (holder === 0) {
          this.items.reserve(it, job.id);
          input.reserved.push(it);
          this.emit({ type: 'ItemReserved', itemId: it, jobId: job.id });
        }
        intact = false;
      }
    }
    return intact;
  }

  /**
   * Reserve what a job still lacks, nearest to `from` (`11` § Assignment step 4). False, with
   * nothing more reserved for the short input, when an input cannot be found.
   */
  private reserveInputs(job: Job, from: TileIndex, inside: ((tile: TileIndex) => boolean) | null = null): boolean {
    for (const input of job.inputs) {
      const units = job.data['inputUnits'] === true && input.wholeItem !== true;
      const count = (id: EntityId): number => units ? (this.items.countOf?.(id) ?? 1) : 1;
      const needed = input.count - input.delivered.reduce((sum, id) => sum + count(id), 0)
        - input.reserved.filter((id) => !input.delivered.includes(id)).reduce((sum, id) => sum + count(id), 0);
      if (needed <= 0) continue;
      const filter = { ...input.filter, excludeIds: [...input.reserved, ...input.delivered] };
      const isBuild = this.typeId(job) === 'build';
      // A sheltering civilian looks only at items inside its shelter, so it finds what `workedInside` saw.
      const allowed = inside ?? undefined;
      const found = units && this.items.findUnits !== undefined
        ? this.items.findUnits(filter, needed, from, !isBuild, allowed)
        : this.items.findItems(filter, needed, from, allowed);
      if (found.reduce((sum, id) => sum + count(id), 0) < needed) return false;
      for (const it of found) {
        this.items.reserve(it, job.id);
        input.reserved.push(it);
        this.emit({ type: 'ItemReserved', itemId: it, jobId: job.id });
      }
    }
    return true;
  }

  /**
   * F-17b: a claimed job found, before consuming, that it no longer holds a delivered input. It
   * reserves a replacement and goes back to `fetching` with its progress kept, or blocks
   * `missing_input`; it never completes without its inputs.
   */
  refetch(job: Job, workerId: EntityId): void {
    if (!this.reserveInputs(job, this.workerTile(workerId))) {
      this.unclaim(job, 'missing_input');
      return;
    }
    job.state = 'fetching';
  }

  releaseReservations(job: Job, keepDelivered = false): void {
    const siteInputs = this.typeId(job) === 'build' || job.producer === 'workshops';
    const retain = keepDelivered && siteInputs;
    if (retain) this.revalidateDelivered(job);
    for (const input of job.inputs) {
      const retained: EntityId[] = [];
      for (const it of input.reserved) {
        const holder = siteInputs ? this.items.reservedFor?.(it) : undefined;
        if (holder !== undefined && holder !== job.id) continue;
        if (retain && input.delivered.includes(it)) retained.push(it);
        else this.releaseItem(it, job.id);
      }
      input.reserved = retained;
    }
    for (const key of ['toolToFetch', 'ammoToFetch']) {
      const tool = job.data[key];
      if (typeof tool === 'number' && tool !== 0) this.releaseItem(tool, job.id);
      delete job.data[key];
    }
    delete job.data['reserveUntil'];
  }

  /**
   * Release one reservation; `ItemReleased { itemId, jobId }` (11's event, `event-catalog.md`) for
   * an item that still exists (a consumed input is gone).
   */
  releaseItem(itemId: EntityId, jobId: number): void {
    this.items.release(itemId);
    if (this.world.entities.alive(itemId)) this.emit({ type: 'ItemReleased', itemId, jobId });
  }

  /** Undelivered reservations lapse; delivered build/workshop inputs stay with the job. */
  private lapseReservations(): void {
    for (const id of this.ids) {
      const job = this.jobs.get(id) as Job;
      const until = job.data['reserveUntil'];
      if (job.state !== 'open' || typeof until !== 'number' || until > this.now) continue;
      this.releaseReservations(job, true);
    }
  }

  private freeWorker(job: Job, dropCarried: boolean): void {
    const w = job.workerId;
    if (w === 0) return;
    const worker = this.world.entities.get(w, C.Worker);
    if (worker !== undefined && worker.jobId === job.id) {
      if (dropCarried && worker.carrying !== 0) this.items.dropAt(worker.carrying, this.workerTile(w));
      this.setWorker(w, { jobId: 0, carrying: 0, phase: 0 });
    }
    this.movement?.stopWalking(w);
    job.workerId = 0;
    delete job.data['awaySince'];
    delete job.data['awayBack'];
  }

  // ---------- the worker side ----------

  assign(workerId: EntityId): void {
    if (!this.assignQueue.includes(workerId)) this.assignQueue.push(workerId);
  }

  isQueued(workerId: EntityId): boolean {
    return this.assignQueue.includes(workerId);
  }

  stepWorker(workerId: EntityId, ctx: TickContext): void {
    this.withContext(
      (e) => ctx.emit(e),
      () => stepWorker(this, workerId, ctx),
    );
  }

  /**
   * `interrupt(w, keepProgress)`: the job returns to `open`, progress kept; reservations stay for
   * `RESERVE_KEEP_TICKS` for undelivered inputs; delivered build/workshop inputs stay held until
   * completion or cancellation. A carried item is dropped where the worker stands.
   */
  interrupt(workerId: EntityId, keepProgress: boolean): void {
    const worker = this.world.entities.get(workerId, C.Worker);
    if (worker === undefined || worker.jobId === 0) return;
    const job = this.jobs.get(worker.jobId);
    if (job === undefined) {
      this.setWorker(workerId, { jobId: 0 });
      return;
    }
    if (!keepProgress) {
      job.progress = 0;
      job.data['effort'] = 0;
    }
    this.freeWorker(job, true);
    job.state = 'open';
    this.invalidateWorkAvailability();
    job.data['reserveUntil'] = this.now + RESERVE_KEEP_TICKS;
    delete job.data['standTile'];
  }

  /** `jobs.hasUrgent(id, p)`: an open job of priority ≤ p the worker could take. */
  hasUrgent(workerId: EntityId, priority: number): boolean {
    for (const id of this.ids) {
      const job = this.jobs.get(id) as Job;
      if (job.state !== 'open') continue;
      const eff = effectivePriority(job.priority, this.laborPriorities[this.jobLabor(job)] ?? PRIORITY_DEFAULT);
      if (eff > priority) continue;
      if (this.eligible(job, workerId)) return true;
    }
    return false;
  }

  /** True when an open job is available that this worker could take (F-11). */
  hasWork(workerId: EntityId): boolean {
    if (this.avoidedThreatTile(workerId) >= 0) {
      return this.ids.some((id) => {
        const job = this.jobs.get(id) as Job;
        return job.state === 'open' && this.eligible(job, workerId);
      });
    }
    if (this.workAvailabilityTick !== this.now) this.rebuildWorkAvailability();
    const from = this.workerTile(workerId);
    if (from < 0) return false;
    const label = this.readers.pathing.labelOf(from, 'walker');
    const byLabor = this.workAvailability.get(label);
    if (byLabor === undefined) return false;
    for (let labor = 1; labor < this.laborChildren.length; labor += 1) {
      const available = byLabor.get(labor);
      if (available === undefined) continue;
      if (!this.laborEnabled(workerId, labor)) continue;
      if (available.plain) return true;
      for (const job of available.tools) {
        if (!this.toolHeldElsewhere(job, workerId, labor)) return true;
      }
      for (const job of available.restricted) {
        if (this.eligible(job, workerId)) return true;
      }
    }
    return false;
  }

  /** One pass over open jobs per tick, grouping by facts shared by workers in a connected area. */
  private rebuildWorkAvailability(): void {
    this.workAvailability.clear();
    for (const id of this.ids) {
      const job = this.jobs.get(id) as Job;
      if (job.state !== 'open') continue;
      const labor = this.jobLabor(job);
      if (labor === 0) continue;
      const labels: number[] = [];
      for (const tile of this.standTiles(job)) {
        const label = this.readers.pathing.labelOf(tile, 'walker');
        if (!labels.includes(label)) labels.push(label);
      }
      for (const label of labels) {
        let byLabor = this.workAvailability.get(label);
        if (byLabor === undefined) {
          byLabor = new Map();
          this.workAvailability.set(label, byLabor);
        }
        let availability = byLabor.get(labor);
        if (availability === undefined) {
          availability = { plain: false, tools: [], restricted: [] };
          byLabor.set(labor, availability);
        }
        if (job.data['assignedWorker'] !== undefined || job.data['minSkill'] !== undefined) {
          availability.restricted.push(job);
        } else if (job.tool === null) {
          availability.plain = true;
        } else {
          if (!availability.tools.some((candidate) => candidate.tool === job.tool)) availability.tools.push(job);
        }
      }
    }
    this.workAvailabilityTick = this.now;
  }

  /**
   * A job for a patient: a health job whose target is a dwarf with a `Patient` component (not
   * `bandage_animal`). Medical work continues under a `hearth` alert (10 § Behavior selection).
   */
  isPatientCare(job: Job): boolean {
    return job.producer === 'health' && job.target.kind === 'entity' && this.world.entities.has(job.target.ref, C.Patient);
  }

  /**
   * `11` § Assignment: an open job for a patient at `PATIENT_SUMMON_PRIORITY` does not wait for a
   * worker to finish what it is doing. When no free worker in the queue could take it, the nearest
   * worker to the patient at interruptible work that is not itself for a patient is interrupted,
   * progress kept, and claims the job at once (queued for this tick if the claim fails).
   */
  private summonForPatients(): void {
    const map = this.world.map;
    const entities = this.world.entities;
    const onDuty = this.readers.has('16') ? this.readers.of<{ onDuty(id: EntityId): boolean }>('16') : null;
    let workers: EntityId[] | null = null;
    for (const id of this.ids) {
      const job = this.jobs.get(id);
      if (job === undefined || job.state !== 'open' || job.priority !== PATIENT_SUMMON_PRIORITY || !this.isPatientCare(job)) continue;
      if (this.assignQueue.some((w) => this.workerOf(w).jobId === 0 && this.eligible(job, w))) continue;
      // Nearest to the patient itself (a `carry_patient` job's anchor is the bed).
      const patientTile = job.target.kind === 'entity' ? this.workerTile(job.target.ref) : -1;
      const anchor = map.unpack(patientTile >= 0 ? patientTile : this.anchorTile(job));
      let best: EntityId = 0;
      let bestD = Number.POSITIVE_INFINITY;
      workers ??= this.workers();
      for (const w of workers) {
        const held = this.jobs.get(this.workerOf(w).jobId);
        if (held === undefined || held.workerId !== w || !this.typeRow(held).interruptible || this.isPatientCare(held)) continue;
        if (entities.get(w, C.Brain)?.behavior !== 'work' || entities.has(w, C.Patient) || onDuty?.onDuty(w) === true) continue;
        if (!this.eligible(job, w)) continue;
        const d = estDistance(map.unpack(this.workerTile(w)), anchor);
        if (d < bestD) {
          best = w;
          bestD = d;
        }
      }
      if (best === 0) continue;
      this.interrupt(best, true);
      // The called worker takes the patient's job now: queued, it could choose its own job back by
      // labor priority, and a long queue would not answer it this tick.
      if (!this.claim(best, job)) this.assign(best);
    }
  }

  /** Whether a claimed hunt job has this creature as its quarry after the quarry has died (the job's `animal` is set then). */
  isHuntQuarry(creatureId: EntityId): boolean {
    return Array.from(this.jobs.values()).some((job) => job.workerId !== 0 && job.data['animal'] === creatureId && this.typeId(job) === 'hunt');
  }

  /** Whether the job is one a civilian takes under a `hearth` alert only because it is done inside the shelter. */
  private sheltersWork(workerId: EntityId, job: Job): boolean {
    if (!this.readers.has('16') || this.isPatientCare(job) || this.typeId(job) === 'pull_lever') return false;
    const combat = this.readers.of<{ alert(): string; onDuty(id: EntityId): boolean }>('16');
    return combat.alert() === 'hearth' && !combat.onDuty(workerId);
  }

  /** Under a `hearth` alert a sheltering civilian takes patient care, the pulls of levers inside its shelter, and jobs done wholly inside it only. */
  private shelteredFrom(job: Job, workerId: EntityId): boolean {
    if (!this.readers.has('16')) return false;
    const combat = this.readers.of<{ alert(): string; onDuty(id: EntityId): boolean }>('16');
    return combat.alert() === 'hearth' && !combat.onDuty(workerId) && !this.isShelterWork(job, workerId);
  }

  private shelterMemo = { tick: -1, byWorker: new Map<EntityId, ((tile: TileIndex) => boolean) | null>() };

  /** The area a civilian shelters in under the alert (19 `retreatTile`, 10's `shelterArea`), or null with no shelter. */
  private shelterInside(workerId: EntityId): ((tile: TileIndex) => boolean) | null {
    if (!this.readers.has('19')) return null;
    const memo = this.shelterMemo;
    if (memo.tick !== this.now) {
      memo.tick = this.now;
      memo.byWorker.clear();
    }
    const known = memo.byWorker.get(workerId);
    if (known !== undefined) return known;
    // A civilian with no shelter is looked at again after `BLOCKED_RETRY_TICKS` only: the search for one
    // is the costly part, and the map rebuilds its connectivity every few ticks in a busy fortress.
    const none = this.noShelter.get(workerId);
    if (none !== undefined && this.now - none < BLOCKED_RETRY_TICKS) {
      memo.byWorker.set(workerId, null);
      return null;
    }
    const shelter = this.readers.of<{ retreatTile(id: EntityId): TileIndex }>('19').retreatTile(workerId);
    const inside = shelter < 0 ? null : shelterArea(this.world.map, this.readers, shelter);
    if (inside === null) this.noShelter.set(workerId, this.now);
    else this.noShelter.delete(workerId);
    memo.byWorker.set(workerId, inside);
    return inside;
  }

  /** Workers last found to have no shelter under the alert, with the tick of that look. Derived; not saved. */
  private readonly noShelter = new Map<EntityId, number>();

  /**
   * The jobs a sheltering civilian works under a `hearth` alert (10 § Behavior selection, 11 § The
   * alert): patient care; the `pull_lever` job of a lever inside the civilian's shelter (the area 10
   * shelters it in around its retreat tile, 19 `retreatTile`, read by the same helper); and a job
   * done wholly inside that shelter: every tile it can be worked from, every input it still needs
   * and every item it holds, and the tool it works with, inside it or in the worker's hands.
   */
  isShelterWork(job: Job, workerId: EntityId): boolean {
    if (this.isPatientCare(job)) return true;
    const inside = this.shelterInside(workerId);
    if (inside === null) return false;
    const map = this.world.map;
    if (this.typeId(job) === 'pull_lever') {
      const lever = this.anchorTile(job);
      if (!map.validIndex(lever)) return false;
      return inside(lever) || map.neighbors(lever).some((t) => map.zOf(t) === map.zOf(lever) && inside(t));
    }
    return this.workedInside(job, workerId, inside);
  }

  private workedInside(job: Job, workerId: EntityId, inside: (tile: TileIndex) => boolean): boolean {
    if (job.workTile === 'ranged') return false;
    const map = this.world.map;
    const anchor = this.anchorTile(job);
    if (!map.validIndex(anchor)) return false;
    // The cheap test first: most open jobs lie nowhere near the shelter.
    if (!inside(anchor) && !(job.workTile === 'adjacent' && map.neighbors8(anchor).some((t) => map.zOf(t) === map.zOf(anchor) && inside(t)))) return false;
    const stands = this.standTiles(job);
    if (stands.length === 0 || !stands.every(inside)) return false;
    if (job.tool !== null && !this.items.hasTool(workerId, job.tool)) return false;
    for (const input of job.inputs) {
      for (const id of input.reserved) {
        if (input.delivered.includes(id)) continue;
        const at = this.items.tileOf(id);
        if (at < 0 || !inside(at)) return false;
      }
      if (!this.inputFoundInside(job, input, workerId, inside)) return false;
    }
    return true;
  }

  /**
   * Whether what an input still lacks is found inside the shelter by the search a claim makes: from the
   * worker's tile, the same filter, the shelter as the only place allowed. Splitting a stack changes which
   * ids come back, not which stacks, so this search does not split.
   */
  private inputFoundInside(job: Job, input: Job['inputs'][number], workerId: EntityId, inside: (tile: TileIndex) => boolean): boolean {
    const units = job.data['inputUnits'] === true && input.wholeItem !== true;
    const count = (id: EntityId): number => (units ? (this.items.countOf?.(id) ?? 1) : 1);
    const needed = input.count - input.delivered.reduce((sum, id) => sum + count(id), 0) -
      input.reserved.filter((id) => !input.delivered.includes(id)).reduce((sum, id) => sum + count(id), 0);
    if (needed <= 0) return true;
    const filter = { ...input.filter, excludeIds: [...input.reserved, ...input.delivered] };
    const from = this.workerTile(workerId);
    const found = units && this.items.findUnits !== undefined
      ? this.items.findUnits(filter, needed, from, false, inside)
      : this.items.findItems(filter, needed, from, inside);
    return found.reduce((sum, id) => sum + count(id), 0) >= needed;
  }

  private eligible(job: Job, workerId: EntityId): boolean {
    if (this.shelteredFrom(job, workerId)) return false;
    const threat = this.avoidedThreatTile(workerId);
    if (threat >= 0) {
      const map = this.world.map;
      const target = this.anchorTile(job);
      if (map.zOf(target) === map.zOf(threat) && Math.max(Math.abs(map.xOf(target) - map.xOf(threat)), Math.abs(map.yOf(target) - map.yOf(threat))) <= THREAT_RADIUS) return false;
    }
    if (this.nearFire(job, workerId)) return false;
    const assigned = job.data['assignedWorker'];
    if (typeof assigned === 'number' && assigned !== 0 && assigned !== workerId) return false;
    // A job may name a worker it is not for (a patient's own treatment, 17 § Patients and hospitals).
    if (job.data['excludeWorker'] === workerId) return false;
    const labor = this.jobLabor(job);
    if (!this.laborEnabled(workerId, labor)) return false;
    const minSkill = job.data['minSkill'];
    if (typeof minSkill === 'number' && this.skillFor(workerId, job) < minSkill) return false;
    if (this.toolHeldElsewhere(job, workerId, labor)) return false;
    return this.hasReachableStand(job, workerId);
  }

  /** A dwarf that fled a fire lately is offered no job whose tile lies within `FIRE_AVOID_RADIUS` of a burning tile (10 § Behavior selection, step 1). */
  private nearFire(job: Job, workerId: EntityId): boolean {
    if (!this.readers.has('10') || !this.readers.of<{ avoidsFire?(id: EntityId): boolean }>('10').avoidsFire?.(workerId)) return false;
    return burnsNear(this.world.map, this.anchorTile(job));
  }

  private avoidedThreatTile(workerId: EntityId): TileIndex {
    return this.readers.has('10') ? this.readers.of<{ avoidedThreatTile?(id: EntityId): TileIndex }>('10').avoidedThreatTile?.(workerId) ?? -1 : -1;
  }

  private freeToolCache = { tick: -1, found: new Map<string, boolean>() };

  /**
   * `no_tool` is "no free pick, axe or ranged weapon" (11 § Blocking and retry): while no free tool
   * of the kind is within the worker's reach and some other worker with the labor carries one, a
   * worker without it leaves the job to them rather than blocking it (D-076).
   */
  private toolHeldElsewhere(job: Job, workerId: EntityId, labor: number): boolean {
    const tool = job.tool;
    if (tool === null || this.items.hasTool(workerId, tool)) return false;
    const holders = this.workers().some((o) => o !== workerId && this.laborEnabled(o, labor) && this.items.hasTool(o, tool));
    if (!holders) return false;
    const cache = this.freeToolCache;
    if (cache.tick !== this.now) {
      cache.tick = this.now;
      cache.found.clear();
    }
    const key = `${workerId}:${String(tool)}`;
    let free = cache.found.get(key);
    if (free === undefined) {
      const from = this.workerTile(workerId);
      free = from >= 0 && this.items.findTool(tool, from) !== 0;
      cache.found.set(key, free);
    }
    return !free;
  }

  /**
   * `assign(w)` of the algorithm: candidates, score, claim. When a claim fails, falls through to the
   * next candidate (Decision F-01b, D-153). Returns the claimed job id or 0.
   */
  assignOne(workerId: EntityId): number {
    if (!this.world.entities.alive(workerId)) return 0;
    if (this.workerOf(workerId).jobId !== 0) return 0;
    const from = this.workerTile(workerId);
    if (from < 0) return 0;
    const map = this.world.map;
    const at = map.unpack(from);
    const candidates: Candidate[] = [];
    for (const id of this.ids) {
      const job = this.jobs.get(id) as Job;
      if (job.state !== 'open') continue;
      if (!this.eligible(job, workerId)) continue;
      const labor = this.jobLabor(job);
      candidates.push({
        jobId: job.id,
        eff: effectivePriority(job.priority, this.laborPriorities[labor] ?? PRIORITY_DEFAULT),
        distance: estDistance(at, map.unpack(this.anchorTile(job))),
        skill: this.skillFor(workerId, job),
        workshopWorker: job.data['workshopWorker'] === workerId,
      });
    }
    const pool = candidates;
    while (pool.length > 0) {
      const chosen = choose(pool);
      if (chosen === 0) return 0;
      const job = this.jobs.get(chosen);
      if (!job) {
        const idx = pool.findIndex((c) => c.jobId === chosen);
        if (idx >= 0) pool.splice(idx, 1);
        continue;
      }
      if (this.claim(workerId, job)) return job.id;
      const idx = pool.findIndex((c) => c.jobId === chosen);
      if (idx >= 0) pool.splice(idx, 1);
    }
    return 0;
  }

  /** `claim(w, job)`: reserve inputs and the tool; `missing_input` / `no_tool` block the job. */
  claim(workerId: EntityId, job: Job): boolean {
    this.invalidateWorkAvailability();
    job.state = 'claimed';
    job.workerId = workerId;
    job.claimedTick = this.now;
    delete job.data['reserveUntil'];
    this.setWorker(workerId, { jobId: job.id, phase: 0 });
    const from = this.workerTile(workerId);
    this.revalidateDelivered(job);
    if (!this.reserveInputs(job, from, this.sheltersWork(workerId, job) ? this.shelterInside(workerId) : null)) {
      this.unclaim(job, 'missing_input');
      return false;
    }
    if (job.tool === 'ranged' && this.items.findRangedKit !== undefined) {
      // A launcher and its own ammunition together, or the job is not taken (11 § Assignment).
      if (!this.items.hasTool(workerId, 'ranged') && job.data['toolToFetch'] === undefined && job.data['ammoToFetch'] === undefined) {
        const kit = this.items.findRangedKit(workerId, from);
        if (kit === null) {
          this.unclaim(job, 'no_tool');
          return false;
        }
        if (kit.launcher !== 0) {
          this.items.reserve(kit.launcher, job.id);
          job.data['toolToFetch'] = kit.launcher;
        }
        if (kit.ammo !== 0) {
          const ammo = this.items.limitStack?.(kit.ammo, AMMO_FETCH) ?? kit.ammo;
          this.items.reserve(ammo, job.id);
          job.data['ammoToFetch'] = ammo;
        }
      }
    } else if (job.tool !== null && !this.items.hasTool(workerId, job.tool) && job.data['toolToFetch'] === undefined) {
      const tool = this.items.findTool(job.tool, from);
      if (tool === 0) {
        this.unclaim(job, 'no_tool');
        return false;
      }
      this.items.reserve(tool, job.id);
      job.data['toolToFetch'] = tool;
    }
    this.notify(job, { type: 'JobClaimed', jobId: job.id, jobType: this.typeId(job), workerId, target: job.target.ref });
    return true;
  }

  /** Called before worker removal; the later death event repeats this idempotently. */
  workerDied(workerId: EntityId, deathTile = this.workerTile(workerId)): void {
    const worker = this.world.entities.get(workerId, C.Worker);
    const equipment = this.world.entities.get(workerId, C.Equipment);
    const worn = new Set(equipment === undefined ? [] : [equipment.weapon, equipment.shield,
      ...Object.values(equipment.armor), ...Object.values(equipment.clothing), equipment.quiver]);
    const api = this.world.services.items;
    const dropped = new Set<EntityId>();
    if (worker !== undefined && api !== null && this.world.map.validIndex(deathTile)) {
      for (const itemId of [worker.toolId, worker.carrying]) {
        if (itemId !== 0 && !worn.has(itemId) && this.world.entities.get(itemId, C.Item)?.carriedBy === workerId) {
          dropped.add(itemId);
        }
      }
    }
    for (const id of this.ids) {
      const job = this.jobs.get(id) as Job;
      if (job.workerId !== workerId) continue;
      for (const input of job.inputs) {
        input.reserved = input.reserved.filter((itemId) => !dropped.has(itemId));
        input.delivered = input.delivered.filter((itemId) => !dropped.has(itemId));
      }
      if (dropped.has(job.data['toolToFetch'] as EntityId)) delete job.data['toolToFetch'];
      if (dropped.has(job.data['ammoToFetch'] as EntityId)) delete job.data['ammoToFetch'];
      job.workerId = 0;
      job.state = 'open';
      this.invalidateWorkAvailability();
      delete job.data['awaySince'];
      delete job.data['awayBack'];
      delete job.data['standTile'];
    }
    const at = this.assignQueue.indexOf(workerId);
    if (at >= 0) this.assignQueue.splice(at, 1);
    if (worker === undefined) return;
    if (api !== null && this.world.map.validIndex(deathTile)) {
      for (const itemId of dropped) {
        const item = this.world.entities.get(itemId, C.Item);
        if (item?.carriedBy !== workerId) continue;
        if (item.reservedBy !== 0 || (item.flags & ItemFlag.Reserved) !== 0) {
          api.release(itemId);
          this.emit({ type: 'ItemReleased', itemId, jobId: item.reservedBy });
        }
        api.setOwner(itemId, 0);
        api.setFlag(itemId, ItemFlag.Forbidden, false);
        api.dropAt(itemId, deathTile);
        if (itemId === worker.toolId) this.emit({ type: 'ToolDropped', itemId });
      }
    }
    this.setWorker(workerId, { jobId: 0, phase: 0, toolId: 0, carrying: 0 });
  }

  // ---------- the tick ----------

  /**
   * `11` § Job steps, interruptions: a worker that the brain has moved aside (flight, shelter, a
   * patient's bed, a need) while it holds a job (in practice one that is not interruptible) keeps the job,
   * and the job resumes; once the absence has lasted `JOB_HOLD_TICKS` the job goes back to the board as an
   * interrupted job does. The absence starts at the first tick it is seen (`data.awaySince`) and ends when
   * the worker has been back at work for `JOB_HOLD_BACK_TICKS` (`data.awayBack` is the tick it came back):
   * a worker bouncing in and out for a think at a time does not restart the count.
   */
  private releaseAbsentHolders(): void {
    for (const id of this.ids) {
      const job = this.jobs.get(id) as Job;
      if (job.workerId === 0) continue;
      const behavior = this.world.entities.get(job.workerId, C.Brain)?.behavior;
      if (behavior === undefined || behavior === 'work') {
        if (job.data['awaySince'] === undefined) continue;
        const back = job.data['awayBack'];
        if (typeof back !== 'number') job.data['awayBack'] = this.now;
        else if (this.now - back >= JOB_HOLD_BACK_TICKS) {
          delete job.data['awaySince'];
          delete job.data['awayBack'];
        }
        continue;
      }
      delete job.data['awayBack'];
      const since = job.data['awaySince'];
      if (typeof since !== 'number') {
        job.data['awaySince'] = this.now;
        continue;
      }
      if (this.now - since < JOB_HOLD_TICKS) continue;
      delete job.data['awaySince'];
      delete job.data['awayBack'];
      if (this.workerOf(job.workerId).jobId === job.id) this.interrupt(job.workerId, true);
    }
  }

  /**
   * `tick(ctx)` of the algorithm: producers, `retryBlocked`, then up to `ASSIGN_WORKERS_PER_TICK`
   * queued workers in id order.
   */
  tick(ctx: TickContext): void {
    this.withContext(
      (e) => ctx.emit(e),
      () => {
        for (const producer of this.producers) producer.produce(ctx, this);
        this.lapseReservations();
        this.releaseAbsentHolders();
        this.retryBlocked();
        this.summonForPatients();
        this.assignQueue.sort((a, b) => a - b);
        let served = 0;
        while (this.assignQueue.length > 0 && served < ASSIGN_WORKERS_PER_TICK) {
          const w = this.assignQueue.shift() as EntityId;
          this.assignOne(w);
          served += 1;
        }
      },
    );
  }

  // ---------- persistence ----------

  serialize(): JobsStateV1 {
    return {
      stateVersion: 1,
      jobs: this.ids.map((id) => structuredCopy(this.jobs.get(id) as Job)),
      nextJobId: this.nextJobId,
      laborPriorities: this.laborPriorities.slice(),
      standingOrders: { ...this.standingOrders },
      assignQueue: this.assignQueue.slice(),
      blockedRetryCursor: this.blockedRetryCursor,
    };
  }

  deserialize(state: JobsStateV1): void {
    this.invalidateWorkAvailability();
    this.workAvailability.clear();
    this.jobs.clear();
    this.byKeyMap.clear();
    this.byEntityTarget.clear();
    this.ids.length = 0;
    for (const j of state.jobs) {
      const job = structuredCopy(j);
      this.jobs.set(job.id, job);
      this.indexTarget(job);
      this.ids.push(job.id);
      this.byKeyMap.set(job.key, job.id);
    }
    this.ids.sort((a, b) => a - b);
    this.nextJobId = state.nextJobId;
    for (let k = 0; k < state.laborPriorities.length; k += 1) this.laborPriorities[k] = state.laborPriorities[k] as number;
    Object.assign(this.standingOrders, state.standingOrders);
    this.assignQueue.length = 0;
    this.assignQueue.push(...state.assignQueue);
    this.blockedRetryCursor = state.blockedRetryCursor;
  }
}

function structuredCopy(job: Job): Job {
  return {
    ...job,
    target: { ...job.target },
    inputs: job.inputs.map((i) => ({ filter: { ...i.filter }, count: i.count, ...(i.wholeItem === true ? { wholeItem: true as const } : {}), reserved: i.reserved.slice(), delivered: i.delivered.slice() })),
    data: { ...job.data },
  };
}
