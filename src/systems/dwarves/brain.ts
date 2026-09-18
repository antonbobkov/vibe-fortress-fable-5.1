/**
 * The dwarf brain: `algorithms/creature-brains.md` § Dwarf brain and `10-dwarves.md` § Behavior
 * selection, steps 7 (`work`) and 9 (`idle`) only (T-M1-09); flee, retreat, patient, needs, duty
 * and social join in M4 and M6.
 *
 * ```
 * work:  jobs.stepWorker(id); when the worker is free again → select
 *        (a worker still in 11's assignment queue waits; one 11 answered with nothing goes idle)
 * idle:  walk to the hearth hall, or the wagon tile, and wait IDLE_TICKS → select
 * select: jobs.assign(id) → work (answered by 11 later this tick), else idle
 * ```
 */

import { C, type Brain } from '@core/components';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { IDLE_TICKS } from './constants';

/** "Idle dwarves are shown as 'No job' in the units panel." */
export const NO_JOB = 'No job';

export interface BrainHost {
  /** True when 11 is present to ask for work. */
  readonly hasJobs: boolean;
  /** `hearthHallTile(id) or wagonTile`; -1 to idle in place. */
  idleGoal(id: EntityId): TileIndex;
  /** The display name of the dwarf's current job, or ''. */
  jobName(id: EntityId): string;
}

function write(ctx: TickContext, id: EntityId, brain: Brain): void {
  ctx.world.entities.add(id, C.Brain, brain);
}

function jobIdOf(ctx: TickContext, id: EntityId): number {
  return ctx.world.entities.get(id, C.Worker)?.jobId ?? 0;
}

/** Step 9: "go to the hearth hall and wait `IDLE_TICKS`, then re-evaluate"; `DwarfIdle` on entry. */
function startIdle(host: BrainHost, ctx: TickContext, id: EntityId, b: Brain): void {
  // Throttled: once per stretch without a job (asking 11 again keeps the activity text).
  const wasIdle = b.activity === NO_JOB;
  b.behavior = 'idle';
  b.behaviorUntil = ctx.tick + IDLE_TICKS;
  b.targetTile = host.idleGoal(id);
  b.activity = NO_JOB;
  if (!wasIdle) ctx.emit({ type: 'DwarfIdle', id });
}

/**
 * `select(id)`, steps 7 and 9: a dwarf that already holds a job works it; otherwise it asks 11
 * (`jobs.assign(id)`, answered in 11's tick of this same tick) and waits in `work` for the answer.
 */
export function select(host: BrainHost, ctx: TickContext, id: EntityId, b: Brain): void {
  if (jobIdOf(ctx, id) !== 0) {
    b.behavior = 'work';
    b.activity = host.jobName(id);
    return;
  }
  if (host.hasJobs) {
    ctx.jobs.assign(id);
    b.behavior = 'work';
    b.behaviorUntil = ctx.tick;
    return;
  }
  startIdle(host, ctx, id, b);
}

/** `tickDwarf(id)` for the behaviors of M1. */
export function tickDwarf(host: BrainHost, ctx: TickContext, id: EntityId): void {
  const current = ctx.world.entities.get(id, C.Brain);
  if (current === undefined) return;
  const b: Brain = { ...current };
  const movement = ctx.world.services.movement;
  let reselect = false;
  if (b.behavior === 'work') {
    if (jobIdOf(ctx, id) !== 0) {
      b.activity = host.jobName(id);
      ctx.jobs.stepWorker(id, ctx);
      reselect = jobIdOf(ctx, id) === 0;
    } else if (!(host.hasJobs && ctx.jobs.isQueued(id))) {
      // 11 answered and had nothing for this dwarf.
      startIdle(host, ctx, id, b);
    }
  } else if (b.behavior === 'idle') {
    if (ctx.tick >= b.behaviorUntil) {
      reselect = true;
    } else if (movement !== null && b.targetTile >= 0 && movement.tileOf(id) !== b.targetTile) {
      movement.walkTo(id, b.targetTile, 'wander', ctx);
    }
  } else {
    reselect = true;
  }
  if (reselect) select(host, ctx, id, b);
  write(ctx, id, b);
}
