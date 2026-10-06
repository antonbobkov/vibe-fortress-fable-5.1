/**
 * The job board: `02-systems/11-jobs-and-labor.md` § The board, § Assignment, § Blocking and
 * retry, § Cancellation, and `algorithms/jobs-and-hauling.md` § Jobs tick, § Assignment.
 *
 * The board is the jobs API every tick context carries (D-049): producers create and cancel
 * through it, and 10 queues workers and steps them through it (`steps.ts`).
 */

import { C, type Worker } from '@core/components';
import { PRIORITY_DEFAULT, TICKS_PER_YEAR } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { JobProducer, JobsApi, MovementApi, ReaderSetLike, TickContext, WorldLike } from '@core/system';
import type { Registry } from '@core/registry';
import type { EntityId, Priority, TileIndex } from '@core/types';
import { ADULT_AGE_YEARS } from '@systems/dwarves/constants';
import { choose, effectivePriority, estDistance, type Candidate } from './assign';
import {
  ASSIGN_WORKERS_PER_TICK,
  BLOCKED_RETRIES_PER_TICK,
  BLOCKED_RETRY_TICKS,
  RESERVE_KEEP_TICKS,
  STANDING_ORDERS,
} from './constants';
import { NO_ITEMS, type ItemSource, type JobSink, type JobSpec } from './producers';
import type { Job, JobsStateV1 } from './state';
import { stepWorker } from './steps';

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
  workshop_suspended: [],
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
  nextJobId = 1;
  readonly laborPriorities: number[];
  readonly standingOrders: Record<string, boolean> = {};
  readonly assignQueue: EntityId[] = [];
  blockedRetryCursor = 0;
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

  /** `unclaim(job, reason)`: release reservations, free the worker, block. */
  unclaim(job: Job, reason: string): void {
    this.releaseReservations(job);
    this.freeWorker(job, true);
    this.block(job, reason);
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
      return job.state === 'blocked' && job.retryTick <= this.now;
    });
    if (due.length === 0) return;
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
        const carried = this.workers().some((w) => this.items.hasTool(w, tool));
        if (!carried && this.items.findTool(tool, from) === 0) {
          return false;
        }
      }
      return true;
    }

    return true;
  }

  // ---------- reservations ----------

  /**
   * F-17b (`11` § Job steps, `12` § Operation): a delivered input counts only while it exists,
   * is unconsumed and is reserved to this job. After the reservations of an interrupted job lapse
   * (or an unclaim released them) another job may take a delivered item, or a hauler may carry it
   * off. Whatever this job no longer holds leaves `delivered` and is fetched again: an item that
   * is still free is reserved again first (it is usually still lying at the workshop), one that is
   * gone or another job's is replaced by `reserveInputs`. True when nothing was dropped.
   */
  revalidateDelivered(job: Job): boolean {
    const reservedFor = this.items.reservedFor;
    if (reservedFor === undefined) return true;
    let intact = true;
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
  private reserveInputs(job: Job, from: TileIndex): boolean {
    for (const input of job.inputs) {
      const units = job.data['inputUnits'] === true && input.wholeItem !== true;
      const count = (id: EntityId): number => units ? (this.items.countOf?.(id) ?? 1) : 1;
      const needed = input.count - input.delivered.reduce((sum, id) => sum + count(id), 0)
        - input.reserved.filter((id) => !input.delivered.includes(id)).reduce((sum, id) => sum + count(id), 0);
      if (needed <= 0) continue;
      const filter = { ...input.filter, excludeIds: [...input.reserved, ...input.delivered] };
      const isBuild = this.typeId(job) === 'build';
      const found = units && this.items.findUnits !== undefined
        ? this.items.findUnits(filter, needed, from, !isBuild)
        : this.items.findItems(filter, needed, from);
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

  releaseReservations(job: Job): void {
    for (const input of job.inputs) {
      for (const it of input.reserved) this.releaseItem(it, job.id);
      input.reserved = [];
    }
    const tool = job.data['toolToFetch'];
    if (typeof tool === 'number' && tool !== 0) this.releaseItem(tool, job.id);
    delete job.data['toolToFetch'];
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

  /** Reservations kept for an interrupted job lapse after `RESERVE_KEEP_TICKS`. */
  private lapseReservations(): void {
    for (const id of this.ids) {
      const job = this.jobs.get(id) as Job;
      const until = job.data['reserveUntil'];
      if (job.state !== 'open' || typeof until !== 'number' || until > this.now) continue;
      this.releaseReservations(job);
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
   * `RESERVE_KEEP_TICKS`; a carried item is dropped where the worker stands.
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

  private eligible(job: Job, workerId: EntityId): boolean {
    const assigned = job.data['assignedWorker'];
    if (typeof assigned === 'number' && assigned !== 0 && assigned !== workerId) return false;
    const labor = this.jobLabor(job);
    if (!this.laborEnabled(workerId, labor)) return false;
    const minSkill = job.data['minSkill'];
    if (typeof minSkill === 'number' && this.skillFor(workerId, job) < minSkill) return false;
    if (this.toolHeldElsewhere(job, workerId, labor)) return false;
    return this.hasReachableStand(job, workerId);
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
    if (!this.reserveInputs(job, from)) {
      this.unclaim(job, 'missing_input');
      return false;
    }
    if (job.tool !== null && !this.items.hasTool(workerId, job.tool) && job.data['toolToFetch'] === undefined) {
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

  /** A worker died: its job returns to `open` with progress kept (`11` § Cancellation). */
  workerDied(workerId: EntityId): void {
    for (const id of this.ids) {
      const job = this.jobs.get(id) as Job;
      if (job.workerId !== workerId) continue;
      job.workerId = 0;
      job.state = 'open';
      this.invalidateWorkAvailability();
      delete job.data['standTile'];
    }
    const at = this.assignQueue.indexOf(workerId);
    if (at >= 0) this.assignQueue.splice(at, 1);
  }

  // ---------- the tick ----------

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
        this.retryBlocked();
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
    this.ids.length = 0;
    for (const j of state.jobs) {
      const job = structuredCopy(j);
      this.jobs.set(job.id, job);
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
    inputs: job.inputs.map((i) => ({ filter: { ...i.filter }, count: i.count, reserved: i.reserved.slice(), delivered: i.delivered.slice() })),
    data: { ...job.data },
  };
}
