/**
 * Hostile party and member AI implementation.
 * `02-systems/18-threats-monsters-and-raids.md` § Party AI, § Stealth,
 * `04-implementation/algorithms/creature-brains.md` § Hostile party AI.
 */

import { C, type Hostile, type Party } from '@core/components';
import { effectValue } from '@core/effects';
import { TileFlag, TileKind, type Map3D } from '@core/map3d';
import type { Edge, EntityId, TileIndex } from '@core/types';
import type { TickContext } from '@core/system';
import { TICKS_PER_DAY } from '@core/constants';
import { entityIndex } from '@core/entities';
import type { BuildingsReader } from '@systems/buildings/reader';
import { removeLeavingEquipment } from '@systems/items/leaving';
import type { ItemsReader } from '@systems/items/reader';
import { PERCEPTION_RADIUS } from '@systems/combat/constants';
import type { CombatReader } from '@systems/combat/reader';
import { wornSpotRadius } from '@systems/magic/enchant';
import {
  ENGAGE_IDLE_TICKS,
  ENGAGE_STALL_TICKS,
  FOLLOW_RADIUS,
  LOITER_DAYS_RAID,
  LOITER_DAYS_SIEGE,
  LOOT_RADIUS,
  RETREAT_LOSS_PERCENT,
  RETREAT_STUCK_TICKS,
  RETREAT_GIVE_UP_DAYS,
  SPOT_RADIUS,
  SPOT_RADIUS_DOG,
  STEAL_MAX_SIZE,
  THIEF_WAIT_DAYS,
  THIEF_APPROACH_DAYS,
} from './constants';
import { countCaptainLoss, countCasualty, hasMorale, moraleBroken, moraleOf, nerveOf, steadyByLoot } from './morale';

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
  const species = ctx.registry.table<{ id: string; trainable?: string; flags?: Readonly<Record<string, unknown>> }>('creatures');
  const out: FortressTarget[] = [];
  for (const id of entities.with(C.Creature)) {
    if (!entities.alive(id)) continue;
    const creature = entities.get(id, C.Creature);
    if (creature?.faction !== 'fortress') continue;
    const body = entities.get(id, C.Body);
    if (body !== undefined && !body.conscious) continue;
    const p = entities.get(id, C.Position);
    if (p === undefined) continue;
    const trained = entities.get(id, C.Tame)?.trained;
    const row = species.byIndex(creature.species);
    const trainable = row?.trainable ?? row?.flags?.['trainable'];
    const guard = trained !== undefined && trained !== 'none' && (trainable === 'both' || trainable === trained);
    out.push({ id, x: p.x, y: p.y, z: p.z, tile: map.index(p.x, p.y, p.z),
      soldier: entities.has(id, C.Soldier),
      // 25 § Enchantments in combat: an enchanted piece worn adds its `spot_radius`; § Effects: a
      // `spot_radius` effect (a draught) sees as far as the larger of that and its own value.
      spotRadius: Math.max(entities.has(id, C.Attributes) ? SPOT_RADIUS + wornSpotRadius(entities, ctx.registry, id) : guard ? SPOT_RADIUS_DOG : 0,
        effectValue(entities, id, 'spot_radius', ctx.tick)) });
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

/** The nearest legal exit on any edge, with stable tile-index ties. */
function nearestReachableExit(m: EntityId, pos: TileIndex, ctx: TickContext): TileIndex {
  const { map, entities } = ctx.world;
  const cls = entities.get(m, C.Motion)?.movementClass ?? 'walker';
  const creature = entities.get(m, C.Creature);
  const species = ctx.registry.table<{ id: string; flags?: { opensDoors?: boolean } }>('creatures');
  const mover = { faction: creature?.faction, size: creature?.sizeClass,
    opensDoors: creature !== undefined && species.byIndex(creature.species)?.flags?.opensDoors === true };
  let best = -1;
  let distance = Infinity;
  const consider = (x: number, y: number, z: number): void => {
    const tile = map.index(x, y, z);
    if (!ctx.readers.pathing.passable(tile, cls, mover) || !ctx.readers.pathing.reachable(pos, tile, cls)) return;
    const d = chebyshevDist(pos, tile, map);
    if (d < distance || (d === distance && tile < best)) { best = tile; distance = d; }
  };
  for (let z = 0; z < map.d; z++) {
    for (let x = 0; x < map.w; x++) { consider(x, 0, z); consider(x, map.h - 1, z); }
    for (let y = 1; y < map.h - 1; y++) { consider(0, y, z); consider(map.w - 1, y, z); }
  }
  return best;
}

/** Hold one destination through detours; choosing again on every step can oscillate. */
function retreatMember(m: EntityId, H: Hostile, P: Party, pos: TileIndex, ctx: TickContext): void {
  const map = ctx.world.map;
  if (isAtEdge(pos, 'n', map) || isAtEdge(pos, 's', map) ||
      isAtEdge(pos, 'w', map) || isAtEdge(pos, 'e', map)) {
    despawnMember(m, H.partyId, P, ctx);
    return;
  }
  if (H.retreat === undefined || H.retreat.stateSince !== P.stateSince) {
    const exit = getNearestEdgeTile(pos, P.edge ?? 'n', ctx);
    const goalTile = exit === pos ? -1 : exit;
    H.retreat = { stateSince: P.stateSince, goalTile, progressSince: ctx.tick,
      bestDistance: goalTile < 0 ? map.tileCount : chebyshevDist(pos, goalTile, map) };
    ctx.world.services.combat?.clearTarget(m);
  }
  const retreat = H.retreat;
  const distance = retreat.goalTile < 0 ? map.tileCount : chebyshevDist(pos, retreat.goalTile, map);
  if (distance < retreat.bestDistance) {
    retreat.bestDistance = distance;
    retreat.progressSince = ctx.tick;
  }
  if (ctx.tick - retreat.progressSince >= RETREAT_STUCK_TICKS) {
    retreat.goalTile = nearestReachableExit(m, pos, ctx);
    retreat.bestDistance = retreat.goalTile < 0 ? map.tileCount : chebyshevDist(pos, retreat.goalTile, map);
    retreat.progressSince = ctx.tick;
  }
  if (retreat.goalTile >= 0) ctx.world.services.movement?.walkTo(m, retreat.goalTile, 'combat', ctx);
}

export function checkSpotted(m: EntityId, pos: TileIndex, ctx: TickContext, targets: readonly FortressTarget[] = fortressTargets(ctx)): boolean {
  const map = ctx.world.map;
  // 25 § Summons, Turning: a turned shade is never spotted by the caster whose call it came through.
  const unseenBy = ctx.world.entities.get(m, C.Summoned)?.turnedFrom ?? 0;
  const pathing = ctx.readers.pathing;
  const mz = map.zOf(pos);
  const mx = map.xOf(pos);
  const my = map.yOf(pos);

  for (const target of targets) {
    if (target.spotRadius === 0 || target.id === unseenBy) continue;
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

/** 18 § Engage: an archer, and a hexer (25 § Hexers), prefers soldiers and shoots from range while loitering. */
export function shootsFromRange(role: string): boolean {
  return role === 'archers' || role === 'hexer';
}

export function findCombatTarget(
  m: EntityId,
  pos: TileIndex,
  role: string,
  ctx: TickContext,
  targets: readonly FortressTarget[] = fortressTargets(ctx),
  requireReachable = false,
): EntityId {
  const map = ctx.world.map;
  const pathing = ctx.readers.pathing;
  const isArcher = shootsFromRange(role);
  const mx = map.xOf(pos);
  const my = map.yOf(pos);
  const mz = map.zOf(pos);
  const movementClass = ctx.world.entities.get(m, C.Motion)?.movementClass ?? 'walker';

  let bestSoldier: EntityId = 0;
  let bestSoldierDist = Infinity;
  let bestCreature: EntityId = 0;
  let bestCreatureDist = Infinity;

  for (const target of targets) {
    if (Math.abs(target.z - mz) > 2) continue;

    const dx = Math.abs(target.x - mx);
    const dy = Math.abs(target.y - my);
    const dist = Math.max(dx, dy);
    if (dist > PERCEPTION_RADIUS) continue;
    // A farther visible target cannot displace either chosen minimum. Preserve strict ties.
    if (dist >= bestCreatureDist && (!isArcher || !target.soldier || dist >= bestSoldierDist)) continue;

    if (!pathing.lineOfSight(pos, target.tile)) continue;

    if (requireReachable && !pathing.reachable(pos, target.tile, movementClass)) continue;

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
  if (bestCreature !== 0) return bestCreature;
  // Visibility acquires a target. Once acquired, 16 owns its lifetime: a turn in a
  // reachable path may occlude it without taking it out of perception.
  const current = ctx.world.services.combat?.targetOf(m) ?? 0;
  const p = ctx.world.entities.get(current, C.Position);
  if (current !== 0 && ctx.world.entities.alive(current) && p !== undefined &&
      ctx.world.entities.get(current, C.Creature)?.faction === 'fortress' &&
      Math.abs(p.z - mz) <= 2 && Math.max(Math.abs(p.x - mx), Math.abs(p.y - my)) <= PERCEPTION_RADIUS &&
      (!requireReachable || pathing.reachable(pos, map.index(p.x, p.y, p.z), movementClass))) return current;
  return 0;
}

export function canLootItem(m: EntityId, P: Party, ctx: TickContext): boolean {
  const entities = ctx.world.entities;
  for (const lootId of P.loot) {
    const it = entities.get(lootId, C.Item);
    if (it && it.carriedBy === m) return false;
  }
  return true;
}

export function findUnattendedItemWithinRadius(pos: TileIndex, radius: number, ctx: TickContext, P?: Party): EntityId {
  const entities = ctx.world.entities;
  const map = ctx.world.map;
  const mx = map.xOf(pos);
  const my = map.yOf(pos);
  const mz = map.zOf(pos);

  const itemsReader = ctx.readers.has('13') ? ctx.readers.of<ItemsReader>('13') : null;
  const buildingsReader = ctx.readers.has('14') ? ctx.readers.of<BuildingsReader>('14') : null;

  let bestItem: EntityId = 0;
  let bestInStockpile = false;
  let bestValue = -Infinity;

  // Reachability, radius and stockpile preference are identical for items on one tile.
  // The existing index keeps its highest value / lowest slot eligible item. Party loot
  // exclusions can hide that winner only while the excluded item remains loose.
  const excludesLooseItem = P?.loot.some((id) => {
    const it = entities.get(id, C.Item);
    return it !== undefined && it.carriedBy === 0 && it.containerId === 0
      && (it.flags & 1) === 0 && entities.has(id, C.Position);
  }) ?? false;
  const candidates = itemsReader && !excludesLooseItem
    ? itemsReader.bestUnattendedItems(pos, radius)
    : ctx.readers.spatial.inRadius(pos, radius, 'item');
  for (const itId of candidates) {
    if (!entities.alive(itId)) continue;
    const it = entities.get(itId, C.Item);
    if (!it || it.carriedBy !== 0 || it.containerId !== 0) continue;
    if ((it.flags & 1) !== 0) continue; // ItemFlag.Forbidden = 1
    if (P && P.loot.includes(itId)) continue;

    const p = entities.get(itId, C.Position);
    if (!p || p.z !== mz) continue;

    const dx = Math.abs(p.x - mx);
    const dy = Math.abs(p.y - my);
    const dist = Math.max(dx, dy);
    if (dist > radius) continue;

    const itTile = map.index(p.x, p.y, p.z);
    if (!ctx.readers.pathing.reachable(pos, itTile, 'walker')) continue;

    const zId = buildingsReader ? buildingsReader.zoneAt(itTile) : 0;
    const inStockpile = zId !== 0 && buildingsReader?.zone(zId)?.type === 'stockpile';
    const value = itemsReader ? itemsReader.value(itId) : 0;

    if (bestItem === 0) {
      bestItem = itId;
      bestInStockpile = inStockpile;
      bestValue = value;
    } else if (inStockpile !== bestInStockpile) {
      if (inStockpile) {
        bestItem = itId;
        bestInStockpile = inStockpile;
        bestValue = value;
      }
    } else if (value !== bestValue) {
      if (value > bestValue) {
        bestItem = itId;
        bestInStockpile = inStockpile;
        bestValue = value;
      }
    } else if (entityIndex(itId) < entityIndex(bestItem)) {
      bestItem = itId;
      bestInStockpile = inStockpile;
      bestValue = value;
    }
  }

  return bestItem;
}

export function banditPartyLootStockpile(P: Party, ctx: TickContext): void {
  const entities = ctx.world.entities;

  const alive = P.members.filter((m) => {
    if (!inParty(entities, m)) return false;
    const body = entities.get(m, C.Body);
    if (body !== undefined && !body.conscious) return false;
    return true;
  });

  for (const m of alive) {
    if (!canLootItem(m, P, ctx)) continue;
    const mPos = positionOf(m, ctx);
    if (mPos < 0) continue;

    const lootItem = findUnattendedItemWithinRadius(mPos, LOOT_RADIUS, ctx, P);
    if (lootItem !== 0) {
      pickUpLoot(m, lootItem, P, ctx);
    }
  }

  if (P.loot.length > 0) {
    P.state = 'retreat';
    P.stateSince = ctx.tick;
    P.outcome = 'looted';
  } else {
    P.state = 'loiter';
    P.stateSince = ctx.tick;
  }
}

export function pickUpLoot(m: EntityId, lootId: EntityId, P: Party, ctx: TickContext): void {
  const entities = ctx.world.entities;
  const it = entities.get(lootId, C.Item);
  if (it) {
    if (!P.loot.includes(lootId)) {
      P.loot.push(lootId);
      steadyByLoot(P);
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
      steadyByLoot(P);
    }
    const p = entities.get(lootId, C.Position);
    if (p) {
      ctx.world.services.movement?.stopWalking(lootId);
      ctx.world.services.spatial?.remove(lootId, ctx.world.map.index(p.x, p.y, p.z));
      entities.remove(lootId, C.Position);
    }
    (P.animalCarriers ??= {})[lootId] = m;
  }
}

/** Death keeps stolen animals alive on the carrier's recorded death tile. */
export function releaseStolenAnimals(carrier: EntityId, tile: TileIndex, P: Party, ctx: TickContext): void {
  for (const animal of P.loot.slice()) {
    if (P.animalCarriers?.[animal] !== carrier) continue;
    if (ctx.world.entities.alive(animal)) ctx.world.services.movement?.teleport(animal, tile);
    P.loot = P.loot.filter((id) => id !== animal);
    delete P.animalCarriers[animal];
  }
  if (P.animalCarriers !== undefined && Object.keys(P.animalCarriers).length === 0) delete P.animalCarriers;
}

/**
 * A member still in its party: alive and not caught in a cage (19). A caged member has left the
 * map: it counts toward the casualties, cannot lead, and is never walked off or despawned.
 */
function inParty(entities: TickContext['world']['entities'], m: EntityId): boolean {
  return entities.alive(m) && (entities.get(m, C.Creature)?.cagedIn ?? 0) === 0;
}

/** Final outcomes reflect escaped loot, not a planned retreat or a held item. */
function finalPartyOutcome(P: Party): string {
  if ((P.escapedLootCount ?? 0) > 0) return 'looted';
  if ((P.despawnedCount ?? 0) === 0) return 'wiped';
  return P.outcome === 'withdrew' ? 'withdrew' : 'repelled';
}

export function despawnMember(m: EntityId, partyId: EntityId, P: Party, ctx: TickContext): void {
  const entities = ctx.world.entities;
  const escapedLoot = P.loot.slice();

  for (const lootId of P.loot.slice()) {
    const it = entities.get(lootId, C.Item);
    if (it && it.carriedBy === m) {
      const ownerId = it.ownerId;
      ctx.emit({
        type: 'ThiefEscaped',
        id: m,
        itemId: lootId,
        ownerId,
      });
      P.escapedLootCount = (P.escapedLootCount ?? 0) + 1;
      P.loot = P.loot.filter((id) => id !== lootId);
    } else {
      const animal = entities.get(lootId, C.Creature);
      if (animal && P.purpose === 'thief' && P.animalCarriers?.[lootId] === m) {
        ctx.emit({
          type: 'ThiefEscaped',
          id: m,
          animalId: lootId,
        });
        entities.destroy(lootId);
        P.escapedLootCount = (P.escapedLootCount ?? 0) + 1;
        P.loot = P.loot.filter((id) => id !== lootId);
        delete P.animalCarriers[lootId];
      }
    }
  }

  if (P.animalCarriers !== undefined && Object.keys(P.animalCarriers).length === 0) delete P.animalCarriers;

  removeLeavingEquipment(ctx.world, m, escapedLoot);
  ctx.world.services.combat?.clearTarget(m);
  entities.destroy(m);
  P.despawnedCount = (P.despawnedCount ?? 0) + 1;

  const remainingAlive = P.members.filter((id) => inParty(entities, id));
  if (remainingAlive.length === 0) endParty(partyId, P, ctx);
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
      // A summon cannot be carried off (25 § Summons).
      if (!entities.alive(aId) || entities.has(aId, C.Summoned)) continue;
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
    let nearestReachableStockpileTile = -1;
    let nearestReachableDist = Infinity;
    let nearestAnyDist = Infinity;

    if (buildingsReader) {
      const stockpiles = buildingsReader.zonesOfType('stockpile');
      for (const spId of stockpiles) {
        const zone = buildingsReader.zone(spId);
        if (!zone) continue;
        for (const t of zone.tiles) {
          const d = chebyshevDist(leaderPos, t, map);
          if (d < nearestAnyDist) {
            nearestAnyDist = d;
            nearestStockpileTile = t;
          }
          if (ctx.readers.pathing.reachable(leaderPos, t, 'walker')) {
            if (d < nearestReachableDist) {
              nearestReachableDist = d;
              nearestReachableStockpileTile = t;
            }
          }
        }
      }
    }

    if (nearestReachableStockpileTile >= 0) {
      P.goalTile = nearestReachableStockpileTile;
      P.goalEntity = 0;
      P.goalUnreachable = false;
    } else if (nearestStockpileTile >= 0) {
      const nearest = ctx.readers.pathing.nearestReachable(leaderPos, nearestStockpileTile, 'walker', 3000);
      P.goalTile = nearest >= 0 ? nearest : leaderPos;
      P.goalEntity = 0;
      P.goalUnreachable = true;
    } else {
      setHearthOrWagonGoal(P, leaderPos, buildingsReader, ctx);
    }
  } else if (P.purpose === 'ambush') {
    let nearestDwarf: EntityId = 0;
    let nearestTile = -1;
    let nearestDist = Infinity;

    for (const cId of entities.with(C.Creature, C.Attributes)) {
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

/**
 * 18 § Party AI, Retreat: the captain holds the party together. A party that arrived with captains
 * and has none still standing with it (dead, unconscious, caged or gone from the map) has lost them.
 */
function captainsLost(P: Party, standing: readonly EntityId[]): boolean {
  const captains = P.captainIds ?? [];
  return captains.length > 0 && !captains.some((id) => standing.includes(id));
}

/**
 * 18 § Party AI, Retreat; § Morale: half the party lost breaks it (the floor of the morale scale),
 * as does a morale fallen to its breaking point; the loss of its captains is a large drop in it,
 * taken once, and a leaderless party out of a fight breaks sooner.
 */
function broken(P: Party, standing: readonly EntityId[], ctx: TickContext): boolean {
  // A member caged or down that no event has counted yet (a save from before morale) counts now.
  const entities = ctx.world.entities;
  for (const m of P.members) {
    const H = entities.get(m, C.Hostile);
    if (H === undefined || standing.includes(m)) continue;
    if ((entities.get(m, C.Creature)?.cagedIn ?? 0) !== 0) countCasualty(P, H, 'caged');
    else if (entities.get(m, C.Body)?.conscious === false) countCasualty(P, H, 'down');
  }
  const leaderless = captainsLost(P, standing);
  countCaptainLoss(P, leaderless);
  return ((P.members.length - standing.length) * 100) / P.members.length >= RETREAT_LOSS_PERCENT ||
    moraleBroken(P, leaderless);
}

/**
 * 18 § Party AI: a caravan's party is 20's, not a threat party. Its state and its end are 20's, so
 * the party think, the casualty check and morale never touch it.
 */
function threatParty(P: Party): boolean {
  return P.purpose !== 'caravan';
}

/** Unconscious casualties are still living members; only actual deaths can wipe a party. */
function retreatSurvivors(P: Party, ctx: TickContext): boolean {
  if (!P.members.some((id) => inParty(ctx.world.entities, id))) return false;
  if (P.purpose !== 'restless' && P.state !== 'retreat') {
    P.state = 'retreat';
    P.stateSince = ctx.tick;
    P.outcome = P.loot.length > 0 ? 'looted' : 'repelled';
  }
  return true;
}

/** The party's end once no member is left in it: gone, with its final outcome and RaidEnded. */
function endParty(partyId: EntityId, P: Party, ctx: TickContext): void {
  P.state = 'gone';
  P.stateSince = ctx.tick;
  const outcome = finalPartyOutcome(P);
  P.outcome = outcome;
  ctx.emit({ type: 'RaidEnded', partyId, outcome });
}

export function checkPartyCasualties(partyId: EntityId, P: Party, ctx: TickContext): void {
  if (!threatParty(P) || P.state === 'gone') return;
  const entities = ctx.world.entities;
  // T-523: a party with no member left ends on that casualty, in every state, as its next think
  // would end it; a retreating or restless party no longer lingers until then.
  if (!P.members.some((id) => inParty(entities, id))) {
    endParty(partyId, P, ctx);
    return;
  }
  if (P.state === 'retreat' || P.purpose === 'restless') return;
  const alive = P.members.filter((m) => {
    if (!inParty(entities, m)) return false;
    const body = entities.get(m, C.Body);
    if (body !== undefined && !body.conscious) return false;
    return true;
  });

  if (alive.length === 0) {
    retreatSurvivors(P, ctx);
    return;
  }

  if (broken(P, alive, ctx)) {
    P.state = 'retreat';
    P.stateSince = ctx.tick;
    P.outcome = P.loot.length > 0 ? 'looted' : 'repelled';
  }
}

/**
 * 18 § Engage: an engaged party stalls when none of its members has struck a blow (16's last
 * engagement: a melee attack, a shot or a cast) or worked at a door for ENGAGE_STALL_TICKS. A
 * creature the labels call reachable may still be one no member can come to (its walk fails or
 * never settles), and 16 drops it only for the member to take it again at once.
 */
function stalledInEngage(P: Party, alive: readonly EntityId[], ctx: TickContext): boolean {
  const combat = ctx.readers.has('16') ? ctx.readers.of<CombatReader>('16') : undefined;
  let since = P.blowSince ?? ctx.tick;
  for (const m of alive) {
    const blow = combat?.lastEngagementTick(m);
    if (blow !== undefined && blow > since) since = blow;
    if ((ctx.world.entities.get(m, C.Hostile)?.breakingDoorId ?? 0) !== 0) since = ctx.tick;
  }
  P.blowSince = since;
  return ctx.tick - since >= ENGAGE_STALL_TICKS;
}

export function partyThink(partyId: EntityId, P: Party, ctx: TickContext, targets?: readonly FortressTarget[]): void {
  const entities = ctx.world.entities;
  if (P.state === 'gone' || !threatParty(P)) return;
  if (P.state !== 'approach') delete P.goalIdleSince;
  if (P.state !== 'engage') delete P.blowSince;
  if (P.state === 'retreat' && ctx.tick - P.stateSince >= RETREAT_GIVE_UP_DAYS * TICKS_PER_DAY) {
    const remaining = P.members.filter((m) => inParty(entities, m));
    if (remaining.length > 0) {
      for (const m of remaining) despawnMember(m, partyId, P, ctx);
      return;
    }
  }

  const alive = P.members.filter((m) => {
    if (!inParty(entities, m)) return false;
    const body = entities.get(m, C.Body);
    if (body !== undefined && !body.conscious) return false;
    return true;
  });

  if (alive.length === 0) {
    if (!retreatSurvivors(P, ctx)) endParty(partyId, P, ctx);
    return;
  }

  if (P.leaderId === 0 || !alive.includes(P.leaderId)) {
    const firstAlive = alive[0];
    if (firstAlive !== undefined) {
      P.leaderId = firstAlive;
    }
  }

  if (P.state !== 'retreat' && P.state !== 'gone' && P.purpose !== 'restless' && broken(P, alive, ctx)) {
    P.state = 'retreat';
    P.stateSince = ctx.tick;
    P.outcome = P.loot.length > 0 ? 'looted' : 'repelled';
  }

  switch (P.state) {
    case 'approach': {
      if (P.purpose === 'thief') {
        chooseGoal(P, ctx);
        const waited = ctx.tick - P.arrivedTick;
        // 18 § Party AI: no quarry after THIEF_WAIT_DAYS, or none reached after THIEF_APPROACH_DAYS.
        if ((P.goalEntity === 0 && waited >= THIEF_WAIT_DAYS * TICKS_PER_DAY) || waited >= THIEF_APPROACH_DAYS * TICKS_PER_DAY) {
          P.state = 'retreat';
          P.stateSince = ctx.tick;
          P.outcome = 'withdrew';
        }
        break;
      }
      if (P.goalTile === 0) {
        chooseGoal(P, ctx);
      }
      let seesFortress = false;
      // A stalled party (§ Engage) is not drawn back into the fight by sight.
      for (const m of P.stalled === true ? [] : alive) {
        if (P.purpose === 'ambush' && entities.get(m, C.Hostile)?.stealthed === true) continue;
        const mPos = positionOf(m, ctx);
        if (mPos >= 0 && findCombatTarget(m, mPos, 'warriors', ctx, targets, true) !== 0) {
          seesFortress = true;
          break;
        }
      }
      if (seesFortress) {
        delete P.goalIdleSince;
        P.state = 'engage';
        P.stateSince = ctx.tick;
      } else if (P.purpose !== 'restless') {
        const leaderPos = positionOf(P.leaderId, ctx);
        const arrived = leaderPos >= 0 && P.goalTile !== 0 && chebyshevDist(leaderPos, P.goalTile, ctx.world.map) <= 1;
        if (arrived) {
          P.goalIdleSince ??= ctx.tick;
          if (ctx.tick - P.goalIdleSince >= ENGAGE_IDLE_TICKS) {
            delete P.goalIdleSince;
            P.state = 'loiter';
            P.stateSince = ctx.tick;
          }
        } else {
          delete P.goalIdleSince;
        }
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
      } else if (P.purpose !== 'restless' && stalledInEngage(P, alive, ctx)) {
        // It sees what it cannot strike: it loiters, and only its loiter time ends it.
        P.state = 'loiter';
        P.stateSince = ctx.tick;
        P.stalled = true;
        delete P.blowSince;
      } else {
        P.stateSince = ctx.tick;
      }
      break;
    }
    case 'loiter': {
      // If a broken door makes the goal reachable, the party returns to approach.
      if (P.goalUnreachable && !P.walkUnreachable) {
        chooseGoal(P, ctx);
        if (!P.goalUnreachable) {
          P.state = 'approach';
          P.stateSince = ctx.tick;
          break;
        }
      }
      let seesReachableFortress = false;
      for (const m of P.stalled === true ? [] : alive) {
        if (P.purpose === 'ambush' && entities.get(m, C.Hostile)?.stealthed === true) continue;
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

/** Creature and trap spotting share one saved party-wide reveal. */
export function springAmbush(partyId: EntityId, P: Party, ctx: TickContext): void {
  if (P.ambushSprung === true) return;
  P.ambushSprung = true;
  P.state = 'engage';
  P.stateSince = ctx.tick;
  delete P.goalIdleSince;
  for (const m of P.members) {
    const hostile = ctx.world.entities.get(m, C.Hostile);
    if (!ctx.world.entities.alive(m) || hostile === undefined) continue;
    hostile.stealthed = false;
    hostile.spotted = true;
  }
  ctx.emit({ type: 'AmbushSprung', partyId });
}

/**
 * 18 § Engage: a member keeps the target it holds while that one is no farther than the nearest
 * (and, for an archer, while it is a soldier or the nearest is not). Retargeting on a tie, between
 * two creatures on two tiles, restarted the member's path every think and it never moved.
 */
function keepHeldTarget(m: EntityId, pos: TileIndex, found: EntityId, isArcher: boolean, requireReachable: boolean, ctx: TickContext): EntityId {
  const entities = ctx.world.entities;
  const held = ctx.world.services.combat?.targetOf(m) ?? 0;
  if (held === 0 || held === found || !entities.alive(held) || entities.get(held, C.Creature)?.faction !== 'fortress') return found;
  const map = ctx.world.map;
  const heldPos = positionOf(held, ctx);
  const foundPos = positionOf(found, ctx);
  if (heldPos < 0 || foundPos < 0) return found;
  const distance = (t: TileIndex): number => Math.max(Math.abs(map.xOf(t) - map.xOf(pos)), Math.abs(map.yOf(t) - map.yOf(pos)));
  if (Math.abs(map.zOf(heldPos) - map.zOf(pos)) > 2 || distance(heldPos) > PERCEPTION_RADIUS || distance(heldPos) > distance(foundPos)) return found;
  if (isArcher && entities.has(found, C.Soldier) && !entities.has(held, C.Soldier)) return found;
  if (!ctx.readers.pathing.lineOfSight(pos, heldPos)) return found;
  if (requireReachable && !ctx.readers.pathing.reachable(pos, heldPos, entities.get(m, C.Motion)?.movementClass ?? 'walker')) return found;
  return held;
}

/**
 * 18 § Morale, Nerve: the raider runs for its edge and leaves the map; it drops the loot it holds
 * on its tile, and its flight costs its party morale again (counted when the flight begins).
 */
function loseNerve(m: EntityId, H: Hostile, P: Party, pos: TileIndex, ctx: TickContext): void {
  H.nerveLost = true;
  const entities = ctx.world.entities;
  for (const lootId of P.loot.slice()) {
    if (entities.get(lootId, C.Item)?.carriedBy !== m) continue;
    ctx.world.services.items?.dropAt(lootId, pos);
    P.loot = P.loot.filter((id) => id !== lootId);
  }
  ctx.world.services.combat?.clearTarget(m);
  ctx.emit({ type: 'HostileFled', id: m, nerve: true, species: entities.get(m, C.Creature)?.species ?? 0 });
  H.behaviorState = 'flee';
  countCasualty(P, H, 'fled');
  checkPartyCasualties(H.partyId, P, ctx);
}

export function memberThink(m: EntityId, H: Hostile, P: Party | undefined, ctx: TickContext, targets?: readonly FortressTarget[]): void {
  const entities = ctx.world.entities;
  if (!entities.alive(m)) return;
  if (P?.state === 'retreat' && ctx.tick - P.stateSince >= RETREAT_GIVE_UP_DAYS * TICKS_PER_DAY) {
    despawnMember(m, H.partyId, P, ctx);
    return;
  }

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
      if (P.state !== 'retreat') P.stateSince = ctx.tick;
      P.state = 'retreat';
      P.outcome = P.loot.length > 0 || (P.escapedLootCount ?? 0) > 0 ? 'looted' : 'withdrew';
    } else if (P?.purpose === 'ambush') {
      springAmbush(H.partyId, P, ctx);
    }
  }

  // 2. Retreating
  if (P && P.state === 'retreat') {
    retreatMember(m, H, P, pos, ctx);
    return;
  }

  // 3. Losing its nerve (18 § Morale, Nerve): below its nerve the raider runs on its own, for good.
  if (P !== undefined && H.nerveLost !== true && P.state !== 'retreat' && hasMorale(P) && moraleOf(P) < nerveOf(m, H, ctx)) {
    loseNerve(m, H, P, pos, ctx);
  }

  // 3b. Fleeing on low blood, or with its nerve lost
  if (P?.purpose !== 'restless' && body && body.maxBlood > 0) {
    const creature = entities.get(m, C.Creature);
    if (creature && creature.faction !== 'deep') {
      const spTable = ctx.registry.table<{ id: string; temper: string; fleeBloodPercent: number | null }>('creatures');
      const sp = spTable.byIndex(creature.species);
      const fleeThresh = sp?.fleeBloodPercent ?? (sp?.temper === 'aggressive' ? null : 50);
      if (H.nerveLost === true || (fleeThresh !== null && ((body.blood / body.maxBlood) * 100) < fleeThresh)) {
        if (H.behaviorState !== 'flee') {
          H.behaviorState = 'flee';
          ctx.emit({ type: 'HostileFled', id: m });
          if (P !== undefined) {
            countCasualty(P, H, 'fled');
            checkPartyCasualties(H.partyId, P, ctx);
            if (P.state === 'retreat') {
              retreatMember(m, H, P, pos, ctx);
              return;
            }
          }
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
    const isArcher = shootsFromRange(H.role);
    const allowUnreachable = isLoitering && isArcher;
    const found = findCombatTarget(m, pos, H.role, ctx, targets, !allowUnreachable);
    const target = found === 0 ? 0 : keepHeldTarget(m, pos, found, isArcher, !allowUnreachable, ctx);
    if (target !== 0) {
      ctx.world.services.combat?.setTarget(m, target);
      H.behaviorState = 'attack';
      if (P && P.stalled !== true && (P.state === 'approach' || (P.state === 'loiter' && !allowUnreachable))) {
        const targetPos = positionOf(target, ctx);
        if (targetPos >= 0 && ctx.readers.pathing.reachable(pos, targetPos, entities.get(m, C.Motion)?.movementClass ?? 'walker')) {
          P.state = 'engage';
          P.stateSince = ctx.tick;
        }
      }
      return;
    } else if ((ctx.world.services.combat?.targetOf(m) ?? 0) !== 0) {
      // Let 16 finish its TARGET_LOSE_TICKS check; an AI fallback walk must not
      // replace that combat path while the target is still held.
      H.behaviorState = 'attack';
      return;
    }
  }

  if (H.behaviorState === 'attack' && ctx.world.services.combat?.targetOf(m) === 0) {
    H.behaviorState = P?.state ?? 'approach';
  }

  // 5. Break blocking doors; loot only in loiter.
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

  if (P && P.state === 'loiter') {
    if (canLootItem(m, P, ctx)) {
      const lootItem = findUnattendedItemWithinRadius(pos, LOOT_RADIUS, ctx, P);
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

  if (P.state === 'approach' && P.goalTile === 0) {
    chooseGoal(P, ctx);
  }
  if (P.goalTile === 0) return;

  if (P.purpose === 'thief') {
    if (P.goalEntity === 0) return;
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
    const leaderArrivedAtGoal = pos === P.goalTile || (sameZ && distToGoal <= 1);

    if (leaderArrivedAtGoal) {
      if (P.goalUnreachable) {
        if (P.state === 'approach') {
          P.state = 'loiter';
          P.stateSince = ctx.tick;
        }
      } else if (P.purpose === 'bandits') {
        if (P.state === 'approach') {
          banditPartyLootStockpile(P, ctx);
        }
      }
      return;
    }

    const outcome = ctx.world.services.movement?.walkTo(m, P.goalTile, 'combat', ctx);
    if (outcome === 'unreachable') {
      if (P.state === 'approach') {
        P.walkUnreachable = true;
        if (!P.goalUnreachable) {
          P.goalUnreachable = true;
          const nearest = ctx.readers.pathing.nearestReachable(pos, P.goalTile, 'walker', 3000);
          P.goalTile = nearest >= 0 ? nearest : pos;
          const posAfter = positionOf(m, ctx);
          const sameZNew = posAfter >= 0 && map.zOf(posAfter) === map.zOf(P.goalTile);
          const distNew = sameZNew ? chebyshevDist(posAfter, P.goalTile, map) : Infinity;
          if (posAfter === P.goalTile || (sameZNew && distNew <= 1)) {
            P.state = 'loiter';
            P.stateSince = ctx.tick;
          }
        } else {
          P.state = 'loiter';
          P.stateSince = ctx.tick;
        }
      }
    } else {
      const posAfter = positionOf(m, ctx);
      const sameZAfter = posAfter >= 0 && map.zOf(posAfter) === map.zOf(P.goalTile);
      const distAfter = sameZAfter ? chebyshevDist(posAfter, P.goalTile, map) : Infinity;
      const arrivedAfter = outcome === 'arrived' || posAfter === P.goalTile || (sameZAfter && distAfter <= 1);

      if (arrivedAfter) {
        if (P.goalUnreachable) {
          if (P.state === 'approach') {
            P.state = 'loiter';
            P.stateSince = ctx.tick;
          }
        } else if (P.purpose === 'bandits') {
          if (P.state === 'approach') {
            banditPartyLootStockpile(P, ctx);
          }
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
