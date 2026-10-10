/**
 * The dwarf brain: `algorithms/creature-brains.md` Â§ Dwarf brain and `10-dwarves.md` Â§ Behavior
 * selection and civilian activities (T-M4-06). Combat and patient controllers arrive in M6.
 *
 * ```
 * work:  jobs.stepWorker(id); when the worker is free again â†’ select
 *        (a worker still in 11's assignment queue waits; one 11 answered with nothing goes idle)
 * idle:  walk to the hearth hall, or the wagon tile, and wait IDLE_TICKS â†’ select
 * select: jobs.assign(id) â†’ work (answered by 11 later this tick), else idle
 * ```
 */

import { C, type Brain, type Needs } from '@core/components';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { hourOf } from '@core/calendar';
import { ADULT_AGE_YEARS, CIVILIAN_COMBAT_TIMEOUT_TICKS, CIVILIAN_FLEE_NODE_LIMIT, IDLE_TICKS, NEED_DEFER_PRIORITY, THREAT_RADIUS } from './constants';
import { CRITICAL, NEED_NAMES, WANT, type NeedName } from './needs';
import { Activities } from './activities';
import { PRIORITY_MAX, TICKS_PER_YEAR } from '@core/constants';
import type { BuildingsReader } from '@systems/buildings/reader';
import type { HealthReader } from '@systems/health/reader';
import type { JobsReader } from '@systems/jobs';
import type { CombatReader } from '@systems/combat/reader';
import { PERCEPTION_RADIUS } from '@systems/combat/constants';

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
  threatTile?(id: EntityId): TileIndex;
  clearThreat(id: EntityId): void;
  setCombatTarget(id: EntityId, targetId: EntityId): void;
  watchShelter?(id: EntityId, shutOut: boolean): void;
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
  if (b.targetTile < 0) b.targetTile = ctx.world.services.movement?.tileOf(id) ?? -1;
  b.activity = NO_JOB;
  if (!wasIdle) { ctx.emit({ type: 'DwarfIdle', id }); host.markIdle(id); }
}

/** Legal edges make the escape search obey stairs, ramps, corners, hatches and traffic. */
export function findFleeTile(ctx: TickContext, id: EntityId, threatId: EntityId): TileIndex {
  const map = ctx.world.map;
  const posA = ctx.world.entities.get(id, C.Position);
  const posT = ctx.world.entities.get(threatId, C.Position);
  if (!posA || !posT) return -1;
  const from = map.index(posA.x, posA.y, posA.z);
  const currentDist = Math.max(Math.abs(posA.x - posT.x), Math.abs(posA.y - posT.y));
  const creature = ctx.world.entities.get(id, C.Creature);
  const mover = { faction: creature?.faction, size: creature?.sizeClass };
  const combat = ctx.readers.has('16') ? ctx.readers.of<CombatReader>('16') : undefined;
  const occupied = (tile: TileIndex): boolean => ctx.readers.entities.at(tile)
    .some((other) => other === threatId || (combat?.isHostile(id, other) ?? false));
  const safer = (tile: TileIndex): boolean => map.zOf(tile) !== posT.z ||
    Math.max(Math.abs(map.xOf(tile) - posT.x), Math.abs(map.yOf(tile) - posT.y)) > currentDist;
  const hallTiles = ctx.readers.has('14') ? ctx.readers.of<BuildingsReader>('14').hearthHallTiles() : [];
  const hall = new Set(hallTiles.filter((tile) => tile !== from && safer(tile) && !occupied(tile) &&
    ctx.readers.pathing.passable(tile, 'walker', mover) && ctx.readers.pathing.reachable(from, tile, 'walker')));
  // Breadth first by legal step count, then tile index within a frontier.
  let frontier = [from];
  const seen = new Set([from]);
  let visited = 0;
  let fallback = -1;
  while (frontier.length > 0 && visited < CIVILIAN_FLEE_NODE_LIMIT) {
    const next: TileIndex[] = [];
    for (const tile of frontier) {
      if (visited >= CIVILIAN_FLEE_NODE_LIMIT) break;
      visited += 1;
      if (hall.has(tile)) return tile;
      if (fallback < 0 && tile !== from && safer(tile)) {
        fallback = tile;
        if (hall.size === 0) return tile;
      }
      for (const [to] of ctx.readers.pathing.edges(tile, 'walker', mover)) {
        if (seen.has(to) || occupied(to)) continue;
        seen.add(to);
        next.push(to);
      }
    }
    frontier = next.sort((a, b) => a - b);
  }
  if (hall.size > 0) {
    // A reachable hall remains the goal even when the bounded fallback cannot visit it.
    return [...hall].sort((a, b) => a - b)[0] as TileIndex;
  }
  return fallback;
}

function startFight(host: BrainHost, ctx: TickContext, id: EntityId, b: Brain, threatId: EntityId): void {
  if (b.activity !== 'Fighting') b.behaviorUntil = ctx.tick + CIVILIAN_COMBAT_TIMEOUT_TICKS;
  host.setCombatTarget(id, threatId);
  b.behavior = 'idle';
  b.targetTile = ctx.world.services.movement?.tileOf(id) ?? -1;
  b.activity = 'Fighting';
}

/** A new scan must not reset a cornered fighter's existing deadline. */
function fightExpired(ctx: TickContext, id: EntityId, threatId: EntityId, b: Brain): boolean {
  const mine = ctx.world.entities.get(id, C.Position);
  const theirs = ctx.world.entities.get(threatId, C.Position);
  const inReach = mine && theirs && mine.z === theirs.z &&
    Math.max(Math.abs(mine.x - theirs.x), Math.abs(mine.y - theirs.y)) <= 1;
  const engaged = ctx.readers.has('16') ? ctx.readers.of<CombatReader>('16').lastEngagementTick(id) : undefined;
  if (inReach) b.behaviorUntil = ctx.tick + CIVILIAN_COMBAT_TIMEOUT_TICKS;
  else if (engaged !== undefined) b.behaviorUntil = Math.max(b.behaviorUntil, engaged + CIVILIAN_COMBAT_TIMEOUT_TICKS);
  return ctx.tick >= b.behaviorUntil;
}

function hasHostileInSight(ctx: TickContext, id: EntityId): boolean {
  if (!ctx.readers.has('16')) return false;
  const combat = ctx.readers.of<CombatReader>('16');
  if (combat.targetOf(id) !== 0) return true;
  const pos = ctx.world.entities.get(id, C.Position);
  if (!pos) return false;
  const tileM = ctx.world.map.index(pos.x, pos.y, pos.z);
  const nearby = ctx.readers.spatial.inRadius(tileM, PERCEPTION_RADIUS, 'creature');
  for (const otherId of nearby) {
    if (otherId === id || !ctx.world.entities.alive(otherId)) continue;
    const h = ctx.world.entities.get(otherId, C.Hostile);
    if (h?.stealthed) continue;
    if (!combat.isHostile(id, otherId)) continue;
    const posO = ctx.world.entities.get(otherId, C.Position);
    if (!posO || Math.abs(pos.z - posO.z) > 2) continue;
    const dist = Math.max(Math.abs(pos.x - posO.x), Math.abs(pos.y - posO.y));
    if (dist > PERCEPTION_RADIUS) continue;
    const tileO = ctx.world.map.index(posO.x, posO.y, posO.z);
    if (combat.lineOfSight(tileM, tileO)) return true;
  }
  return false;
}

/**
 * `select(id)`, steps 7 and 9: a dwarf that already holds a job works it; otherwise it asks 11
 * (`jobs.assign(id)`, answered in 11's tick of this same tick) and waits in `work` for the answer.
 */
export function select(host: BrainHost, ctx: TickContext, id: EntityId, b: Brain): void {
  if (b.targetTile < 0) b.targetTile = ctx.world.services.movement?.tileOf(id) ?? -1;
  const civ = !ctx.readers.has('16') || !ctx.readers.of<{ onDuty(id: EntityId): boolean }>('16').onDuty(id);
  const threatId = host.threatOf(id);
  let avoidTile = -1;
  if (threatId !== 0 && civ) {
    const threatPos = ctx.world.entities.get(threatId, C.Position);
    const myPos = ctx.world.entities.get(id, C.Position);
    const needs = ctx.world.entities.get(id, C.Needs);
    const critical = needs !== undefined && ranked(needs, true).length > 0;
    const remembered = host.threatTile?.(id) ?? (threatPos === undefined ? -1 : ctx.world.map.index(threatPos.x, threatPos.y, threatPos.z));
    if (
      !ctx.world.entities.alive(threatId) ||
      !threatPos ||
      !myPos || remembered < 0
    ) {
      host.clearThreat(id);
    } else if (myPos.z === threatPos.z && Math.max(Math.abs(myPos.x - threatPos.x), Math.abs(myPos.y - threatPos.y)) <= THREAT_RADIUS &&
        !(b.behavior === 'flee' && critical)) {
      avoidTile = remembered;
      const fleeGoal = findFleeTile(ctx, id, threatId);
      if (fleeGoal >= 0) {
        if (b.activity === 'Fighting') host.setCombatTarget(id, 0);
        ctx.world.services.movement?.stopWalking(id);
        b.behavior = 'flee';
        b.targetTile = fleeGoal;
        b.activity = 'Fleeing';
        return;
      }
      const expired = b.activity === 'Fighting' && fightExpired(ctx, id, threatId, b);
      if (!critical && !expired) {
        startFight(host, ctx, id, b, threatId);
        return;
      }
      // Critical needs always leave a civilian fight, even when no resource is available.
      b.activity = NO_JOB;
      if (expired) { host.clearThreat(id); avoidTile = -1; }
      host.setCombatTarget(id, 0);
      ctx.world.services.movement?.stopWalking(id);
    } else {
      avoidTile = remembered;
    }
  }
  const safeTarget = avoidTile < 0 ? undefined : (tile: TileIndex): boolean => {
    const map = ctx.world.map;
    return tile >= 0 && (map.zOf(tile) !== map.zOf(avoidTile) ||
      Math.max(Math.abs(map.xOf(tile) - map.xOf(avoidTile)), Math.abs(map.yOf(tile) - map.yOf(avoidTile))) > THREAT_RADIUS);
  };

  const alert = ctx.readers.has('16')
    ? ctx.readers.of<{ alert(): string }>('16').alert()
    : ctx.world.fortress.alert;
  if (alert === 'hearth' && civ) {
    const target = ctx.readers.has('19') ? ctx.readers.of<{ retreatTile(id: EntityId): TileIndex }>('19').retreatTile(id) : host.idleGoal(id);
    host.watchShelter?.(id, target < 0);
    if (target >= 0) {
      b.behavior = 'retreat';
      b.targetTile = target;
      b.activity = 'Retreating';
      return;
    }
  } else host.watchShelter?.(id, false);

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
      b.targetTile = bedTile >= 0 ? bedTile : ctx.world.services.movement?.tileOf(id) ?? -1;
      b.activity = 'Resting in hospital';
      return;
    }
  }

  const n = ctx.world.entities.get(id, C.Needs);
  const schedule = ctx.world.entities.get(id, C.Schedule);
  const urgent = host.hasJobs && ctx.readers.of<JobsReader>('11').hasUrgent(id, NEED_DEFER_PRIORITY);
  if (n !== undefined) {
    for (const critical of ranked(n, true)) {
      if (host.activities.start(ctx, id, critical, b, host.idleGoal(id), host.dwarfIds())) {
        host.setCombatTarget(id, 0);
        return;
      }
    }
  }

  if (!civ) {
    const combat = ctx.readers.has('16') ? ctx.readers.of<CombatReader>('16') : undefined;
    const squad = combat?.squadOf(id);
    const alert = combat?.alert() ?? ctx.world.fortress.alert;
    const hostileInSight = hasHostileInSight(ctx, id);
    const hasOrder =
      squad !== undefined &&
      (squad.station !== null ||
        (squad.patrol !== null && squad.patrol.length > 0) ||
        squad.orders.length > 0);
    const dutyHolds =
      squad?.mode === 'active' && (hostileInSight || hasOrder || alert !== 'calm');
    if (dutyHolds) {
      b.behavior = 'duty';
      b.activity = 'On duty';
      b.targetTile = ctx.world.services.movement?.tileOf(id) ?? -1;
      return;
    }
    if (n !== undefined) {
      const sleepWindow = schedule !== undefined && hourOf(ctx.tick) === schedule.sleepStartHour && n.rest > 20;
      if (sleepWindow && host.activities.start(ctx, id, 'rest', b, host.idleGoal(id), host.dwarfIds(), safeTarget)) {
        host.setCombatTarget(id, 0);
        return;
      }
      for (const want of ranked(n, false)) {
        if (host.activities.start(ctx, id, want, b, host.idleGoal(id), host.dwarfIds(), safeTarget)) {
          host.setCombatTarget(id, 0);
          return;
        }
      }
    }
    b.behavior = 'duty';
    b.activity = 'On duty';
    b.targetTile = ctx.world.services.movement?.tileOf(id) ?? -1;
    return;
  }

  if (n !== undefined) {
    const sleepWindow = schedule !== undefined && hourOf(ctx.tick) === schedule.sleepStartHour && n.rest > 20;
    if (sleepWindow && host.activities.start(ctx, id, 'rest', b, host.idleGoal(id), host.dwarfIds(), safeTarget)) return;
  }

  if (n !== undefined && !urgent) {
    for (const want of ranked(n, false))
      if (host.activities.start(ctx, id, want, b, host.idleGoal(id), host.dwarfIds(), safeTarget)) return;
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
  if (ctx.readers.has('17') && !ctx.readers.of<{ isConscious(id: EntityId): boolean }>('17').isConscious(id)) {
    host.activities.cancel(ctx, id);
    return;
  }
  const b: Brain = { ...current };
  const movement = ctx.world.services.movement;
  const interrupted = host.takeInterrupt(id);
  // Alert/shelter changes interrupt even a running activity or job; flee still wins in select.
  if (interrupted && ctx.world.fortress.alert === 'hearth' && host.threatOf(id) === 0 &&
      (!ctx.readers.has('16') || !ctx.readers.of<{ onDuty(id: EntityId): boolean }>('16').onDuty(id)) &&
      ctx.readers.has('19') && ctx.readers.of<{ retreatTile(id: EntityId): TileIndex }>('19').retreatTile(id) >= 0) {
    host.activities.cancel(ctx, id);
    movement?.stopWalking(id);
    select(host, ctx, id, b);
    write(ctx, id, b);
    return;
  }
  let reselect = false;
  if (b.behavior === 'need' || b.behavior === 'social') {
    const currentNeed = NEED_NAMES.find((name) => name === host.activities.plans.get(id)?.need);
    const needs = ctx.world.entities.get(id, C.Needs);
    const critical = needs === undefined ? undefined : ranked(needs, true)[0];
    const keepCritical = currentNeed !== undefined && needs !== undefined &&
      CRITICAL[currentNeed] !== undefined && needs[currentNeed] >= (CRITICAL[currentNeed] as number);
    if (interrupted && host.threatOf(id) !== 0 && !keepCritical) {
      host.activities.cancel(ctx, id);
      reselect = true;
    } else if (interrupted && critical !== undefined && critical !== currentNeed) {
      host.activities.cancel(ctx, id);
      reselect = true;
    } else reselect = host.activities.step(ctx, id, b);
  } else if (b.behavior === 'retreat') {
    const civ = !ctx.readers.has('16') || !ctx.readers.of<{ onDuty(id: EntityId): boolean }>('16').onDuty(id);
    const alert = ctx.readers.has('16') ? ctx.readers.of<{ alert(): string }>('16').alert() : ctx.world.fortress.alert;
    if (alert !== 'hearth' || !civ || b.targetTile < 0 || (interrupted && host.threatOf(id) !== 0)) {
      reselect = true;
    } else if (movement !== null && b.targetTile >= 0 && movement.tileOf(id) !== b.targetTile) {
      const result = movement.walkTo(id, b.targetTile, 'flee', ctx);
      if (result === 'unreachable' && ctx.readers.has('19')) {
        b.targetTile = ctx.readers.of<{ retreatTile(id: EntityId): TileIndex }>('19').retreatTile(id);
        if (b.targetTile < 0) reselect = true;
      }
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
      (host.threatTile !== undefined && host.threatTile(id) < 0);
    if (threatGone) {
      host.clearThreat(id);
      reselect = true;
    } else if (movement !== null) {
      const myTile = movement.tileOf(id);
      if (myTile === b.targetTile || b.targetTile < 0) {
        reselect = true;
      } else {
        const outcome = movement.walkTo(id, b.targetTile, 'flee', ctx);
        if (outcome === 'unreachable') {
          const nextFleeTile = findFleeTile(ctx, id, threatId);
          if (nextFleeTile >= 0) {
            b.targetTile = nextFleeTile;
            movement.walkTo(id, nextFleeTile, 'flee', ctx);
          } else {
            reselect = true;
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
        b.activity = NO_JOB;
        reselect = true;
      } else {
        const escapeTile = findFleeTile(ctx, id, threatId);
        if (escapeTile >= 0) {
          host.setCombatTarget(id, 0);
          b.behavior = 'flee';
          b.targetTile = escapeTile;
          b.activity = 'Fleeing';
          movement?.stopWalking(id);
        } else {
          const needs = ctx.world.entities.get(id, C.Needs);
          const critical = needs !== undefined && ranked(needs, true).length > 0;
          if (fightExpired(ctx, id, threatId, b)) {
            host.clearThreat(id);
            host.setCombatTarget(id, 0);
            movement?.stopWalking(id);
            b.activity = NO_JOB;
            reselect = true;
          } else if (critical) {
            host.setCombatTarget(id, 0);
            movement?.stopWalking(id);
            reselect = true;
          }
        }
      }
    } else {
      const civ = !ctx.readers.has('16') || !ctx.readers.of<{ onDuty(id: EntityId): boolean }>('16').onDuty(id);
      // Without an idle anchor, "stay" follows the current position (including a teleport or
      // movement requested by another controller); it is not a return-to-spawn goal.
      if (movement !== null && movement.tileOf(id) !== b.targetTile &&
          movement.walkTarget(id) !== b.targetTile && host.idleGoal(id) < 0) {
        b.targetTile = movement.tileOf(id);
      }
      const hasWork = host.hasJobs && !host.dayOff(id) && ctx.readers.of<JobsReader>('11').hasWork(id);
      const onDuty = !civ;
      if (ctx.tick >= b.behaviorUntil || hasWork || onDuty) {
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
