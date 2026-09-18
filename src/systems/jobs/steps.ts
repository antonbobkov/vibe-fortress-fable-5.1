/**
 * Job steps: `02-systems/11-jobs-and-labor.md` § Job steps and `algorithms/jobs-and-hauling.md`
 * § Job steps (driven by 10 through `jobs.stepWorker`).
 *
 * ```
 * claimed → fetching (tool, inputs) → travelling → working → completing → done
 * ```
 *
 * Work is counted as effort (D-055): `(100 + SKILL_TIME_BONUS_PERCENT × skill) × productivity`
 * per tick against `baseTicks × 100 × 100`, so a job takes exactly its documented time.
 */

import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { effortPerTick, effortRequired, estDistance, progressOf } from './assign';
import type { JobBoard } from './board';
import { SKILL_TIME_BONUS_PERCENT } from './constants';
import type { Job } from './state';

/** The work time of a job in hundredths of a tick: the producer's, or the type's numeric `baseTicks`. */
export function workCentiTicks(board: JobBoard, job: Job): number {
  const producer = board.producers.find((p) => p.id === job.producer);
  const fromProducer = producer?.workCentiTicks?.(job);
  if (fromProducer !== undefined) return fromProducer;
  const base = board.typeRow(job).baseTicks;
  return typeof base === 'number' ? base * 100 : 100;
}

/** The next input item still to fetch, or 0. */
function nextUndelivered(job: Job): EntityId {
  for (const input of job.inputs) {
    for (const it of input.reserved) if (!input.delivered.includes(it)) return it;
  }
  return 0;
}

function pendingWork(job: Job): boolean {
  const tool = job.data['toolToFetch'];
  return (typeof tool === 'number' && tool !== 0) || nextUndelivered(job) !== 0;
}

/** Where fetched inputs go: the producer's delivery tile, or the work tile. */
function deliveryTile(job: Job): TileIndex {
  const d = job.data['deliveryTile'];
  if (typeof d === 'number') return d;
  return typeof job.workTile === 'number' ? job.workTile : job.target.ref;
}

/**
 * The stand tile for `travelling`: `t = nearest walkable 8-neighbor of target with the worker's
 * label` for `adjacent` (nearest by estimated distance from the worker, ties by tile index).
 */
export function chooseStand(board: JobBoard, job: Job, workerId: EntityId): TileIndex {
  const kept = job.data['standTile'];
  const stands = board.reachableStands(job, workerId);
  if (typeof kept === 'number' && stands.includes(kept)) return kept;
  if (stands.length === 0) return -1;
  const map = board.world.map;
  const from = map.unpack(board.workerTile(workerId));
  let best = stands[0] as TileIndex;
  let bestD = estDistance(from, map.unpack(best));
  for (let k = 1; k < stands.length; k += 1) {
    const t = stands[k] as TileIndex;
    const d = estDistance(from, map.unpack(t));
    if (d < bestD) {
      best = t;
      bestD = d;
    }
  }
  job.data['standTile'] = best;
  return best;
}

/** `jobs.stepWorker(id, ctx)`. */
export function stepWorker(board: JobBoard, workerId: EntityId, ctx: TickContext): void {
  const worker = board.workerOf(workerId);
  if (worker.jobId === 0) return;
  const job = board.jobs.get(worker.jobId);
  if (job === undefined || job.workerId !== workerId) {
    board.setWorker(workerId, { jobId: 0, phase: 0 });
    return;
  }
  const movement = board.movement;
  switch (job.state) {
    case 'claimed':
      job.state = pendingWork(job) ? 'fetching' : 'travelling';
      board.setWorker(workerId, { phase: 0 });
      return;
    case 'fetching': {
      const toolId = job.data['toolToFetch'];
      const target = typeof toolId === 'number' && toolId !== 0 ? toolId : nextUndelivered(job);
      if (target === 0) {
        job.state = 'travelling';
        return;
      }
      const carrying = board.workerOf(workerId).carrying;
      if (carrying === 0) {
        const at = board.items.tileOf(target);
        if (at === board.workerTile(workerId)) {
          if (target === toolId) {
            board.items.equip(workerId, target);
            board.setWorker(workerId, { toolId: target });
            // Held now: the fetch reservation ends; the worker keeps the tool after the job (11 § Assignment).
            board.items.release(target);
            delete job.data['toolToFetch'];
            ctx.emit({ type: 'ToolEquipped', dwarfId: workerId, itemId: target });
          } else {
            board.items.pickUp(target, workerId);
            board.setWorker(workerId, { carrying: target });
          }
        } else if (movement === null || movement.walkTo(workerId, at, 'job', ctx) === 'unreachable') {
          board.unclaim(job, 'unreachable');
        }
      } else {
        const dest = deliveryTile(job);
        if (board.workerTile(workerId) === dest) {
          board.items.dropAt(carrying, dest);
          for (const input of job.inputs) if (input.reserved.includes(carrying)) input.delivered.push(carrying);
          board.setWorker(workerId, { carrying: 0 });
        } else if (movement === null || movement.walkTo(workerId, dest, 'job', ctx) === 'unreachable') {
          board.unclaim(job, 'unreachable');
        }
      }
      if (job.state === 'fetching' && !pendingWork(job) && board.workerOf(workerId).carrying === 0) job.state = 'travelling';
      return;
    }
    case 'travelling': {
      const stand = chooseStand(board, job, workerId);
      if (stand < 0) {
        board.unclaim(job, 'unreachable');
        return;
      }
      if (board.workerTile(workerId) === stand) {
        movement?.stopWalking(workerId);
        job.state = 'working';
        ctx.emit({ type: 'JobStarted', jobId: job.id, jobType: board.typeId(job), workerId, target: job.target.ref });
        return;
      }
      if (movement === null || movement.walkTo(workerId, stand, 'job', ctx) === 'unreachable') {
        board.unclaim(job, 'unreachable');
      }
      return;
    }
    case 'working': {
      const required = effortRequired(workCentiTicks(board, job));
      const done = (typeof job.data['effort'] === 'number' ? (job.data['effort'] as number) : 0) +
        effortPerTick(SKILL_TIME_BONUS_PERCENT, board.skillFor(workerId, job), board.productivity(workerId));
      job.data['effort'] = done;
      job.progress = progressOf(done, required);
      if (done < required) return;
      job.state = 'completing';
      complete(board, job, workerId, ctx);
      return;
    }
    case 'completing':
      complete(board, job, workerId, ctx);
      return;
    case 'open':
    case 'blocked':
    case 'cancelled':
    case 'done':
      board.setWorker(workerId, { jobId: 0, phase: 0 });
      return;
    default:
      return;
  }
}

/**
 * `completing`: `producer(job).onComplete(job, ctx)`; release the reservations of consumed inputs;
 * `done`; the worker becomes free; `JobCompleted`. Experience is 10's, on `JobCompleted`.
 */
function complete(board: JobBoard, job: Job, workerId: EntityId, ctx: TickContext): void {
  const producer = board.producers.find((p) => p.id === job.producer);
  producer?.onComplete?.(job, ctx);
  board.releaseReservations(job);
  job.state = 'done';
  job.progress = 1000;
  board.setWorker(workerId, { jobId: 0, phase: 0 });
  board.finish(job);
  const event = { type: 'JobCompleted' as const, jobId: job.id, jobType: board.typeId(job), workerId, target: job.target.ref };
  ctx.emit(event);
  producer?.onJobEvent?.(event);
}
