/**
 * Fire, rising water and the dwarf brain (`10` § Behavior selection, step 1): a dwarf that stands on
 * a burning tile, or on burnable ground beside one, leaves for the nearest ground that cannot burn;
 * one in water that could drown it leaves for the nearest dry tile.
 */
import { C } from '@core/components';
import { FLUID_DEEP_LEVEL, FLUID_WADE_LEVEL } from '@core/constants';
import { FluidType, TileFlag } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { MaterialsReader } from '@systems/materials/reader';
import type { Map3D } from '@core/map3d';
import { FIRE_AVOID_RADIUS, FIRE_AVOID_TICKS, FIRE_FLEE_NODE_LIMIT, WATER_FLEE_NODE_LIMIT } from './constants';

/** The activity text of a dwarf running from a fire (its `flee` behaviour with no threat held). */
export const FIRE_FLEE_ACTIVITY = 'Fleeing the fire';

/** The activity text of a dwarf walking out of rising water. */
export const WATER_FLEE_ACTIVITY = 'Leaving the water';

/** The activity text of a dwarf put to flight by Dread or a fearsome blow (a `flee` effect, 25 § Effects). */
export const DREAD_FLEE_ACTIVITY = 'Fleeing in dread';

/**
 * Whether a dwarf at `tile` must leave the water it stands in (`10` § Behavior selection): deep water
 * always; water at wading depth when it has stopped there, since the next rise would drown it. A
 * dwarf walking through wading water is on its way out of it already.
 */
export function waterDanger(map: Map3D, tile: TileIndex, walking: boolean): boolean {
  if (map.fluidFrozenAt(tile) || map.fluidTypeAt(tile) !== FluidType.Water) return false;
  const level = map.fluidLevelAt(tile);
  return level >= FLUID_DEEP_LEVEL || (level >= FLUID_WADE_LEVEL && !walking);
}

/**
 * The nearest tile the dwarf reaches with no water on it, by legal steps, breadth first within
 * `WATER_FLEE_NODE_LIMIT` tiles, ties by tile index. With none in reach, the nearest tile below
 * wading depth; -1 when the search finds neither.
 */
export function findWaterRefuge(ctx: TickContext, id: EntityId, from: TileIndex): TileIndex {
  const map = ctx.world.map;
  const creature = ctx.world.entities.get(id, C.Creature);
  const mover = { faction: creature?.faction, size: creature?.sizeClass };
  let frontier = [from];
  const seen = new Set([from]);
  let visited = 0;
  let fallback = -1;
  while (frontier.length > 0 && visited < WATER_FLEE_NODE_LIMIT) {
    const next: TileIndex[] = [];
    for (const tile of frontier) {
      if (visited >= WATER_FLEE_NODE_LIMIT) break;
      visited += 1;
      if (tile !== from) {
        const level = map.fluidLevelAt(tile);
        if (level === 0) return tile;
        if (fallback < 0 && level < FLUID_WADE_LEVEL) fallback = tile;
      }
      for (const [to] of ctx.readers.pathing.edges(tile, 'walker', mover)) {
        if (seen.has(to)) continue;
        seen.add(to);
        next.push(to);
      }
    }
    frontier = next.sort((a, b) => a - b);
  }
  return fallback;
}

/**
 * Whether a dwarf standing at `tile` is in danger from fire: the tile burns, or it can burn and a
 * cardinal neighbour or the tile below it burns (the neighbours fire spreads from, `05` § Fire).
 */
export function fireDanger(ctx: TickContext, tile: TileIndex): boolean {
  if (!ctx.readers.has('05')) return false;
  const map = ctx.world.map;
  if (map.hasFlag(tile, TileFlag.Burning)) return true;
  for (const [dx, dy, dz] of [[0, -1, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, 0, -1]] as const) {
    const near = map.offset(tile, dx, dy, dz);
    if (near >= 0 && map.hasFlag(near, TileFlag.Burning)) return ctx.readers.of<MaterialsReader>('05').burnableTile(tile);
  }
  return false;
}

/**
 * The nearest tile the dwarf reaches that is not burning and cannot burn, by legal steps (burning
 * tiles block movement), breadth first within `FIRE_FLEE_NODE_LIMIT` tiles, ties by tile index.
 * With none in reach, the nearest tile in no fire danger (`fireDanger`), though it can burn; -1
 * when the search finds neither.
 */
export function findFireRefuge(ctx: TickContext, id: EntityId, from: TileIndex): TileIndex {
  const materials = ctx.readers.of<MaterialsReader>('05');
  const creature = ctx.world.entities.get(id, C.Creature);
  const mover = { faction: creature?.faction, size: creature?.sizeClass };
  let frontier = [from];
  const seen = new Set([from]);
  let visited = 0;
  let fallback = -1;
  while (frontier.length > 0 && visited < FIRE_FLEE_NODE_LIMIT) {
    const next: TileIndex[] = [];
    for (const tile of frontier) {
      if (visited >= FIRE_FLEE_NODE_LIMIT) break;
      visited += 1;
      if (tile !== from && !ctx.world.map.hasFlag(tile, TileFlag.Burning)) {
        if (!materials.burnableTile(tile)) return tile;
        if (fallback < 0 && !fireDanger(ctx, tile)) fallback = tile;
      }
      for (const [to] of ctx.readers.pathing.edges(tile, 'walker', mover)) {
        if (seen.has(to)) continue;
        seen.add(to);
        next.push(to);
      }
    }
    frontier = next.sort((a, b) => a - b);
  }
  return fallback;
}

/** Whether a dwarf whose last flight from fire was at `flight` (absent: never) still keeps away from fires at `tick`. */
export function avoidsFire(flight: number | undefined, tick: number): boolean {
  return flight !== undefined && tick - flight <= FIRE_AVOID_TICKS;
}

/** Whether a tile within `FIRE_AVOID_RADIUS` of `tile`, on its level, burns. */
export function burnsNear(map: Map3D, tile: TileIndex): boolean {
  if (!map.validIndex(tile)) return false;
  const x = map.xOf(tile);
  const y = map.yOf(tile);
  const z = map.zOf(tile);
  for (let dy = -FIRE_AVOID_RADIUS; dy <= FIRE_AVOID_RADIUS; dy += 1) {
    for (let dx = -FIRE_AVOID_RADIUS; dx <= FIRE_AVOID_RADIUS; dx += 1) {
      if (x + dx < 0 || y + dy < 0 || x + dx >= map.w || y + dy >= map.h) continue;
      if (map.hasFlag(map.index(x + dx, y + dy, z), TileFlag.Burning)) return true;
    }
  }
  return false;
}
