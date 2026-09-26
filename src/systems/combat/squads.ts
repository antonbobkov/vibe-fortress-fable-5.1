/**
 * Squads and orders: `02-systems/16-combat.md` § Squads, § Alerts.
 */

import { C, type Squad, type SquadOrder } from '@core/components';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import { SQUAD_MAX_COUNT, SQUAD_MAX_SIZE, TICKS_PER_YEAR } from '@core/constants';
import type { EntityStore } from '@core/entities';
import type { GameEvent } from '@core/events';
import type { Map3D } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { Alert, EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { ADULT_AGE_YEARS } from '@systems/dwarves/constants';
import type { PathingReader } from '@core/readers';
import { PERCEPTION_RADIUS } from './constants';
import { isCreatureHostile } from './factions';
import type { TargetManager } from './targets';

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

export function createSquad(entities: EntityStore, cmd: Command): CommandResult {
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

  const squadId = entities.create('squad');
  const squad: Squad = {
    name: name.trim(),
    leaderId,
    members: [],
    mode: 'off',
    station: null,
    patrol: null,
    equipment: { weaponClass: 'any', armor: 'any', ranged: false },
    orders: [],
    barracksZoneId: 0,
  };
  entities.add(squadId, C.Squad, squad);
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
    if (!entities.alive(leaderId)) return reject('not_found');
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

export function setSquadEquipment(entities: EntityStore, cmd: Command): CommandResult {
  const squadId = cmd['squadId'] as EntityId;
  const squad = entities.get(squadId, C.Squad);
  if (squad === undefined) return reject('not_found');

  const rawEquipment = cmd['equipment'];
  if (typeof rawEquipment !== 'object' || rawEquipment === null) return reject('bad_setting');
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
    squad.orders.push(order);
    for (const m of squad.members) {
      const soldier = entities.get(m, C.Soldier);
      if (soldier?.onDuty) {
        targets.setTarget(m, order.targetId);
      }
    }
    emit({ type: 'SquadOrderIssued', squadId, order });
    return OK;
  }
  if (order.kind === 'station') {
    if (!map.validIndex(order.tile)) return reject('out_of_bounds');
    if (!pathing.passable(order.tile, 'walker')) return reject('bad_placement');
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
    squad.orders.push(order);
    emit({ type: 'SquadOrderIssued', squadId, order });
    return OK;
  }
  if (order.kind === 'follow') {
    if (!entities.alive(order.dwarfId)) return reject('not_found');
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

      // If already has an active target, keep engaging
      const activeTarget = targets.targetOf(m);
      if (activeTarget !== 0) continue;

      // Kill order takes precedence
      if (currentOrder && currentOrder.kind === 'kill' && entities.alive(currentOrder.targetId)) {
        targets.setTarget(m, currentOrder.targetId);
        continue;
      }

      // Perception scan: look for hostiles within PERCEPTION_RADIUS
      let closestHostile = 0;
      let closestDist = Infinity;

      const nearby = ctx.readers.spatial.inRadiusWhere(tileM, PERCEPTION_RADIUS, (otherId) => {
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
      if (currentOrder) {
        if (currentOrder.kind === 'station') {
          destTile = currentOrder.tile;
        } else if (currentOrder.kind === 'patrol') {
          destTile = advancePatrol(m, currentOrder.tiles, tileM, patrolIndices);
        } else if (currentOrder.kind === 'follow') {
          const followPos = entities.get(currentOrder.dwarfId, C.Position);
          if (followPos) {
            destTile = map.index(followPos.x, followPos.y, followPos.z);
          }
        }
      } else if (squad.station !== null) {
        destTile = squad.station;
      } else if (squad.patrol !== null && squad.patrol.length > 0) {
        destTile = advancePatrol(m, squad.patrol, tileM, patrolIndices);
      } else if (squad.barracksZoneId !== 0 && ctx.readers.has('14')) {
        const zone = ctx.readers.of<BuildingsReader>('14').zone(squad.barracksZoneId);
        if (zone && zone.tiles.length > 0) {
          destTile = zone.tiles[0] ?? null;
        }
      }

      if (destTile !== null && destTile !== tileM) {
        ctx.world.services.movement?.walkTo(m, destTile, 'combat', ctx);
      }
    }
  }
}
