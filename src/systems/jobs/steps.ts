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

import { C } from '@core/components';
import type { TickContext } from '@core/system';
import type { BuildingsReader } from '@systems/buildings';
import { grantXp } from '@systems/dwarves';
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

/**
 * Where fetched inputs go: the producer's delivery tile, the work tile, or, for an `adjacent` job
 * whose site cannot be stood on (a wall over open space), the worker's stand tile.
 */
function deliveryTile(board: JobBoard, job: Job, workerId: EntityId): TileIndex {
  const d = job.data['deliveryTile'];
  if (typeof d === 'number') return d;
  if (typeof job.workTile === 'number') return job.workTile;
  if (job.workTile === 'adjacent') return chooseStand(board, job, workerId);
  return board.anchorTile(job);
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
  const jobType = board.typeId(job);
  if (jobType === 'hunt' && job.state !== 'claimed' && job.state !== 'fetching') {
    stepHunt(board, job, workerId, ctx);
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
            board.releaseItem(target, job.id);
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
        const dest = deliveryTile(board, job, workerId);
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
      if (done >= required) {
        // F-17b: before the producer consumes, every delivered input must still be this job's.
        if (!board.revalidateDelivered(job)) {
          job.data['effort'] = required;
          job.progress = progressOf(required, required) - 1;
          board.refetch(job, workerId);
          return;
        }
        const producer = board.producers.find((p) => p.id === job.producer);
        // The work is done but the producer holds completion back (a creature on a wall's tile).
        if (producer?.canComplete?.(job) === false) {
          job.data['effort'] = required;
          job.progress = progressOf(required, required) - 1;
          return;
        }
      }
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

function stepHunt(board: JobBoard, job: Job, workerId: EntityId, ctx: TickContext): void {
  const entities = board.world.entities;
  const map = board.world.map;
  const targetId = job.target.ref;
  const movement = board.movement;

  // Case 1: Target is dead -> haul corpse to butcher's workshop
  if (!entities.alive(targetId)) {
    if (!job.data['killEmitted']) {
      job.data['killEmitted'] = true;
      ctx.emit({ type: 'HuntKill', hunterId: workerId, targetId });
      grantXp(entities, ctx.registry, workerId, 'hunting', 15, (e) => ctx.emit(e));
    }

    let corpseId = typeof job.data['corpseId'] === 'number' ? (job.data['corpseId'] as number) : 0;
    if (corpseId === 0 || !entities.alive(corpseId)) {
      const deathTile = typeof job.data['deathTile'] === 'number' ? (job.data['deathTile'] as number) : -1;
      for (const id of entities.with(C.Corpse, C.Item)) {
        if (deathTile >= 0 && board.items.tileOf(id) === deathTile) {
          corpseId = id;
          break;
        }
      }
      if (corpseId === 0) {
        for (const id of entities.with(C.Corpse, C.Item)) {
          corpseId = id;
          break;
        }
      }
      if (corpseId !== 0) {
        job.data['corpseId'] = corpseId;
      }
    }

    if (corpseId === 0) {
      complete(board, job, workerId, ctx);
      return;
    }

    const buildings = board.readers.has('14') ? board.readers.of<BuildingsReader>('14') : null;
    const workshops = buildings ? buildings.byType('butcher') : [];
    const builtWorkshop = workshops.find((id: EntityId) => buildings?.get(id)?.state === 'built');
    const destTile = builtWorkshop !== undefined ? (buildings?.get(builtWorkshop)?.origin ?? -1) : -1;

    const workerTile = board.workerTile(workerId);
    const carrying = board.workerOf(workerId).carrying;

    if (carrying === corpseId) {
      if (destTile >= 0) {
        if (workerTile === destTile) {
          board.items.dropAt(corpseId, destTile);
          board.setWorker(workerId, { carrying: 0 });
          complete(board, job, workerId, ctx);
          return;
        }
        if (movement === null || movement.walkTo(workerId, destTile, 'job', ctx) === 'unreachable') {
          board.items.dropAt(corpseId, workerTile);
          board.setWorker(workerId, { carrying: 0 });
          complete(board, job, workerId, ctx);
        }
      } else {
        board.items.dropAt(corpseId, workerTile);
        board.setWorker(workerId, { carrying: 0 });
        complete(board, job, workerId, ctx);
      }
      return;
    }

    // Not carrying yet
    const corpseTile = board.items.tileOf(corpseId);
    if (corpseTile < 0) {
      complete(board, job, workerId, ctx);
      return;
    }
    if (workerTile === corpseTile) {
      board.items.pickUp(corpseId, workerId);
      board.setWorker(workerId, { carrying: corpseId });
      return;
    }
    if (movement === null || movement.walkTo(workerId, corpseTile, 'job', ctx) === 'unreachable') {
      complete(board, job, workerId, ctx);
    }
    return;
  }

  // Case 2: Target is alive
  if (!board.items.hasTool(workerId, 'ranged')) {
    ctx.emit({ type: 'HuntAbandoned', hunterId: workerId, targetId, reason: 'no_ammo' });
    board.unclaim(job, 'no_tool');
    return;
  }

  if (!job.data['huntStarted']) {
    job.data['huntStarted'] = true;
    ctx.emit({ type: 'HuntStarted', hunterId: workerId, targetId });

    for (const petId of entities.with(C.Tame)) {
      const tame = entities.get(petId, C.Tame);
      if (tame && (tame.petOf === workerId || tame.assignedTo === workerId) && tame.trained === 'hunting') {
        board.world.services.combat?.setTarget(petId, targetId);
      }
    }
  }

  const posT = entities.get(targetId, C.Position);
  if (posT === undefined) {
    const lostTicks = (typeof job.data['lostTicks'] === 'number' ? (job.data['lostTicks'] as number) : 0) + 1;
    job.data['lostTicks'] = lostTicks;
    if (lostTicks >= 300) {
      ctx.emit({ type: 'HuntAbandoned', hunterId: workerId, targetId, reason: 'lost_target' });
      board.unclaim(job, 'unreachable');
    }
    return;
  }

  job.data['lostTicks'] = 0;
  const targetTile = map.index(posT.x, posT.y, posT.z);
  job.data['deathTile'] = targetTile;
  job.data['anchorTile'] = targetTile;

  const workerTile = board.workerTile(workerId);
  const equip = entities.get(workerId, C.Equipment);
  const worker = entities.get(workerId, C.Worker);
  const weaponId = equip && equip.weapon !== 0 ? equip.weapon : worker && worker.toolId !== 0 ? worker.toolId : 0;
  let range = 12;
  if (weaponId !== 0) {
    const item = entities.get(weaponId, C.Item);
    if (item) {
      const itemRow = ctx.registry.table<{ id: string }>('items').byIndex(item.type);
      if (itemRow) {
        const weaponRow = ctx.registry.table<{ id: string; launcher?: { range: number } }>('weapons').byId(itemRow.id);
        if (weaponRow?.launcher?.range) range = weaponRow.launcher.range;
      }
    }
  }

  const dist =
    Math.max(
      Math.abs(map.xOf(workerTile) - posT.x),
      Math.abs(map.yOf(workerTile) - posT.y),
    ) + Math.abs(map.zOf(workerTile) - posT.z) * 2;

  const hasLos = board.world.services.combat?.lineOfSight(workerTile, targetTile) ?? false;

  if (dist <= range && hasLos) {
    movement?.stopWalking(workerId);
    const fired = board.world.services.combat?.fireAt(workerId, targetId);
    if (fired) {
      grantXp(entities, ctx.registry, workerId, 'hunting', 5, (e) => ctx.emit(e));
    }
  } else {
    if (movement === null || movement.walkTo(workerId, targetTile, 'job', ctx) === 'unreachable') {
      const lostTicks = (typeof job.data['lostTicks'] === 'number' ? (job.data['lostTicks'] as number) : 0) + 1;
      job.data['lostTicks'] = lostTicks;
      if (lostTicks >= 300) {
        ctx.emit({ type: 'HuntAbandoned', hunterId: workerId, targetId, reason: 'unreachable' });
        board.unclaim(job, 'unreachable');
      }
    }
  }
}
