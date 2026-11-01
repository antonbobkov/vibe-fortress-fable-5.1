/**
 * Squads and orders: `02-systems/16-combat.md` § Squads, § Alerts.
 */

import { C, type Squad, type SquadOrder } from '@core/components';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import { SQUAD_MAX_COUNT, SQUAD_MAX_SIZE, TICKS_PER_YEAR } from '@core/constants';
import type { EntityStore } from '@core/entities';
import type { Registry } from '@core/registry';
import type { GameEvent } from '@core/events';
import { isSolidBottomed, type Map3D } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { Alert, EntityId, TileIndex } from '@core/types';
import { ADULT_AGE_YEARS } from '@systems/dwarves/constants';
import type { PathingReader } from '@core/readers';
import { PERCEPTION_RADIUS } from './constants';
import { isCreatureHostile } from './factions';
import type { TargetManager } from './targets';
import { getBarracksForSquad, isOnStationShift } from './training';

/**
 * Whether the squad controls a member now: not while its brain serves a need (travel to a bed and
 * sleep included), flees, retreats or is a patient (16 § Squads).
 */
function followsSquad(entities: EntityStore, id: EntityId): boolean {
  const behavior = entities.get(id, C.Brain)?.behavior;
  return behavior !== 'need' && behavior !== 'flee' && behavior !== 'retreat' && behavior !== 'patient';
}

export function isSquadEffectiveActive(squad: Squad, alert: Alert): boolean {
  if (alert === 'watchful' || alert === 'hearth') return true;
  return squad.mode === 'active' || squad.mode === 'train';
}

export function updateSquadDuty(entities: EntityStore, alert: Alert): void {
  for (const squadId of entities.with(C.Squad)) {
    const squad = entities.get(squadId, C.Squad);
    if (squad === undefined) continue;
    const effectiveActive = isSquadEffectiveActive(squad, alert);
    for (const memberId of squad.members) {
      const soldier = entities.get(memberId, C.Soldier);
      if (soldier !== undefined) {
        if (soldier.onDuty !== effectiveActive) {
          entities.add(memberId, C.Soldier, { ...soldier, onDuty: effectiveActive });
        }
      }
    }
  }
}

export function createSquad(entities: EntityStore, cmd: Command, alert: Alert, tick: number): CommandResult {
  const name = cmd['name'];
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 32) {
    return reject('bad_name');
  }

  const existingSquads = Array.from(entities.with(C.Squad));
  if (existingSquads.length >= SQUAD_MAX_COUNT) {
    return reject('squad_limit');
  }

  let leaderId = typeof cmd['leaderId'] === 'number' ? cmd['leaderId'] : 0;
  if (leaderId === 0 && existingSquads.length === 0) {
    // Default leader of the first squad is the Warden (if any)
    for (const dwarfId of entities.with(C.Title)) {
      if (entities.alive(dwarfId)) {
        const title = entities.get(dwarfId, C.Title);
        if (title?.title === 'warden') {
          leaderId = dwarfId;
          break;
        }
      }
    }
  } else if (leaderId !== 0) {
    if (!entities.alive(leaderId)) return reject('not_found');
    const creature = entities.get(leaderId, C.Creature);
    if (!creature || creature.ageTicks < ADULT_AGE_YEARS * TICKS_PER_YEAR) {
      return reject('not_adult');
    }
  }

  if (leaderId !== 0 && existingSquads.some((id) => entities.get(id, C.Squad)?.members.includes(leaderId))) return reject('already_in_squad');

  const squadId = entities.create('squad');
  const squad: Squad = {
    name: name.trim(),
    leaderId,
    members: leaderId === 0 ? [] : [leaderId],
    mode: 'off',
    station: null,
    patrol: null,
    equipment: { weaponClass: 'any', armor: 'any', ranged: false },
    orders: [],
    barracksZoneId: 0,
  };
  entities.add(squadId, C.Squad, squad);
  if (leaderId !== 0) {
    entities.add(leaderId, C.Soldier, { squadId, onDuty: isSquadEffectiveActive(squad, alert), stance: 'pursue', targetId: 0, cooldownUntil: 0, lastShiftTick: tick });
  }
  return OK;
}

export function disbandSquad(entities: EntityStore, cmd: Command): CommandResult {
  const squadId = cmd['squadId'] as EntityId;
  const squad = entities.get(squadId, C.Squad);
  if (squad === undefined) return reject('not_found');

  for (const memberId of squad.members) {
    if (entities.has(memberId, C.Soldier)) {
      entities.remove(memberId, C.Soldier);
    }
  }
  entities.destroy(squadId);
  return OK;
}

export function setSquadMembers(
  entities: EntityStore,
  cmd: Command,
  alert: Alert,
  tick: number,
): CommandResult {
  const squadId = cmd['squadId'] as EntityId;
  const squad = entities.get(squadId, C.Squad);
  if (squad === undefined) return reject('not_found');

  const rawMembers = cmd['members'];
  if (!Array.isArray(rawMembers)) return reject('bad_setting');
  if (rawMembers.length > SQUAD_MAX_SIZE) return reject('member_limit');

  const members: EntityId[] = [];
  for (const m of rawMembers) {
    if (typeof m !== 'number') return reject('bad_setting');
    if (!entities.alive(m)) return reject('not_found');
    const creature = entities.get(m, C.Creature);
    if (!creature || creature.ageTicks < ADULT_AGE_YEARS * TICKS_PER_YEAR) {
      return reject('not_adult');
    }

    for (const otherSquadId of entities.with(C.Squad)) {
      if (otherSquadId !== squadId) {
        const other = entities.get(otherSquadId, C.Squad);
        if (other?.members.includes(m)) return reject('already_in_squad');
      }
    }
    members.push(m);
  }

  const effectiveActive = isSquadEffectiveActive(squad, alert);

  // Remove Soldier component from dropped members
  for (const oldId of squad.members) {
    if (!members.includes(oldId)) {
      if (entities.has(oldId, C.Soldier)) {
        entities.remove(oldId, C.Soldier);
      }
    }
  }

  // Add or update Soldier component for new members
  for (const newId of members) {
    const existing = entities.get(newId, C.Soldier);
    if (existing === undefined) {
      entities.add(newId, C.Soldier, {
        squadId,
        onDuty: effectiveActive,
        stance: 'pursue',
        targetId: 0,
        cooldownUntil: 0,
        lastShiftTick: tick,
      });
    } else {
      entities.add(newId, C.Soldier, {
        ...existing,
        squadId,
        onDuty: effectiveActive,
      });
    }
  }

  squad.members = members;
  return OK;
}

export function setSquadLeader(entities: EntityStore, cmd: Command): CommandResult {
  const squadId = cmd['squadId'] as EntityId;
  const squad = entities.get(squadId, C.Squad);
  if (squad === undefined) return reject('not_found');

  const leaderId = cmd['leaderId'] as EntityId;
  if (typeof leaderId !== 'number') return reject('bad_setting');
  if (leaderId !== 0) {
    if (!entities.alive(leaderId) || !squad.members.includes(leaderId)) return reject('not_found');
    const creature = entities.get(leaderId, C.Creature);
    if (!creature || creature.ageTicks < ADULT_AGE_YEARS * TICKS_PER_YEAR) {
      return reject('not_adult');
    }
  }
  squad.leaderId = leaderId;
  return OK;
}

export function setSquadMode(entities: EntityStore, cmd: Command, alert: Alert): CommandResult {
  const squadId = cmd['squadId'] as EntityId;
  const squad = entities.get(squadId, C.Squad);
  if (squad === undefined) return reject('not_found');

  const mode = cmd['mode'];
  if (mode !== 'off' && mode !== 'train' && mode !== 'active') {
    return reject('bad_setting');
  }
  squad.mode = mode;
  updateSquadDuty(entities, alert);
  return OK;
}

export function setSquadEquipment(entities: EntityStore, cmd: Command, registry: Registry): CommandResult {
  const squadId = cmd['squadId'] as EntityId;
  const squad = entities.get(squadId, C.Squad);
  if (squad === undefined) return reject('not_found');

  const rawEquipment = cmd['equipment'];
  if (typeof rawEquipment !== 'object' || rawEquipment === null || Array.isArray(rawEquipment)) return reject('bad_setting');
  const equipment = rawEquipment as Record<string, unknown>;
  const weaponClass = equipment['weaponClass'];
  if (weaponClass !== undefined && weaponClass !== 'any' && !registry.table<{ id: string; weaponClass: string }>('weapons').rows.some((row) => row.weaponClass === weaponClass)) return reject('bad_setting');
  const armor = equipment['armor'];
  if (armor !== undefined && armor !== 'metal' && armor !== 'leather' && armor !== 'any') return reject('bad_setting');
  if (equipment['ranged'] !== undefined && typeof equipment['ranged'] !== 'boolean') return reject('bad_setting');
  squad.equipment = {
    ...squad.equipment,
    ...(rawEquipment as Partial<Squad['equipment']>),
  };
  return OK;
}

export function setSquadStation(
  map: Map3D,
  pathing: PathingReader,
  entities: EntityStore,
  cmd: Command,
): CommandResult {
  const squadId = cmd['squadId'] as EntityId;
  const squad = entities.get(squadId, C.Squad);
  if (squad === undefined) return reject('not_found');

  const tile = cmd['tile'] as TileIndex | null;
  if (tile !== null) {
    if (!map.validIndex(tile)) return reject('out_of_bounds');
    if (!pathing.passable(tile, 'walker')) return reject('bad_placement');
  }
  squad.station = tile;
  return OK;
}

export function setSquadPatrol(
  map: Map3D,
  pathing: PathingReader,
  entities: EntityStore,
  cmd: Command,
): CommandResult {
  const squadId = cmd['squadId'] as EntityId;
  const squad = entities.get(squadId, C.Squad);
  if (squad === undefined) return reject('not_found');

  const tiles = cmd['tiles'];
  if (!Array.isArray(tiles)) return reject('bad_setting');
  for (const t of tiles) {
    if (!map.validIndex(t)) return reject('out_of_bounds');
    if (!pathing.passable(t, 'walker')) return reject('bad_placement');
  }
  squad.patrol = tiles.length > 0 ? tiles.slice() : null;
  return OK;
}

export function squadOrder(
  map: Map3D,
  pathing: PathingReader,
  entities: EntityStore,
  targets: TargetManager,
  cmd: Command,
  emit: (event: GameEvent) => void,
): CommandResult {
  const squadId = cmd['squadId'] as EntityId;
  const squad = entities.get(squadId, C.Squad);
  if (squad === undefined) return reject('not_found');

  const order = cmd['order'] as SquadOrder | { kind: 'cancel' };
  if (typeof order !== 'object' || order === null) return reject('bad_setting');

  if (order.kind === 'cancel') {
    squad.orders = [];
    emit({ type: 'SquadOrderIssued', squadId, order });
    return OK;
  }
  if (order.kind === 'kill') {
    if (!entities.alive(order.targetId)) return reject('not_found');
    const standing = squad.orders.findIndex((queued) => queued.kind !== 'kill');
    squad.orders.splice(standing < 0 ? squad.orders.length : standing, 0, order);
    for (const m of squad.members) {
      const soldier = entities.get(m, C.Soldier);
      if (soldier?.onDuty && followsSquad(entities, m)) {
        const first = squad.orders[0];
        if (first?.kind === 'kill') targets.setTarget(m, first.targetId);
      }
    }
    emit({ type: 'SquadOrderIssued', squadId, order });
    return OK;
  }
  if (order.kind === 'station') {
    if (!map.validIndex(order.tile)) return reject('out_of_bounds');
    if (!pathing.passable(order.tile, 'walker')) return reject('bad_placement');
    squad.orders = squad.orders.filter((queued) => queued.kind === 'kill');
    squad.orders.push(order);
    emit({ type: 'SquadOrderIssued', squadId, order });
    return OK;
  }
  if (order.kind === 'patrol') {
    if (!Array.isArray(order.tiles) || order.tiles.length === 0) return reject('bad_setting');
    for (const t of order.tiles) {
      if (!map.validIndex(t)) return reject('out_of_bounds');
      if (!pathing.passable(t, 'walker')) return reject('bad_placement');
    }
    squad.orders = squad.orders.filter((queued) => queued.kind === 'kill');
    squad.orders.push(order);
    emit({ type: 'SquadOrderIssued', squadId, order });
    return OK;
  }
  if (order.kind === 'follow') {
    if (!entities.alive(order.dwarfId)) return reject('not_found');
    squad.orders = squad.orders.filter((queued) => queued.kind === 'kill');
    squad.orders.push(order);
    emit({ type: 'SquadOrderIssued', squadId, order });
    return OK;
  }
  return reject('bad_setting');
}

export function renameSquad(entities: EntityStore, cmd: Command): CommandResult {
  const squadId = cmd['squadId'] as EntityId;
  const squad = entities.get(squadId, C.Squad);
  if (squad === undefined) return reject('not_found');

  const name = cmd['name'];
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 32) {
    return reject('bad_name');
  }
  squad.name = name.trim();
  return OK;
}

/**
 * 16 § Squads: the posts around a station: the point, then outward on its level through tiles a walker can
 * stand on, nearest first and ties by index, without passing through a door. As many as `count`, if there are.
 */
function stationPosts(ctx: TickContext, point: TileIndex, count: number): TileIndex[] {
  const map = ctx.world.map;
  const pathing = ctx.readers.pathing;
  const doorAt = (t: TileIndex): boolean => ctx.readers.has('14') && ctx.readers.of<{ doorAt(i: TileIndex): boolean }>('14').doorAt(t);
  const posts = [point];
  const seen = new Set<TileIndex>(posts);
  let ring = posts;
  while (posts.length < count && ring.length > 0) {
    const next: TileIndex[] = [];
    for (const t of ring) {
      for (const n of map.neighbors8(t)) {
        if (seen.has(n)) continue;
        seen.add(n);
        if (isSolidBottomed(map.kindAt(n)) && pathing.passable(n, 'walker', { faction: 'fortress' }) && !doorAt(n)) next.push(n);
      }
    }
    next.sort((a, b) => a - b);
    posts.push(...next);
    ring = next;
  }
  return posts.slice(0, count);
}

function advancePatrol(
  entityId: EntityId,
  tiles: readonly TileIndex[],
  currentTile: TileIndex,
  patrolIndices: Map<EntityId, number>,
): TileIndex {
  if (tiles.length === 0) return currentTile;
  let idx = patrolIndices.get(entityId) ?? 0;
  if (idx >= tiles.length) idx = 0;
  if (currentTile === tiles[idx]) {
    idx = (idx + 1) % tiles.length;
    patrolIndices.set(entityId, idx);
  }
  return tiles[idx] ?? currentTile;
}

/**
 * A creature that is about to be destroyed leaves every squad's order queue: a target's death completes its
 * kill order and an escort's death ends its follow order, wherever the order stands in the queue.
 */
export function dropOrdersOf(entities: EntityStore, id: EntityId): void {
  for (const squadId of entities.with(C.Squad)) {
    const squad = entities.get(squadId, C.Squad);
    if (squad === undefined || squad.orders.length === 0) continue;
    const kept = squad.orders.filter((o) => !((o.kind === 'kill' && o.targetId === id) || (o.kind === 'follow' && o.dwarfId === id)));
    if (kept.length !== squad.orders.length) squad.orders = kept;
  }
}

export function stepSquads(
  ctx: TickContext,
  alert: Alert,
  targets: TargetManager,
  losFn: (from: TileIndex, to: TileIndex) => boolean,
  patrolIndices: Map<EntityId, number>,
): void {
  const entities = ctx.world.entities;
  const map = ctx.world.map;

  updateSquadDuty(entities, alert);

  for (const squadId of entities.with(C.Squad)) {
    const squad = entities.get(squadId, C.Squad);
    if (squad === undefined) continue;

    // Prune dead members
    squad.members = squad.members.filter((m) => entities.alive(m));
    if (squad.leaderId !== 0 && !entities.alive(squad.leaderId)) {
      squad.leaderId = 0;
    }

    // Prune completed orders
    while (squad.orders.length > 0) {
      const first = squad.orders[0];
      if (first !== undefined) {
        if (first.kind === 'kill') {
          if (!entities.alive(first.targetId)) {
            squad.orders.shift();
            continue;
          }
        } else if (first.kind === 'follow') {
          if (!entities.alive(first.dwarfId)) {
            squad.orders.shift();
            continue;
          }
        }
      }
      break;
    }

    const currentOrder = squad.orders.length > 0 ? squad.orders[0] : undefined;

    for (const m of squad.members) {
      const soldier = entities.get(m, C.Soldier);
      if (!soldier || !soldier.onDuty) continue;

      const posM = entities.get(m, C.Position);
      if (!posM) continue;
      const tileM = map.index(posM.x, posM.y, posM.z);

      // A soldier serving a need, fleeing, retreating or in hospital is not the squad's to move
      // or to give a target, a kill target included; the squad resumes control on its return to duty.
      if (!followsSquad(entities, m)) continue;

      // If already has an active target, keep engaging
      const activeTarget = targets.targetOf(m);
      if (activeTarget !== 0) continue;

      // Kill order takes precedence. A target out of perception is walked toward, since the
      // targeting of 16 drops a target beyond perception (§ Squads).
      if (currentOrder && currentOrder.kind === 'kill' && entities.alive(currentOrder.targetId)) {
        const posT = entities.get(currentOrder.targetId, C.Position);
        if (posT !== undefined && (Math.abs(posM.z - posT.z) > 2 ||
            Math.max(Math.abs(posM.x - posT.x), Math.abs(posM.y - posT.y)) > PERCEPTION_RADIUS)) {
          ctx.world.services.movement?.walkTo(m, map.index(posT.x, posT.y, posT.z), 'combat', ctx);
          continue;
        }
        targets.setTarget(m, currentOrder.targetId);
        continue;
      }

      // Perception scan: look for hostiles within PERCEPTION_RADIUS
      let closestHostile = 0;
      let closestDist = Infinity;

      const nearby = ctx.readers.spatial.inRadius(tileM, PERCEPTION_RADIUS, 'creature').filter((otherId) => {
        if (otherId === m || !entities.alive(otherId)) return false;
        const c = entities.get(otherId, C.Creature);
        if (!c) return false;
        const h = entities.get(otherId, C.Hostile);
        if (h?.stealthed) return false;
        return isCreatureHostile(entities, m, otherId, (e) => targets.targetOf(e));
      });

      for (const otherId of nearby) {
        const posO = entities.get(otherId, C.Position);
        if (!posO) continue;
        const dz = Math.abs(posM.z - posO.z);
        if (dz > 2) continue;
        const dx = Math.abs(posM.x - posO.x);
        const dy = Math.abs(posM.y - posO.y);
        const dist = Math.max(dx, dy);
        if (dist > PERCEPTION_RADIUS) continue;
        const tileO = map.index(posO.x, posO.y, posO.z);
        if (!losFn(tileM, tileO)) continue;
        if (dist < closestDist) {
          closestDist = dist;
          closestHostile = otherId;
        }
      }

      if (closestHostile !== 0) {
        targets.setTarget(m, closestHostile);
        continue;
      }

      // No hostile in perception: execute squad positioning

      let destTile: TileIndex | null = null;
      const memberIndex = Math.max(0, squad.members.slice().sort((a, b) => a - b).indexOf(m));
      const postOf = (point: TileIndex): TileIndex => {
        const posts = stationPosts(ctx, point, squad.members.length);
        return posts[memberIndex % posts.length] as TileIndex;
      };
      if (currentOrder) {
        if (currentOrder.kind === 'station') {
          destTile = postOf(currentOrder.tile);
        } else if (currentOrder.kind === 'patrol') {
          destTile = advancePatrol(m, currentOrder.tiles, tileM, patrolIndices);
        } else if (currentOrder.kind === 'follow') {
          const followPos = entities.get(currentOrder.dwarfId, C.Position);
          if (followPos) {
            destTile = map.index(followPos.x, followPos.y, followPos.z);
          }
        }
      } else if (squad.mode === 'train' && alert === 'calm') {
        const barracks = getBarracksForSquad(ctx, squadId, squad.barracksZoneId);
        const onStation = squad.station !== null && isOnStationShift(squad, m, ctx.tick);
        if (onStation && squad.station !== null) {
          destTile = postOf(squad.station);
        } else if (barracks && barracks.tiles.length > 0) {
          if (barracks.tiles.includes(tileM)) {
            destTile = tileM;
          } else {
            const sorted = squad.members.slice().sort((a, b) => a - b);
            const mIdx = sorted.indexOf(m);
            destTile = barracks.tiles[(mIdx >= 0 ? mIdx : 0) % barracks.tiles.length] ?? barracks.tiles[0] ?? null;
          }
        }
      } else if (squad.station !== null) {
        destTile = postOf(squad.station);
      } else if (squad.patrol !== null && squad.patrol.length > 0) {
        destTile = advancePatrol(m, squad.patrol, tileM, patrolIndices);
      } else if (ctx.readers.has('14')) {
        const barracks = getBarracksForSquad(ctx, squadId, squad.barracksZoneId);
        if (barracks && barracks.tiles.length > 0) {
          destTile = barracks.tiles[memberIndex % barracks.tiles.length] ?? null;
        }
      }

      if (destTile !== null && destTile !== tileM) {
        ctx.world.services.movement?.walkTo(m, destTile, 'combat', ctx);
      }
    }
  }
}
