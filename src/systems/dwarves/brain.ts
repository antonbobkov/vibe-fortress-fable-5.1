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
import { ADULT_AGE_YEARS, IDLE_TICKS, NEED_DEFER_PRIORITY, THREAT_RADIUS } from './constants';
import { CRITICAL, NEED_NAMES, WANT, type NeedName } from './needs';
import { Activities } from './activities';
import { PRIORITY_MAX, TICKS_PER_YEAR } from '@core/constants';
import type { BuildingsReader } from '@systems/buildings/reader';
import type { HealthReader } from '@systems/health/reader';
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
  threatOf(id: EntityId): EntityId;
  clearThreat(id: EntityId): void;
  setCombatTarget(id: EntityId, targetId: EntityId): void;
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

const FLEE_STEPS = 6;
const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

export function findFleeTile(ctx: TickContext, id: EntityId, threatId: EntityId): TileIndex {
  const map = ctx.world.map;
  const posA = ctx.world.entities.get(id, C.Position);
  const posT = ctx.world.entities.get(threatId, C.Position);
  if (!posA || !posT) return -1;
  const currentDist = Math.max(Math.abs(posA.x - posT.x), Math.abs(posA.y - posT.y));
  let bestDist = currentDist;
  let bestTile = -1;

  for (const [dx, dy] of DIRECTIONS) {
    for (let step = 1; step <= FLEE_STEPS; step += 1) {
      const nx = posA.x + dx * step;
      const ny = posA.y + dy * step;
      const z = posA.z;
      if (!map.inBounds(nx, ny, z)) break;
      const tile = map.index(nx, ny, z);
      if (!ctx.readers.pathing.passable(tile, 'walker')) break;
      const dist = Math.max(Math.abs(posT.x - nx), Math.abs(posT.y - ny));
      if (dist > bestDist) {
        bestDist = dist;
        bestTile = tile;
      }
    }
  }
  return bestTile;
}

/**
 * `select(id)`, steps 7 and 9: a dwarf that already holds a job works it; otherwise it asks 11
 * (`jobs.assign(id)`, answered in 11's tick of this same tick) and waits in `work` for the answer.
 */
export function select(host: BrainHost, ctx: TickContext, id: EntityId, b: Brain): void {
  const civ = !ctx.readers.has('16') || !ctx.readers.of<{ onDuty(id: EntityId): boolean }>('16').onDuty(id);
  const threatId = host.threatOf(id);
  if (threatId !== 0 && civ) {
    const threatPos = ctx.world.entities.get(threatId, C.Position);
    const myPos = ctx.world.entities.get(id, C.Position);
    if (
      !ctx.world.entities.alive(threatId) ||
      !threatPos ||
      !myPos ||
      myPos.z !== threatPos.z ||
      Math.max(Math.abs(myPos.x - threatPos.x), Math.abs(myPos.y - threatPos.y)) > THREAT_RADIUS
    ) {
      host.clearThreat(id);
    } else {
      const fleeGoal = findFleeTile(ctx, id, threatId);
      if (fleeGoal >= 0) {
        b.behavior = 'flee';
        b.targetTile = fleeGoal;
        b.activity = 'Fleeing';
        return;
      }
      // Cornered: fight back with weapon/tool
      host.setCombatTarget(id, threatId);
      b.behavior = 'idle';
      b.targetTile = -1;
      b.activity = 'Fighting';
      return;
    }
  }

  const alert = ctx.readers.has('16')
    ? ctx.readers.of<{ alert(): string }>('16').alert()
    : ctx.world.fortress.alert;
  if (alert === 'hearth' && civ) {
    b.behavior = 'retreat';
    b.targetTile = host.idleGoal(id);
    b.activity = 'Retreating';
    return;
  }

  if (ctx.readers.has('17') && ctx.readers.of<HealthReader>('17').isPatient(id)) {
    const conscious = ctx.readers.of<HealthReader>('17').isConscious(id);
    if (conscious) {
      const patient = ctx.world.entities.get(id, C.Patient);
      let bedTile = -1;
      if (patient && patient.bedId !== 0 && ctx.readers.has('14')) {
        const bView = ctx.readers.of<BuildingsReader>('14').get(patient.bedId);
        if (bView) bedTile = bView.origin;
      }
      if (bedTile < 0 && ctx.readers.has('14')) {
        const buildings = ctx.readers.of<BuildingsReader>('14');
        const hospZones = buildings.zonesOfType('hospital');
        for (const hz of hospZones) {
          const z = buildings.zone(hz);
          if (!z) continue;
          for (const t of z.tiles) {
            const bId = buildings.at(t);
            if (bId !== 0 && buildings.get(bId)?.typeId === 'bed') {
              bedTile = t;
              break;
            }
          }
          if (bedTile >= 0) break;
        }
        if (bedTile < 0) {
          const bedId = buildings.freeBeds()[0];
          if (bedId) bedTile = buildings.get(bedId)?.origin ?? -1;
        }
      }
      b.behavior = 'patient';
      b.targetTile = bedTile;
      b.activity = 'Resting in hospital';
      return;
    }
  }

  const n = ctx.world.entities.get(id, C.Needs);
  const schedule = ctx.world.entities.get(id, C.Schedule);
  const urgent = host.hasJobs && ctx.readers.of<JobsReader>('11').hasUrgent(id, NEED_DEFER_PRIORITY);
  if (n !== undefined) {
    for (const critical of ranked(n, true))
      if (host.activities.start(ctx, id, critical, b, host.idleGoal(id), host.dwarfIds())) return;
    const sleepWindow = schedule !== undefined && hourOf(ctx.tick) === schedule.sleepStartHour && n.rest > 20;
    if (sleepWindow && host.activities.start(ctx, id, 'rest', b, host.idleGoal(id), host.dwarfIds())) return;
  }

  if (!civ) {
    b.behavior = 'duty';
    b.activity = 'On duty';
    b.targetTile = -1;
    return;
  }

  if (n !== undefined && !urgent) {
    for (const want of ranked(n, false))
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
  const canWork = !ctx.readers.has('17') || ctx.readers.of<{ canWork(id: EntityId): boolean }>('17').canWork(id);
  if (canWork && host.hasJobs && (!child || ctx.readers.of<JobsReader>('11').hasUrgent(id, PRIORITY_MAX))) {
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
  if (ctx.readers.has('17') && !ctx.readers.of<{ isConscious(id: EntityId): boolean }>('17').isConscious(id)) return;
  const b: Brain = { ...current };
  const movement = ctx.world.services.movement;
  const interrupted = host.takeInterrupt(id);
  let reselect = false;
  if (b.behavior === 'need' || b.behavior === 'social') {
    const currentNeed = host.activities.plans.get(id)?.need;
    const needs = ctx.world.entities.get(id, C.Needs);
    const critical = needs === undefined ? undefined : ranked(needs, true)[0];
    if (interrupted && host.threatOf(id) !== 0) {
      host.activities.cancel(ctx, id);
      reselect = true;
    } else if (interrupted && critical !== undefined && critical !== currentNeed) {
      host.activities.cancel(ctx, id);
      reselect = true;
    } else reselect = host.activities.step(ctx, id, b);
  } else if (b.behavior === 'retreat') {
    const civ = !ctx.readers.has('16') || !ctx.readers.of<{ onDuty(id: EntityId): boolean }>('16').onDuty(id);
    const alert = ctx.readers.has('16') ? ctx.readers.of<{ alert(): string }>('16').alert() : ctx.world.fortress.alert;
    if (alert !== 'hearth' || !civ) {
      reselect = true;
    } else if (movement !== null && b.targetTile >= 0 && movement.tileOf(id) !== b.targetTile) {
      movement.walkTo(id, b.targetTile, 'flee', ctx);
    }
  } else if (b.behavior === 'patient') {
    const isPatient = ctx.readers.has('17') && ctx.readers.of<HealthReader>('17').isPatient(id);
    if (!isPatient) {
      reselect = true;
    } else if (movement !== null) {
      const myTile = movement.tileOf(id);
      if (b.targetTile >= 0 && myTile !== b.targetTile) {
        movement.walkTo(id, b.targetTile, 'job', ctx);
      } else {
        const needs = ctx.world.entities.get(id, C.Needs);
        if (needs !== undefined && needs.rest > 0) {
          needs.rest = Math.max(0, needs.rest - 1);
        }
      }
    }
  } else if (b.behavior === 'duty') {
    const civ = !ctx.readers.has('16') || !ctx.readers.of<{ onDuty(id: EntityId): boolean }>('16').onDuty(id);
    if (civ) {
      reselect = true;
    }
  } else if (b.behavior === 'work') {
    const civ = !ctx.readers.has('16') || !ctx.readers.of<{ onDuty(id: EntityId): boolean }>('16').onDuty(id);
    if ((interrupted && host.threatOf(id) !== 0) || !civ) {
      reselect = true;
    } else if (jobIdOf(ctx, id) !== 0) {
      host.clearIdle(id);
      b.activity = host.jobName(id);
      ctx.jobs.stepWorker(id, ctx);
      reselect = jobIdOf(ctx, id) === 0;
    } else if (!(host.hasJobs && ctx.jobs.isQueued(id))) {
      // 11 answered and had nothing for this dwarf.
      startIdle(host, ctx, id, b);
    }
  } else if (b.behavior === 'flee') {
    const threatId = host.threatOf(id);
    const threatPos = threatId !== 0 ? ctx.world.entities.get(threatId, C.Position) : undefined;
    const myPos = ctx.world.entities.get(id, C.Position);
    const threatGone = threatId === 0 || !ctx.world.entities.alive(threatId) || !threatPos || !myPos ||
      myPos.z !== threatPos.z || Math.max(Math.abs(myPos.x - threatPos.x), Math.abs(myPos.y - threatPos.y)) > THREAT_RADIUS;
    if (threatGone) {
      host.clearThreat(id);
      reselect = true;
    } else if (movement !== null) {
      const myTile = movement.tileOf(id);
      if (myTile === b.targetTile || b.targetTile < 0) {
        const nextFleeTile = findFleeTile(ctx, id, threatId);
        if (nextFleeTile >= 0) {
          b.targetTile = nextFleeTile;
          movement.walkTo(id, nextFleeTile, 'flee', ctx);
        } else {
          host.setCombatTarget(id, threatId);
          b.behavior = 'idle';
          b.targetTile = -1;
          b.activity = 'Fighting';
        }
      } else {
        const outcome = movement.walkTo(id, b.targetTile, 'flee', ctx);
        if (outcome === 'unreachable') {
          const nextFleeTile = findFleeTile(ctx, id, threatId);
          if (nextFleeTile >= 0) {
            b.targetTile = nextFleeTile;
            movement.walkTo(id, nextFleeTile, 'flee', ctx);
          } else {
            host.setCombatTarget(id, threatId);
            b.behavior = 'idle';
            b.targetTile = -1;
            b.activity = 'Fighting';
          }
        }
      }
    }
  } else if (b.behavior === 'idle') {
    if (b.activity === 'Fighting') {
      const threatId = host.threatOf(id);
      const threatPos = threatId !== 0 ? ctx.world.entities.get(threatId, C.Position) : undefined;
      const myPos = ctx.world.entities.get(id, C.Position);
      const threatGone = threatId === 0 || !ctx.world.entities.alive(threatId) || !threatPos || !myPos ||
        myPos.z !== threatPos.z || Math.max(Math.abs(myPos.x - threatPos.x), Math.abs(myPos.y - threatPos.y)) > THREAT_RADIUS;
      if (threatGone) {
        host.clearThreat(id);
        host.setCombatTarget(id, 0);
        reselect = true;
      } else {
        const escapeTile = findFleeTile(ctx, id, threatId);
        if (escapeTile >= 0) {
          host.setCombatTarget(id, 0);
          b.behavior = 'flee';
          b.targetTile = escapeTile;
          b.activity = 'Fleeing';
        }
      }
    } else {
      const civ = !ctx.readers.has('16') || !ctx.readers.of<{ onDuty(id: EntityId): boolean }>('16').onDuty(id);
      const alert = ctx.readers.has('16') ? ctx.readers.of<{ alert(): string }>('16').alert() : ctx.world.fortress.alert;
      const hasWork = host.hasJobs && !host.dayOff(id) && ctx.readers.of<JobsReader>('11').hasWork(id);
      const onDuty = !civ;
      const retreat = alert === 'hearth' && civ;
      if (ctx.tick >= b.behaviorUntil || hasWork || onDuty || retreat) {
        reselect = true;
      } else if (movement !== null && b.targetTile >= 0 && movement.tileOf(id) !== b.targetTile) {
        movement.walkTo(id, b.targetTile, 'wander', ctx);
      }
    }
  } else {
    reselect = true;
  }
  if (reselect || (interrupted && b.behavior !== 'need' && jobIdOf(ctx, id) === 0)) select(host, ctx, id, b);
  write(ctx, id, b);
}
