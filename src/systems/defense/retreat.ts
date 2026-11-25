import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { InitContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { isShelterBarrier } from '@systems/dwarves/shelter';
import { RETREAT_SEARCH_LIMIT } from './constants';

/**
 * The tile a civilian shelters at (19 § Hearth alert retreat). `kept` is the tile it sheltered at
 * so far: with no hall reachable it is kept while the dwarf still reaches it.
 */
export function retreatTile(ctx: InitContext, dwarfId: EntityId, kept: TileIndex = -1): TileIndex {
  const pos = ctx.world.entities.get(dwarfId, C.Position);
  if (pos === undefined || !ctx.readers.has('14')) return -1;
  const map = ctx.world.map;
  const from = map.index(pos.x, pos.y, pos.z);
  const buildings = ctx.readers.of<BuildingsReader>('14');
  const path = ctx.readers.pathing;
  const distance = (a: TileIndex): number => Math.max(Math.abs(map.xOf(a) - pos.x), Math.abs(map.yOf(a) - pos.y)) + 6 * Math.abs(map.zOf(a) - pos.z);
  const hall = buildings.hearthHallTiles().filter((tile) => path.passable(tile, 'walker') && path.reachable(from, tile, 'walker') &&
    ctx.readers.entities.at(tile).every((id) => id === dwarfId || !ctx.readers.entities.has(id, C.Creature)));
  hall.sort((a, b) => distance(a) - distance(b) || a - b);
  if (hall.length > 0) return hall[0] as TileIndex;
  if (kept >= 0 && map.validIndex(kept) && path.passable(kept, 'walker') && !map.hasFlag(kept, TileFlag.Outdoor) &&
    !isShelterBarrier(buildings, kept) && path.reachable(from, kept, 'walker')) return kept;
  const visited = new Set<TileIndex>([from]);
  const queue: { tile: TileIndex; doors: number }[] = [{ tile: from, doors: 0 }];
  let best = -1;
  let bestDistance = Infinity;
  for (let cursor = 0; cursor < queue.length && cursor < RETREAT_SEARCH_LIMIT; cursor += 1) {
    const node = queue[cursor] as { tile: TileIndex; doors: number };
    if (node.doors > 0 && !map.hasFlag(node.tile, TileFlag.Outdoor) && node.tile !== from && !isShelterBarrier(buildings, node.tile)) {
      const d = distance(node.tile);
      if (d < bestDistance || (d === bestDistance && node.tile < best)) { best = node.tile; bestDistance = d; }
    }
    for (const tile of map.neighbors(node.tile)) {
      if (visited.has(tile) || !path.passable(tile, 'walker') || map.kindAt(tile) === TileKind.Open) continue;
      visited.add(tile);
      queue.push({ tile, doors: node.doors + (buildings.doorAt(tile) ? 1 : 0) });
    }
  }
  if (best >= 0) return best;
  if (indoorBehindDoor(ctx, buildings, from)) return from;
  const bedroom = buildings.bedroomOf(dwarfId);
  const zone = bedroom === 0 ? undefined : buildings.zone(bedroom);
  const tiles = zone?.tiles.filter((tile) => path.reachable(from, tile, 'walker')) ?? [];
  tiles.sort((a, b) => distance(a) - distance(b) || a - b);
  return tiles[0] ?? -1;
}

/**
 * Whether a dwarf already stands behind a door (19 § Hearth alert retreat, step 2): its tile is
 * indoor and not a doorway, and the indoor tiles it walks to from there without passing a door,
 * hatch, floodgate or drawbridge reach a door (within `RETREAT_SEARCH_LIMIT` tiles). That door's
 * outside is the outdoors, as 14 reads it, so the dwarf is on its inner side.
 */
function indoorBehindDoor(ctx: InitContext, buildings: BuildingsReader, from: TileIndex): boolean {
  const map = ctx.world.map;
  const path = ctx.readers.pathing;
  if (map.hasFlag(from, TileFlag.Outdoor) || isShelterBarrier(buildings, from)) return false;
  const seen = new Set<TileIndex>([from]);
  const queue: TileIndex[] = [from];
  for (let cursor = 0; cursor < queue.length && cursor < RETREAT_SEARCH_LIMIT; cursor += 1) {
    for (const tile of map.neighbors(queue[cursor] as TileIndex)) {
      if (seen.has(tile)) continue;
      // A door counts whether or not the alert has locked it yet.
      if (buildings.doorAt(tile)) return true;
      if (!path.passable(tile, 'walker') || map.kindAt(tile) === TileKind.Open) continue;
      seen.add(tile);
      if (map.hasFlag(tile, TileFlag.Outdoor) || isShelterBarrier(buildings, tile)) continue;
      queue.push(tile);
    }
  }
  return false;
}
