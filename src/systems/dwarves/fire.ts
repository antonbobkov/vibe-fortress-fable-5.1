/**
 * Fire and the dwarf brain (`10` § Behavior selection, step 1): a dwarf that stands on a burning
 * tile, or on burnable ground beside one, leaves for the nearest ground that cannot burn.
 */
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { MaterialsReader } from '@systems/materials/reader';
import { FIRE_FLEE_NODE_LIMIT } from './constants';

/** The activity text of a dwarf running from a fire (its `flee` behaviour with no threat held). */
export const FIRE_FLEE_ACTIVITY = 'Fleeing the fire';

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
