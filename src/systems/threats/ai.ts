/**
 * Hostile party and member AI implementation.
 * `02-systems/18-threats-monsters-and-raids.md` § Party AI, § Stealth,
 * `04-implementation/algorithms/creature-brains.md` § Hostile party AI.
 */

import { C, type Hostile, type Party } from '@core/components';
import { TileFlag, TileKind, type Map3D } from '@core/map3d';
import type { Edge, EntityId, TileIndex } from '@core/types';
import type { TickContext } from '@core/system';
import { TICKS_PER_DAY } from '@core/constants';
import { entityIndex } from '@core/entities';
import type { BuildingsReader } from '@systems/buildings/reader';
import type { ItemsReader } from '@systems/items/reader';
import {
  ENGAGE_IDLE_TICKS,
  FOLLOW_RADIUS,
  LOITER_DAYS_RAID,
  LOITER_DAYS_SIEGE,
  LOOT_RADIUS,
  RETREAT_LOSS_PERCENT,
  SPOT_RADIUS,
  SPOT_RADIUS_DOG,
  STEAL_MAX_SIZE,
} from './constants';

interface FortressTarget {
  id: EntityId;
  x: number;
  y: number;
  z: number;
  tile: TileIndex;
  soldier: boolean;
  spotRadius: number;
}

/** One stable, ascending-id view for every hostile thinking on this tick. */
function fortressTargets(ctx: TickContext): FortressTarget[] {
  const entities = ctx.world.entities;
  const map = ctx.world.map;
  const species = ctx.registry.table<{ id: string }>('creatures');
  const out: FortressTarget[] = [];
  for (const id of entities.with(C.Creature)) {
    if (!entities.alive(id)) continue;
    const creature = entities.get(id, C.Creature);
    if (creature?.faction !== 'fortress') continue;
    const body = entities.get(id, C.Body);
    if (body !== undefined && !body.conscious) continue;
    const p = entities.get(id, C.Position);
    if (p === undefined) continue;
    out.push({ id, x: p.x, y: p.y, z: p.z, tile: map.index(p.x, p.y, p.z),
      soldier: entities.has(id, C.Soldier),
      spotRadius: species.byIndex(creature.species)?.id.includes('dog') ? SPOT_RADIUS_DOG : SPOT_RADIUS });
  }
  return out;
}

export function positionOf(id: EntityId, ctx: TickContext): TileIndex {
  const p = ctx.world.entities.get(id, C.Position);
  if (!p) return -1;
  return ctx.world.map.index(p.x, p.y, p.z);
}

export function chebyshevDist(a: TileIndex, b: TileIndex, map: Map3D): number {
  const dx = Math.abs(map.xOf(a) - map.xOf(b));
  const dy = Math.abs(map.yOf(a) - map.yOf(b));
  const dz = Math.abs(map.zOf(a) - map.zOf(b));
  return Math.max(dx, dy) + dz * 2;
}

export function isAtEdge(pos: TileIndex, edge: Edge, map: Map3D): boolean {
  if (edge === 'n') return map.yOf(pos) === 0;
  if (edge === 's') return map.yOf(pos) === map.h - 1;
  if (edge === 'w') return map.xOf(pos) === 0;
  if (edge === 'e') return map.xOf(pos) === map.w - 1;
  return false;
}

export function getNearestEdgeTile(pos: TileIndex, edge: Edge, ctx: TickContext): TileIndex {
  const map = ctx.world.map;
  const pathing = ctx.readers.pathing;
  const width = map.w;
  const height = map.h;

  const candidates: TileIndex[] = [];
  if (edge === 'n' || edge === 's') {
    const y = edge === 'n' ? 0 : height - 1;
    for (let x = 0; x < width; x++) {
      const z = map.columnSurfaceZ(x, y);
      const t = map.index(x, y, z);
      if (map.kindAt(t) === TileKind.Floor) candidates.push(t);
    }
  } else {
    const x = edge === 'w' ? 0 : width - 1;
    for (let y = 0; y < height; y++) {
      const z = map.columnSurfaceZ(x, y);
      const t = map.index(x, y, z);
      if (map.kindAt(t) === TileKind.Floor) candidates.push(t);
    }
  }

  if (candidates.length === 0) {
    return pos;
  }

  const reachable = candidates.filter((t) => pathing.reachable(pos, t, 'walker'));
  const pool = reachable.length > 0 ? reachable : candidates;
  const firstCandidate = pool[0];
  if (firstCandidate === undefined) return pos;

  let bestTile = firstCandidate;
  let bestDist = Infinity;
  for (const t of pool) {
    const d = chebyshevDist(pos, t, map);
    if (d < bestDist) {
      bestDist = d;
      bestTile = t;
    }
  }
  return bestTile;
}

export function checkSpotted(_m: EntityId, pos: TileIndex, ctx: TickContext, targets: readonly FortressTarget[] = fortressTargets(ctx)): boolean {
  const map = ctx.world.map;
  const pathing = ctx.readers.pathing;
  const mz = map.zOf(pos);
  const mx = map.xOf(pos);
  const my = map.yOf(pos);

  for (const target of targets) {
    if (Math.abs(target.z - mz) > 1) continue;

    const dx = Math.abs(target.x - mx);
    const dy = Math.abs(target.y - my);
    const dist = Math.max(dx, dy);

    if (dist <= target.spotRadius) {
      if (pathing.lineOfSight(target.tile, pos)) {
        return true;
      }
    }
  }
  return false;
}

export function findAdjacentLockedDoor(pos: TileIndex, ctx: TickContext): EntityId {
  if (!ctx.readers.has('14')) return 0;
  const buildings = ctx.readers.of<BuildingsReader>('14');
  const map = ctx.world.map;
  const x = map.xOf(pos);
  const y = map.yOf(pos);
  const z = map.zOf(pos);

  const neighbors: readonly [number, number][] = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1],
  ];

  for (const [dx, dy] of neighbors) {
    const nx = x + dx;
    const ny = y + dy;
    if (!map.inBounds(nx, ny, z)) continue;
    const nTile = map.index(nx, ny, z);
    const bId = buildings.at(nTile);
    if (bId !== 0 && buildings.doorAt(nTile)) {
      const state = buildings.mechanismState(bId);
      const b = buildings.get(bId);
      if (state === 'locked' || b?.mode === 'locked') {
        return bId;
      }
    }
  }
  return 0;
}

export function findCombatTarget(
  _m: EntityId,
  pos: TileIndex,
  role: string,
  ctx: TickContext,
  targets: readonly FortressTarget[] = fortressTargets(ctx),
  requireReachable = false,
): EntityId {
  const map = ctx.world.map;
  const pathing = ctx.readers.pathing;
  const isArcher = role === 'archers';
  const mx = map.xOf(pos);
  const my = map.yOf(pos);
  const mz = map.zOf(pos);

  let bestSoldier: EntityId = 0;
  let bestSoldierDist = Infinity;
  let bestCreature: EntityId = 0;
  let bestCreatureDist = Infinity;

  for (const target of targets) {
    if (Math.abs(target.z - mz) > 2) continue;

    const dx = Math.abs(target.x - mx);
    const dy = Math.abs(target.y - my);
    const dist = Math.max(dx, dy);
    if (dist > 14) continue; // perception radius 14
    // A farther visible target cannot displace either chosen minimum. Preserve strict ties.
    if (dist >= bestCreatureDist && (!isArcher || !target.soldier || dist >= bestSoldierDist)) continue;

    if (!pathing.lineOfSight(pos, target.tile)) continue;

    if (requireReachable && !pathing.reachable(pos, target.tile, 'walker')) continue;

    if (target.soldier && dist < bestSoldierDist) {
      bestSoldier = target.id;
      bestSoldierDist = dist;
    }
    if (dist < bestCreatureDist) {
      bestCreature = target.id;
      bestCreatureDist = dist;
    }
  }

  if (isArcher && bestSoldier !== 0) {
    return bestSoldier;
  }
  return bestCreature;
}

export function canLootItem(m: EntityId, P: Party, ctx: TickContext): boolean {
  const entities = ctx.world.entities;
  for (const lootId of P.loot) {
    const it = entities.get(lootId, C.Item);
    if (it && it.carriedBy === m) return false;
  }
  return true;
}

export function findUnattendedItemWithinRadius(pos: TileIndex, radius: number, ctx: TickContext): EntityId {
  const entities = ctx.world.entities;
  const map = ctx.world.map;
  const mx = map.xOf(pos);
  const my = map.yOf(pos);
  const mz = map.zOf(pos);

  let bestItem: EntityId = 0;
  let bestDist = Infinity;

  for (const itId of ctx.readers.spatial.inRadius(pos, radius, 'item').slice().sort((a, b) => entityIndex(a) - entityIndex(b))) {
    if (!entities.alive(itId)) continue;
    const it = entities.get(itId, C.Item);
    if (!it || it.carriedBy !== 0 || it.containerId !== 0) continue;
    if ((it.flags & 1) !== 0) continue; // ItemFlag.Forbidden = 1

    const p = entities.get(itId, C.Position);
    if (!p || p.z !== mz) continue;

    const dx = Math.abs(p.x - mx);
    const dy = Math.abs(p.y - my);
    const dist = Math.max(dx, dy);
    if (dist <= radius && dist < bestDist) {
      const itTile = map.index(p.x, p.y, p.z);
      if (ctx.readers.pathing.reachable(pos, itTile, 'walker')) {
        bestItem = itId;
        bestDist = dist;
      }
    }
  }

  return bestItem;
}

export function pickUpLoot(m: EntityId, lootId: EntityId, P: Party, ctx: TickContext): void {
  const entities = ctx.world.entities;
  const it = entities.get(lootId, C.Item);
  if (it) {
    if (!P.loot.includes(lootId)) {
      P.loot.push(lootId);
    }
    if (ctx.world.services.items) {
      ctx.world.services.items.attachToCarrier(lootId, m);
    } else {
      const p = entities.get(lootId, C.Position);
      if (p) {
        entities.remove(lootId, C.Position);
      }
      it.carriedBy = m;
      it.containerId = 0;
    }
    return;
  }

  const animal = entities.get(lootId, C.Creature);
  if (animal) {
    if (!P.loot.includes(lootId)) {
      P.loot.push(lootId);
    }
    const p = entities.get(lootId, C.Position);
    if (p) {
      entities.remove(lootId, C.Position);
    }
  }
}

export function despawnMember(m: EntityId, partyId: EntityId, P: Party, ctx: TickContext): void {
  const entities = ctx.world.entities;

  for (const lootId of P.loot.slice()) {
    const it = entities.get(lootId, C.Item);
    if (it && (it.carriedBy === m || P.purpose === 'thief')) {
      const ownerId = it.ownerId;
      ctx.emit({
        type: 'ThiefEscaped',
        id: m,
        itemId: lootId,
        ownerId,
      });
      P.loot = P.loot.filter((id) => id !== lootId);
    } else {
      const animal = entities.get(lootId, C.Creature);
      if (animal && P.purpose === 'thief') {
        ctx.emit({
          type: 'ThiefEscaped',
          id: m,
          animalId: lootId,
        });
        entities.destroy(lootId);
        P.loot = P.loot.filter((id) => id !== lootId);
      }
    }
  }

  ctx.world.services.combat?.clearTarget(m);
  entities.destroy(m);
  P.despawnedCount = (P.despawnedCount ?? 0) + 1;

  const remainingAlive = P.members.filter((id) => entities.alive(id));
  if (remainingAlive.length === 0) {
    P.state = 'gone';
    const outcome = P.outcome ?? (P.loot.length > 0 ? 'looted' : 'repelled');
    ctx.emit({
      type: 'RaidEnded',
      partyId,
      outcome,
    });
  }
}

function setHearthOrWagonGoal(
  P: Party,
  leaderPos: TileIndex,
  buildingsReader: BuildingsReader | null,
  ctx: TickContext,
): void {
  const map = ctx.world.map;
  let targetTile = -1;

  if (buildingsReader) {
    const hearthId = buildingsReader.hearth();
    if (hearthId !== 0) {
      const hBuilding = buildingsReader.get(hearthId);
      const first = hBuilding?.footprint[0];
      if (first !== undefined) {
        targetTile = first;
      }
    }

    if (targetTile < 0) {
      const wagonId = buildingsReader.wagon();
      if (wagonId !== 0) {
        const wBuilding = buildingsReader.get(wagonId);
        const first = wBuilding?.footprint[0];
        if (first !== undefined) {
          targetTile = first;
        }
      }
    }

    if (targetTile < 0) {
      let bestDist = Infinity;
      for (const bId of ctx.world.entities.with(C.Building)) {
        const b = buildingsReader.get(bId);
        if (b && b.state === 'built') {
          const t = b.footprint[0];
          if (t !== undefined) {
            const d = chebyshevDist(leaderPos, t, map);
            if (d < bestDist) {
              bestDist = d;
              targetTile = t;
            }
          }
        }
      }
    }
  }

  if (targetTile < 0) {
    const cx = Math.floor(map.w / 2);
    const cy = Math.floor(map.h / 2);
    targetTile = map.index(cx, cy, map.columnSurfaceZ(cx, cy));
  }

  let isReachable = ctx.readers.pathing.reachable(leaderPos, targetTile, 'walker');
  let chosenTile = targetTile;

  if (!isReachable) {
    const nearest = ctx.readers.pathing.nearestReachable(leaderPos, targetTile, 'walker', 3000);
    if (nearest >= 0) {
      if (chebyshevDist(nearest, targetTile, map) <= 1) {
        isReachable = true;
        chosenTile = nearest;
      } else {
        chosenTile = nearest;
      }
    }
  }

  if (isReachable) {
    P.goalTile = chosenTile;
    P.goalEntity = 0;
    P.goalUnreachable = false;
  } else {
    P.goalTile = chosenTile !== targetTile ? chosenTile : leaderPos;
    P.goalEntity = 0;
    P.goalUnreachable = true;
  }
}

export function chooseGoal(P: Party, ctx: TickContext): void {
  const entities = ctx.world.entities;
  const map = ctx.world.map;
  const leaderPos = positionOf(P.leaderId, ctx);
  if (leaderPos < 0) return;

  const itemsReader = ctx.readers.has('13') ? ctx.readers.of<ItemsReader>('13') : null;
  const buildingsReader = ctx.readers.has('14') ? ctx.readers.of<BuildingsReader>('14') : null;

  if (P.purpose === 'thief') {
    interface Candidate {
      id: EntityId;
      tile: TileIndex;
      isOutdoors: boolean;
      value: number;
      dist: number;
    }
    let bestCandidate: Candidate | undefined;
    const compare = (a: Candidate, b: Candidate): number => {
      if (a.isOutdoors !== b.isOutdoors) return a.isOutdoors ? -1 : 1;
      if (b.value !== a.value) return b.value - a.value;
      return a.dist - b.dist;
    };

    if (itemsReader) {
      const ranked = itemsReader.bestUnattendedItems();
      // Outdoors precede indoors in the original comparison; lower value cannot improve
        // a reachable winner within either pass. Equal-value distances and slot ties stay live.
      for (const outdoors of [true, false]) {
        for (const itId of ranked) {
          if (!entities.alive(itId)) continue;
          const it = entities.get(itId, C.Item);
          if (!it || it.carriedBy !== 0 || it.containerId !== 0) continue;
          if ((it.flags & 1) !== 0) continue; // Forbidden

          const value = itemsReader.value(itId);
          if (bestCandidate !== undefined && value < bestCandidate.value) break;
          const itTile = itemsReader.tileOf(itId);
          if (itTile < 0) continue;
          const isOutdoors = map.hasFlag(itTile, TileFlag.Outdoor);
          if (isOutdoors !== outdoors) continue;
          const dist = chebyshevDist(leaderPos, itTile, map);
          const candidate = { id: itId, tile: itTile, isOutdoors, value, dist };
          if (bestCandidate !== undefined && compare(candidate, bestCandidate) >= 0) continue;
          if (!ctx.readers.pathing.reachable(leaderPos, itTile, 'walker')) continue;
          bestCandidate = candidate;
        }
        if (bestCandidate !== undefined) break;
      }
    }

    const spTable = ctx.registry.table<{ id: string; size: number }>('creatures');
    for (const aId of entities.with(C.Tame)) {
      if (!entities.alive(aId)) continue;
      const c = entities.get(aId, C.Creature);
      if (!c || c.faction !== 'fortress') continue;
      const sp = spTable.byIndex(c.species);
      if (!sp || sp.size >= STEAL_MAX_SIZE) continue;

      const aTile = positionOf(aId, ctx);
      if (aTile < 0) continue;
      const isOutdoors = map.hasFlag(aTile, TileFlag.Outdoor);
      const value = 10;
      const dist = chebyshevDist(leaderPos, aTile, map);
      const candidate = { id: aId, tile: aTile, isOutdoors, value, dist };
      if (bestCandidate !== undefined && compare(candidate, bestCandidate) >= 0) continue;
      if (!ctx.readers.pathing.reachable(leaderPos, aTile, 'walker')) continue;
      bestCandidate = candidate;
    }

    if (bestCandidate !== undefined) {
      P.goalEntity = bestCandidate.id;
      P.goalTile = bestCandidate.tile;
      P.goalUnreachable = false;
    } else {
      P.goalEntity = 0;
      P.goalTile = leaderPos;
      P.goalUnreachable = false;
    }
  } else if (P.purpose === 'bandits') {
    let nearestStockpileTile = -1;
    let nearestDist = Infinity;

    if (buildingsReader) {
      const stockpiles = buildingsReader.zonesOfType('stockpile');
      for (const spId of stockpiles) {
        const zone = buildingsReader.zone(spId);
        if (!zone) continue;
        for (const t of zone.tiles) {
          if (ctx.readers.pathing.reachable(leaderPos, t, 'walker')) {
            const d = chebyshevDist(leaderPos, t, map);
            if (d < nearestDist) {
              nearestDist = d;
              nearestStockpileTile = t;
            }
          }
        }
      }
    }

    if (nearestStockpileTile >= 0) {
      P.goalTile = nearestStockpileTile;
      P.goalEntity = 0;
      P.goalUnreachable = false;
    } else {
      setHearthOrWagonGoal(P, leaderPos, buildingsReader, ctx);
    }
  } else if (P.purpose === 'ambush') {
    let nearestDwarf: EntityId = 0;
    let nearestTile = -1;
    let nearestDist = Infinity;

    for (const cId of entities.with(C.Creature)) {
      if (!entities.alive(cId)) continue;
      const c = entities.get(cId, C.Creature);
      if (!c || c.faction !== 'fortress') continue;

      const cTile = positionOf(cId, ctx);
      if (cTile < 0) continue;
      if (map.hasFlag(cTile, TileFlag.Outdoor)) {
        if (ctx.readers.pathing.reachable(leaderPos, cTile, 'walker')) {
          const d = chebyshevDist(leaderPos, cTile, map);
          if (d < nearestDist) {
            nearestDist = d;
            nearestDwarf = cId;
            nearestTile = cTile;
          }
        }
      }
    }

    if (nearestDwarf !== 0) {
      P.goalEntity = nearestDwarf;
      P.goalTile = nearestTile;
      P.goalUnreachable = false;
    } else {
      setHearthOrWagonGoal(P, leaderPos, buildingsReader, ctx);
    }
  } else if (P.purpose === 'restless') {
    let nearestCreature: EntityId = 0;
    let nearestTile = -1;
    let nearestDist = Infinity;

    for (const cId of entities.with(C.Creature)) {
      if (!entities.alive(cId)) continue;
      const c = entities.get(cId, C.Creature);
      if (!c || c.faction !== 'fortress') continue;

      const cTile = positionOf(cId, ctx);
      if (cTile < 0) continue;
      const d = chebyshevDist(leaderPos, cTile, map);
      if (d < nearestDist) {
        nearestDist = d;
        nearestCreature = cId;
        nearestTile = cTile;
      }
    }

    if (nearestCreature !== 0) {
      P.goalEntity = nearestCreature;
      P.goalTile = nearestTile;
      P.goalUnreachable = false;
    } else {
      setHearthOrWagonGoal(P, leaderPos, buildingsReader, ctx);
    }
  } else {
    setHearthOrWagonGoal(P, leaderPos, buildingsReader, ctx);
  }
}

export function checkPartyCasualties(partyId: EntityId, P: Party, ctx: TickContext): void {
  if (P.state === 'retreat' || P.state === 'gone' || P.purpose === 'restless') return;
  const entities = ctx.world.entities;
  const alive = P.members.filter((m) => {
    if (!entities.alive(m)) return false;
    const body = entities.get(m, C.Body);
    if (body !== undefined && !body.conscious) return false;
    return true;
  });

  if (alive.length === 0) {
    P.state = 'gone';
    const outcome = P.outcome ?? (P.loot.length > 0 ? 'looted' : (P.despawnedCount && P.despawnedCount > 0 ? 'repelled' : 'wiped'));
    ctx.emit({ type: 'RaidEnded', partyId, outcome });
    return;
  }

  const casualtyPercent = ((P.members.length - alive.length) * 100) / P.members.length;
  if (casualtyPercent >= RETREAT_LOSS_PERCENT) {
    P.state = 'retreat';
    P.stateSince = ctx.tick;
    P.outcome = P.loot.length > 0 ? 'looted' : 'repelled';
  }
}

export function partyThink(partyId: EntityId, P: Party, ctx: TickContext, targets?: readonly FortressTarget[]): void {
  const entities = ctx.world.entities;
  if (P.state === 'gone') return;

  const alive = P.members.filter((m) => {
    if (!entities.alive(m)) return false;
    const body = entities.get(m, C.Body);
    if (body !== undefined && !body.conscious) return false;
    return true;
  });

  if (alive.length === 0) {
    P.state = 'gone';
    const outcome = P.outcome ?? (P.loot.length > 0 ? 'looted' : (P.despawnedCount && P.despawnedCount > 0 ? 'repelled' : 'wiped'));
    ctx.emit({ type: 'RaidEnded', partyId, outcome });
    return;
  }

  if (P.leaderId === 0 || !alive.includes(P.leaderId)) {
    const firstAlive = alive[0];
    if (firstAlive !== undefined) {
      P.leaderId = firstAlive;
    }
  }

  if (P.state !== 'retreat' && P.state !== 'gone' && P.purpose !== 'restless') {
    const casualtyPercent = ((P.members.length - alive.length) * 100) / P.members.length;
    if (casualtyPercent >= RETREAT_LOSS_PERCENT) {
      P.state = 'retreat';
      P.stateSince = ctx.tick;
      P.outcome = P.loot.length > 0 ? 'looted' : 'repelled';
    }
  }

  switch (P.state) {
    case 'approach': {
      if (P.goalTile === 0) {
        chooseGoal(P, ctx);
      }
      let seesFortress = false;
      for (const m of alive) {
        const mPos = positionOf(m, ctx);
        if (mPos >= 0 && findCombatTarget(m, mPos, 'warriors', ctx, targets, true) !== 0) {
          seesFortress = true;
          break;
        }
      }
      if (seesFortress) {
        P.state = 'engage';
        P.stateSince = ctx.tick;
      }
      break;
    }
    case 'engage': {
      let hasTarget = false;
      for (const m of alive) {
        const mPos = positionOf(m, ctx);
        if (mPos >= 0 && findCombatTarget(m, mPos, 'warriors', ctx, targets, true) !== 0) {
          hasTarget = true;
          break;
        }
      }
      if (!hasTarget) {
        if (ctx.tick - P.stateSince >= ENGAGE_IDLE_TICKS) {
          P.state = 'approach';
          P.stateSince = ctx.tick;
          chooseGoal(P, ctx);
        }
      } else {
        P.stateSince = ctx.tick;
      }
      break;
    }
    case 'loiter': {
      // If a broken door makes the goal reachable, the party returns to approach.
      if (P.goalUnreachable) {
        chooseGoal(P, ctx);
        if (!P.goalUnreachable) {
          P.state = 'approach';
          P.stateSince = ctx.tick;
          break;
        }
      }
      let seesReachableFortress = false;
      for (const m of alive) {
        const mPos = positionOf(m, ctx);
        if (mPos >= 0 && findCombatTarget(m, mPos, 'warriors', ctx, targets, true) !== 0) {
          seesReachableFortress = true;
          break;
        }
      }
      if (seesReachableFortress) {
        P.state = 'engage';
        P.stateSince = ctx.tick;
        break;
      }
      const loiterDays = P.purpose === 'siege' ? LOITER_DAYS_SIEGE : LOITER_DAYS_RAID;
      if (ctx.tick - P.stateSince >= loiterDays * TICKS_PER_DAY) {
        P.state = 'retreat';
        P.stateSince = ctx.tick;
        P.outcome = P.loot.length > 0 ? 'looted' : 'withdrew';
      }
      break;
    }
    case 'retreat': {
      // Members despawn on arrival at edge.
      break;
    }
  }
}

export function memberThink(m: EntityId, H: Hostile, P: Party | undefined, ctx: TickContext, targets?: readonly FortressTarget[]): void {
  const entities = ctx.world.entities;
  if (!entities.alive(m)) return;

  const body = entities.get(m, C.Body);
  if (body !== undefined && !body.conscious) return;

  const pos = positionOf(m, ctx);
  if (pos < 0) return;

  // 1. Stealth and spotting
  if (H.stealthed && checkSpotted(m, pos, ctx, targets)) {
    H.stealthed = false;
    H.spotted = true;
    if (P?.purpose === 'thief') {
      ctx.emit({ type: 'ThiefSpotted', id: m });
      P.state = 'retreat';
      P.stateSince = ctx.tick;
      P.outcome = 'withdrew';
    } else if (P?.purpose === 'ambush') {
      ctx.emit({ type: 'AmbushSprung', partyId: H.partyId });
      if (P) {
        P.state = 'engage';
        P.stateSince = ctx.tick;
      }
    }
  }

  // 2. Retreating
  if (P && P.state === 'retreat') {
    const edge = P.edge ?? 'n';
    const edgeTile = getNearestEdgeTile(pos, edge, ctx);
    if (isAtEdge(pos, edge, ctx.world.map) || pos === edgeTile) {
      despawnMember(m, H.partyId, P, ctx);
      return;
    }
    ctx.world.services.movement?.walkTo(m, edgeTile, 'combat', ctx);
    return;
  }

  // 3. Fleeing on low blood
  if (P?.purpose !== 'restless' && body && body.maxBlood > 0) {
    const creature = entities.get(m, C.Creature);
    if (creature && creature.faction !== 'deep') {
      const spTable = ctx.registry.table<{ id: string; temper: string; fleeBloodPercent: number | null }>('creatures');
      const sp = spTable.byIndex(creature.species);
      const fleeThresh = sp?.fleeBloodPercent ?? (sp?.temper === 'aggressive' ? null : 50);
      if (fleeThresh !== null && ((body.blood / body.maxBlood) * 100) < fleeThresh) {
        if (H.behaviorState !== 'flee') {
          H.behaviorState = 'flee';
          ctx.emit({ type: 'HostileFled', id: m });
        }
        const edge = P?.edge ?? 'n';
        const edgeTile = getNearestEdgeTile(pos, edge, ctx);
        if (isAtEdge(pos, edge, ctx.world.map) || pos === edgeTile) {
          if (P) despawnMember(m, H.partyId, P, ctx);
          else entities.destroy(m);
          return;
        }
        ctx.world.services.movement?.walkTo(m, edgeTile, 'combat', ctx);
        return;
      }
    }
  }

  // 4. Combat targeting (except stealthed thieves)
  if (!H.stealthed) {
    const isLoitering = P?.state === 'loiter';
    const isArcher = H.role === 'archers';
    const allowUnreachable = isLoitering && isArcher;
    const target = findCombatTarget(m, pos, H.role, ctx, targets, !allowUnreachable);
    if (target !== 0) {
      ctx.world.services.combat?.setTarget(m, target);
      H.behaviorState = 'attack';
      if (P && (P.state === 'approach' || (P.state === 'loiter' && !allowUnreachable))) {
        const targetPos = positionOf(target, ctx);
        if (targetPos >= 0 && ctx.readers.pathing.reachable(pos, targetPos, 'walker')) {
          P.state = 'engage';
          P.stateSince = ctx.tick;
        }
      }
      return;
    } else if (ctx.world.services.combat?.targetOf(m) !== 0 && !allowUnreachable) {
      ctx.world.services.combat?.setTarget(m, 0);
    }
  }

  if (H.behaviorState === 'attack' && ctx.world.services.combat?.targetOf(m) === 0) {
    H.behaviorState = P?.state ?? 'approach';
  }

  // 5. Door breaking and looting in engage or loiter (or if door blocks path)
  const creature = entities.get(m, C.Creature);
  const spTable = ctx.registry.table<{ id: string; breaksDoors?: boolean; flags?: { breaksDoors?: boolean } }>('creatures');
  const spRow = creature ? spTable.byIndex(creature.species) : undefined;
  const breaksDoors = spRow?.flags?.breaksDoors === true || spRow?.breaksDoors === true;
  if (breaksDoors) {
    const lockedDoor = findAdjacentLockedDoor(pos, ctx);
    if (lockedDoor !== 0) {
      H.breakingDoorId = lockedDoor;
      ctx.emit({ type: 'DoorBreakAttempt', id: m, doorId: lockedDoor });
      return;
    } else {
      H.breakingDoorId = 0;
    }
  }

  if (P && (P.state === 'engage' || P.state === 'loiter')) {
    if (canLootItem(m, P, ctx)) {
      const lootItem = findUnattendedItemWithinRadius(pos, LOOT_RADIUS, ctx);
      if (lootItem !== 0) {
        let itemTile = -1;
        if (ctx.readers.has('13')) {
          itemTile = ctx.readers.of<ItemsReader>('13').tileOf(lootItem);
        }
        if (itemTile === pos) {
          pickUpLoot(m, lootItem, P, ctx);
          return;
        } else if (itemTile >= 0) {
          ctx.world.services.movement?.walkTo(m, itemTile, 'combat', ctx);
          return;
        }
      }
    }
  }

  // 6. Movement / following leader
  if (!P) return;

  if (P.purpose === 'thief') {
    let targetTile = P.goalTile;
    if (P.goalEntity !== 0) {
      if (entities.has(P.goalEntity, C.Item)) {
        if (ctx.readers.has('13')) {
          const curTile = ctx.readers.of<ItemsReader>('13').tileOf(P.goalEntity);
          if (curTile >= 0) targetTile = curTile;
        }
      } else if (entities.has(P.goalEntity, C.Creature)) {
        const curTile = positionOf(P.goalEntity, ctx);
        if (curTile >= 0) targetTile = curTile;
      }
    }
    if (pos === targetTile || (targetTile >= 0 && chebyshevDist(pos, targetTile, ctx.world.map) <= 1)) {
      if (P.goalEntity !== 0) {
        pickUpLoot(m, P.goalEntity, P, ctx);
      }
      P.state = 'retreat';
      P.stateSince = ctx.tick;
      P.outcome = 'looted';
      return;
    }
    ctx.world.services.movement?.walkTo(m, targetTile, 'combat', ctx);
    return;
  }

  if (m === P.leaderId) {
    const map = ctx.world.map;
    const sameZ = map.zOf(pos) === map.zOf(P.goalTile);
    const distToGoal = sameZ ? chebyshevDist(pos, P.goalTile, map) : Infinity;

    if (pos === P.goalTile) {
      if (P.goalUnreachable && P.state === 'approach') {
        P.state = 'loiter';
        P.stateSince = ctx.tick;
      }
    } else {
      const outcome = ctx.world.services.movement?.walkTo(m, P.goalTile, 'combat', ctx);
      const arrived = outcome === 'arrived' || outcome === 'unreachable' || (outcome !== 'moving' && outcome !== 'pending' && sameZ && distToGoal <= 1);
      if (arrived) {
        if (P.goalUnreachable && P.state === 'approach') {
          P.state = 'loiter';
          P.stateSince = ctx.tick;
        }
      }
    }
  } else {
    const leaderPos = positionOf(P.leaderId, ctx);
    if (leaderPos >= 0) {
      const canReachLeader = ctx.readers.pathing.reachable(pos, leaderPos, 'walker');
      if (!canReachLeader) {
        ctx.world.services.movement?.walkTo(m, P.goalTile, 'combat', ctx);
      } else {
        const distToLeader = chebyshevDist(pos, leaderPos, ctx.world.map);
        if (distToLeader > (breaksDoors ? 1 : FOLLOW_RADIUS)) {
          ctx.world.services.movement?.walkTo(m, leaderPos, 'combat', ctx);
        }
      }
    } else {
      ctx.world.services.movement?.walkTo(m, P.goalTile, 'combat', ctx);
    }
  }
}

export function stepThreatMembers(ctx: TickContext): void {
  const entities = ctx.world.entities;
  const hostiles = entities.with(C.Hostile);
  if (hostiles.length === 0) return;
  const targets = fortressTargets(ctx);
  for (const m of hostiles) {
    if (!entities.alive(m)) continue;
    const H = entities.get(m, C.Hostile);
    if (!H) continue;
    const P = H.partyId !== 0 ? entities.get(H.partyId, C.Party) : undefined;
    memberThink(m, H, P, ctx, targets);
  }
}

export function stepThreatParties(ctx: TickContext): void {
  const entities = ctx.world.entities;
  const parties = entities.with(C.Party);
  if (parties.length === 0) return;
  const targets = fortressTargets(ctx);
  for (const partyId of parties) {
    if (!entities.alive(partyId)) continue;
    const P = entities.get(partyId, C.Party);
    if (!P || P.state === 'gone') continue;
    partyThink(partyId, P, ctx, targets);
  }
}
