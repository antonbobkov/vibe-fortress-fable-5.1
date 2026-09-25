/**
 * The dwarf brain: `algorithms/creature-brains.md` § Dwarf brain and `10-dwarves.md` § Behavior
 * selection and civilian activities (T-M4-06). Combat and patient controllers arrive in M6.
 *
 * ```
 * work:  jobs.stepWorker(id); when the worker is free again → select
 *        (a worker still in 11's assignment queue waits; one 11 answered with nothing goes idle)
 * idle:  walk to the hearth hall, or the wagon tile, and wait IDLE_TICKS → select
 * select: jobs.assign(id) → work (answered by 11 later this tick), else idle
 * ```
 */

import { C, type Brain, type Needs } from '@core/components';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { hourOf } from '@core/calendar';
import { ADULT_AGE_YEARS, IDLE_TICKS, NEED_DEFER_PRIORITY } from './constants';
import { CRITICAL, NEED_NAMES, WANT, type NeedName } from './needs';
import { Activities } from './activities';
import { PRIORITY_MAX, TICKS_PER_YEAR } from '@core/constants';
import type { JobsReader } from '@systems/jobs';

/** "Idle dwarves are shown as 'No job' in the units panel." */
export const NO_JOB = 'No job';

export interface BrainHost {
  /** True when 11 is present to ask for work. */
  readonly hasJobs: boolean;
  /** `hearthHallTile(id) or wagonTile`; -1 to idle in place. */
  idleGoal(id: EntityId): TileIndex;
  /** The display name of the dwarf's current job, or ''. */
  jobName(id: EntityId): string;
  activities: Activities;
  dayOff(id: EntityId): boolean;
  takeInterrupt(id: EntityId): boolean;
  dwarfIds(): EntityId[];
  idleAnnounced(id: EntityId): boolean;
  markIdle(id: EntityId): void;
  clearIdle(id: EntityId): void;
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
  const wasIdle = host.idleAnnounced(id);
  b.behavior = 'idle';
  b.behaviorUntil = ctx.tick + IDLE_TICKS;
  b.targetTile = host.idleGoal(id);
  b.activity = NO_JOB;
  if (!wasIdle) { ctx.emit({ type: 'DwarfIdle', id }); host.markIdle(id); }
}

/**
 * `select(id)`, steps 7 and 9: a dwarf that already holds a job works it; otherwise it asks 11
 * (`jobs.assign(id)`, answered in 11's tick of this same tick) and waits in `work` for the answer.
 */
export function select(host: BrainHost, ctx: TickContext, id: EntityId, b: Brain): void {
  const n = ctx.world.entities.get(id, C.Needs);
  const schedule = ctx.world.entities.get(id, C.Schedule);
  const urgent = host.hasJobs && ctx.readers.of<JobsReader>('11').hasUrgent(id, NEED_DEFER_PRIORITY);
  if (n !== undefined) {
    for (const critical of ranked(n, true))
      if (host.activities.start(ctx, id, critical, b, host.idleGoal(id), host.dwarfIds())) return;
    const sleepWindow = schedule !== undefined && hourOf(ctx.tick) === schedule.sleepStartHour && n.rest > 20;
    if (sleepWindow && host.activities.start(ctx, id, 'rest', b, host.idleGoal(id), host.dwarfIds())) return;
    if (!urgent) for (const want of ranked(n, false))
      if (host.activities.start(ctx, id, want, b, host.idleGoal(id), host.dwarfIds())) return;
  }
  const age = ctx.world.entities.get(id, C.Creature)?.ageTicks ?? ADULT_AGE_YEARS * TICKS_PER_YEAR;
  const child = age < ADULT_AGE_YEARS * TICKS_PER_YEAR;
  if (host.dayOff(id)) { startIdle(host, ctx, id, b); return; }
  if (jobIdOf(ctx, id) !== 0) {
    host.clearIdle(id);
    b.behavior = 'work';
    b.activity = host.jobName(id);
    return;
  }
  if (host.hasJobs && (!child || ctx.readers.of<JobsReader>('11').hasUrgent(id, PRIORITY_MAX))) {
    ctx.jobs.assign(id);
    b.behavior = 'work';
    b.behaviorUntil = ctx.tick;
    return;
  }
  startIdle(host, ctx, id, b);
}

/** First need above its threshold, ordered by excess over the threshold and then needs-table order. */
function ranked(n: Needs, critical: boolean): NeedName[] {
  return NEED_NAMES.filter((name) => {
    const threshold = critical ? CRITICAL[name] : WANT[name];
    return threshold !== undefined && n[name] >= threshold;
  }).sort((a, b) => {
    const ta = critical ? CRITICAL[a] as number : WANT[a];
    const tb = critical ? CRITICAL[b] as number : WANT[b];
    return n[b] - tb - (n[a] - ta) || NEED_NAMES.indexOf(a) - NEED_NAMES.indexOf(b);
  });
}

/** `tickDwarf(id)` for the behaviors of M1. */
export function tickDwarf(host: BrainHost, ctx: TickContext, id: EntityId): void {
  const current = ctx.world.entities.get(id, C.Brain);
  if (current === undefined) return;
  const b: Brain = { ...current };
  const movement = ctx.world.services.movement;
  const interrupted = host.takeInterrupt(id);
  let reselect = false;
  if (b.behavior === 'need' || b.behavior === 'social') {
    const currentNeed = host.activities.plans.get(id)?.need;
    const needs = ctx.world.entities.get(id, C.Needs);
    const critical = needs === undefined ? undefined : ranked(needs, true)[0];
    if (interrupted && critical !== undefined && critical !== currentNeed) {
      host.activities.cancel(ctx, id);
      reselect = true;
    } else reselect = host.activities.step(ctx, id, b);
  } else if (b.behavior === 'work') {
    if (jobIdOf(ctx, id) !== 0) {
      host.clearIdle(id);
      b.activity = host.jobName(id);
      ctx.jobs.stepWorker(id, ctx);
      reselect = jobIdOf(ctx, id) === 0;
    } else if (!(host.hasJobs && ctx.jobs.isQueued(id))) {
      // 11 answered and had nothing for this dwarf.
      startIdle(host, ctx, id, b);
    }
  } else if (b.behavior === 'idle') {
    const hasWork = host.hasJobs && !host.dayOff(id) && ctx.readers.of<JobsReader>('11').hasWork(id);
    if (ctx.tick >= b.behaviorUntil || hasWork) {
      reselect = true;
    } else if (movement !== null && b.targetTile >= 0 && movement.tileOf(id) !== b.targetTile) {
      movement.walkTo(id, b.targetTile, 'wander', ctx);
    }
  } else {
    reselect = true;
  }
  if (reselect || (interrupted && b.behavior !== 'need' && jobIdOf(ctx, id) === 0)) select(host, ctx, id, b);
  write(ctx, id, b);
}
