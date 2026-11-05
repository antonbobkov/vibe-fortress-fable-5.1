/**
 * The Deep implementation.
 * `02-systems/18-threats-monsters-and-raids.md` § The Deep,
 * `03-content/threat-schedules.md` § The Deep.
 */

import { C } from '@core/components';
import { TileKind, type Map3D } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { TICKS_PER_DAY } from '@core/constants';
import {
  DEEP_PRESSURE_PER_TILE,
  DEEP_THRESHOLDS,
  EMERGENCE_TILES,
  HOLLOW_WAVE_DAYS,
} from './constants';
import { findAdjacentLockedDoor } from './ai';

export interface DeepThresholdRow {
  readonly level: number;
  readonly pressure: number;
  readonly emergence: readonly { readonly species: string; readonly count: number }[];
  readonly text: string;
}

export interface DeepState {
  pressure: number;
  level: number;
  nextHollowWaveTick: number;
  hollowWaveIndex: number;
}

export function nextDeepThreshold(level: number): number {
  if (level < DEEP_THRESHOLDS.length) {
    return DEEP_THRESHOLDS[level] ?? 500;
  }
  return 500;
}

/**
 * Checks if any living magma wyrm exists in the world.
 */
export function magmaWyrmLives(ctx: TickContext): boolean {
  const speciesTable = ctx.registry.table<{ id: string }>('creatures');
  const wyrmIdx = speciesTable.index('magma_wyrm');
  if (wyrmIdx < 0) return false;
  for (const id of ctx.world.entities.with(C.Creature)) {
    if (!ctx.world.entities.alive(id)) continue;
    const c = ctx.world.entities.get(id, C.Creature);
    if (c && c.species === wyrmIdx) return true;
  }
  return false;
}

/**
 * Finds the emergence base tile: the most recently recorded base (a mined deepsilver tile, or the
 * tile of the building that worked a bar before any was mined) still adjacent to rock; else the
 * last one. -1 for an empty list: there is no base and no emergence.
 */
export function findEmergenceBaseTile(
  map: Map3D,
  deepsilverTiles: readonly TileIndex[],
): TileIndex {
  for (let k = deepsilverTiles.length - 1; k >= 0; k--) {
    const t = deepsilverTiles[k];
    if (t === undefined || !map.validIndex(t)) continue;
    const neighbors =
      typeof map.neighbors26 === 'function'
        ? map.neighbors26(t)
        : typeof map.neighbors6 === 'function'
          ? map.neighbors6(t)
          : [];
    const hasAdjacentRock = neighbors.some((n) => map.kindAt(n) === TileKind.Wall);
    if (hasAdjacentRock) {
      return t;
    }
  }
  return deepsilverTiles[deepsilverTiles.length - 1] ?? -1;
}

/**
 * Finds the nearest wall tiles around the emergence base tile.
 */
export function findNearestWallTiles(
  map: Map3D,
  baseTile: TileIndex,
  count: number,
): TileIndex[] {
  if (!map.validIndex(baseTile)) return [];
  const baseX = map.xOf(baseTile);
  const baseY = map.yOf(baseTile);
  const baseZ = map.zOf(baseTile);

  const candidates: { tile: TileIndex; dist: number }[] = [];

  const zMin = Math.max(0, baseZ - 2);
  const zMax = Math.min(map.d - 1, baseZ + 2);

  for (let z = zMin; z <= zMax; z++) {
    for (let dy = -15; dy <= 15; dy++) {
      for (let dx = -15; dx <= 15; dx++) {
        const x = baseX + dx;
        const y = baseY + dy;
        if (!map.inBounds(x, y, z)) continue;
        const i = map.index(x, y, z);
        if (map.kindAt(i) === TileKind.Wall) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy)) + Math.abs(z - baseZ) * 4;
          candidates.push({ tile: i, dist });
        }
      }
    }
  }

  candidates.sort((a, b) => a.dist - b.dist);
  return candidates.slice(0, count).map((c) => c.tile);
}

/**
 * Finds the nearest living fortress creature anywhere on the map.
 */
export function findNearestFortressTarget(
  fromTile: TileIndex,
  ctx: TickContext,
): EntityId {
  const map = ctx.world.map;
  const entities = ctx.world.entities;
  const fx = map.xOf(fromTile);
  const fy = map.yOf(fromTile);
  const fz = map.zOf(fromTile);

  let bestTarget = 0;
  let bestDist = Infinity;

  for (const c of entities.with(C.Creature, C.Position)) {
    if (!entities.alive(c)) continue;
    const comp = entities.get(c, C.Creature);
    if (!comp || comp.faction !== 'fortress') continue;

    const pos = entities.get(c, C.Position);
    if (!pos) continue;

    const dist = Math.max(Math.abs(pos.x - fx), Math.abs(pos.y - fy)) + Math.abs(pos.z - fz) * 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestTarget = c;
    }
  }

  return bestTarget;
}

/**
 * Triggers a Deep emergence at the deepsilver location:
 * - Cracks EMERGENCE_TILES (4) wall tiles to open via terrain API
 * - Spawns Hollow-born in them with faction 'deep'
 * - Targets nearest fortress creature anywhere on map
 * - Emits MonsterEmerged { ids, tile }
 */
export function triggerDeepEmergence(
  ctx: TickContext,
  deepsilverTiles: readonly TileIndex[],
  emergenceList: readonly { readonly species: string; readonly count: number }[],
  hollowBorn: Set<EntityId>,
): EntityId[] {
  const map = ctx.world.map;
  const baseTile = findEmergenceBaseTile(map, deepsilverTiles);
  if (baseTile < 0) return [];
  const crackedWalls = findNearestWallTiles(map, baseTile, EMERGENCE_TILES);

  for (const wt of crackedWalls) {
    ctx.terrain.setKind(wt, TileKind.Open, 0);
  }

  const emergenceTiles = crackedWalls.length > 0 ? crackedWalls : [baseTile];
  const speciesTable = ctx.registry.table<{
    id: string;
    flags?: { stealth?: boolean; breaksDoors?: boolean };
  }>('creatures');

  // Build full list of species to spawn
  const wyrmActive = magmaWyrmLives(ctx);
  const toSpawn: string[] = [];
  for (const item of emergenceList) {
    let sp = item.species;
    if (sp === 'magma_wyrm' && wyrmActive) {
      sp = 'hollow_stalker';
    }
    for (let c = 0; c < item.count; c++) {
      toSpawn.push(sp);
    }
  }

  const spawnedIds: EntityId[] = [];

  for (let k = 0; k < toSpawn.length; k++) {
    const sp = toSpawn[k] ?? 'hollow_crawler';
    const spawnTile = emergenceTiles[k % emergenceTiles.length] ?? baseTile;
    const spIdx = speciesTable.index(sp);
    const id = ctx.world.services.spawn.creature(spIdx, spawnTile, 'deep');
    if (id !== 0) {
      spawnedHollowBorn(ctx, id, spawnTile, hollowBorn);
      spawnedIds.push(id);
    }
  }

  ctx.emit({ type: 'MonsterEmerged', ids: spawnedIds, tile: baseTile });
  return spawnedIds;
}

/**
 * A creature of the `deep` faction that has just appeared becomes Hollow-born: `Hostile` (role
 * `hollow`, attacking, stealthed when its species has stealth or `hidden` says so), a member of
 * `hollowBorn`, and the nearest fortress creature as its target. The emergence and 25's turned
 * summon (`SummonTurned`, which comes through hidden) both come through here.
 */
export function spawnedHollowBorn(ctx: TickContext, id: EntityId, tile: TileIndex, hollowBorn: Set<EntityId>, hidden = false): void {
  const creature = ctx.world.entities.get(id, C.Creature);
  if (creature === undefined || !ctx.world.entities.alive(id)) return;
  const species = ctx.registry.table<{ id: string; flags?: { stealth?: boolean } }>('creatures').byIndex(creature.species);
  ctx.world.entities.add(id, C.Hostile, {
    partyId: 0,
    role: 'hollow',
    behaviorState: 'attack',
    stealthed: hidden || species?.flags?.stealth === true,
    spotted: false,
    breakingDoorId: 0,
    breakingSince: 0,
  });
  hollowBorn.add(id);
  const target = findNearestFortressTarget(tile, ctx);
  if (target !== 0) {
    ctx.world.services.combat?.setTarget(id, target);
  }
}

/**
 * Handles DeepsilverMined event: the tile becomes an emergence base, and the pressure rises by
 * DEEP_PRESSURE_PER_TILE (10).
 */
export function handleDeepsilverMined(
  tile: TileIndex,
  ctx: TickContext,
  deepsilverTiles: TileIndex[],
  deepState: DeepState,
  hollowBorn: Set<EntityId>,
): void {
  if (tile >= 0 && !deepsilverTiles.includes(tile)) {
    deepsilverTiles.push(tile);
  }
  addDeepPressure(DEEP_PRESSURE_PER_TILE, ctx, deepsilverTiles, deepState, hollowBorn);
}

/**
 * Handles DeepsilverWorked (25 § Deepsilver): a bar worked at a `rune_work` building raises the
 * pressure by the event's amount. With no deepsilver tile mined yet, the building's tile becomes the
 * emergence base, so a fortress that bought its bar still has one.
 */
export function handleDeepsilverWorked(
  amount: number,
  tile: TileIndex,
  ctx: TickContext,
  deepsilverTiles: TileIndex[],
  deepState: DeepState,
  hollowBorn: Set<EntityId>,
): void {
  if (!(amount > 0)) return;
  if (deepsilverTiles.length === 0 && ctx.world.map.validIndex(tile)) deepsilverTiles.push(tile);
  addDeepPressure(amount, ctx, deepsilverTiles, deepState, hollowBorn);
}

/**
 * Adds pressure, then for every threshold crossed (levels 1..4) emits DeepStirred { level } and
 * triggers its emergence.
 */
export function addDeepPressure(
  amount: number,
  ctx: TickContext,
  deepsilverTiles: readonly TileIndex[],
  deepState: DeepState,
  hollowBorn: Set<EntityId>,
): void {
  deepState.pressure += amount;
  if (ctx.world.fortress) {
    ctx.world.fortress.deepPressure = deepState.pressure;
  }

  const thresholds = ctx.registry.derived<readonly DeepThresholdRow[]>('deepThresholds');

  while (deepState.level < 4) {
    const nextLevel = deepState.level + 1;
    const row = thresholds.find((r) => r.level === nextLevel);
    if (!row || deepState.pressure < row.pressure) {
      break;
    }

    deepState.level = nextLevel;
    if (ctx.world.fortress) {
      ctx.world.fortress.deepLevel = deepState.level;
    }

    ctx.emit({ type: 'DeepStirred', level: deepState.level });
    triggerDeepEmergence(ctx, deepsilverTiles, row.emergence, hollowBorn);

    if (deepState.level === 4) {
      deepState.nextHollowWaveTick = ctx.tick + HOLLOW_WAVE_DAYS * TICKS_PER_DAY;
      deepState.hollowWaveIndex = 1;
    }
  }
}

/**
 * Steps living Hollow-born creatures:
 * - Seeks nearest fortress creature anywhere on map
 * - Breaks doors if adjacent to locked door and has breaksDoors flag
 * - Paths towards target
 */
export function stepHollowBorn(
  ctx: TickContext,
  hollowBorn: Set<EntityId>,
): void {
  const entities = ctx.world.entities;
  const map = ctx.world.map;
  const spTable = ctx.registry.table<{
    id: string;
    flags?: { breaksDoors?: boolean };
    breaksDoors?: boolean;
  }>('creatures');

  for (const id of hollowBorn) {
    if (!entities.alive(id)) {
      hollowBorn.delete(id);
      continue;
    }

    const H = entities.get(id, C.Hostile);
    if (!H) continue;

    const pos = entities.get(id, C.Position);
    if (!pos) continue;
    const myTile = map.index(pos.x, pos.y, pos.z);

    let target = ctx.world.services.combat?.targetOf(id) ?? 0;
    if (target === 0 || !entities.alive(target)) {
      target = findNearestFortressTarget(myTile, ctx);
      if (target !== 0) {
        ctx.world.services.combat?.setTarget(id, target);
      }
    }

    if (target === 0) continue;

    const targetPos = entities.get(target, C.Position);
    if (!targetPos) continue;

    const dx = Math.abs(pos.x - targetPos.x);
    const dy = Math.abs(pos.y - targetPos.y);
    const dz = Math.abs(pos.z - targetPos.z);
    const isAdjacent = dz === 0 && Math.max(dx, dy) <= 1;

    const creature = entities.get(id, C.Creature);
    const spDef = creature ? spTable.byIndex(creature.species) : undefined;
    const breaksDoors = spDef?.flags?.breaksDoors === true || spDef?.breaksDoors === true;

    if (breaksDoors) {
      const lockedDoor = findAdjacentLockedDoor(myTile, ctx);
      if (lockedDoor !== 0) {
        H.breakingDoorId = lockedDoor;
        ctx.emit({ type: 'DoorBreakAttempt', id, doorId: lockedDoor });
      } else {
        H.breakingDoorId = 0;
      }
    }

    if (!isAdjacent) {
      const targetTile = map.index(targetPos.x, targetPos.y, targetPos.z);
      ctx.world.services.movement?.walkTo(id, targetTile, 'combat', ctx);
    }
  }
}

/**
 * Checks and triggers recurring Hollow waves after level 4 every HOLLOW_WAVE_DAYS (28).
 * Wave n brings 3 + n crawlers, 1 + floor(n / 2) stalkers, and a maw every third wave.
 */
export function checkHollowWave(
  ctx: TickContext,
  deepsilverTiles: readonly TileIndex[],
  deepState: DeepState,
  hollowBorn: Set<EntityId>,
): void {
  if (
    deepState.level >= 4 &&
    deepState.nextHollowWaveTick > 0 &&
    ctx.tick >= deepState.nextHollowWaveTick
  ) {
    const n = deepState.hollowWaveIndex;
    const emergenceList: { species: string; count: number }[] = [
      { species: 'hollow_crawler', count: 3 + n },
      { species: 'hollow_stalker', count: 1 + Math.floor(n / 2) },
    ];
    if (n % 3 === 0) {
      emergenceList.push({ species: 'hollow_maw', count: 1 });
    }

    triggerDeepEmergence(ctx, deepsilverTiles, emergenceList, hollowBorn);

    deepState.hollowWaveIndex += 1;
    deepState.nextHollowWaveTick = ctx.tick + HOLLOW_WAVE_DAYS * TICKS_PER_DAY;
  }
}
