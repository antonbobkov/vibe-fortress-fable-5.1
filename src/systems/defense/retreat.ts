import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { InitContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { RETREAT_SEARCH_LIMIT } from './constants';

export function retreatTile(ctx: InitContext, dwarfId: EntityId): TileIndex {
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
  const visited = new Set<TileIndex>([from]);
  const queue: { tile: TileIndex; doors: number }[] = [{ tile: from, doors: 0 }];
  let best = -1;
  let bestDistance = Infinity;
  for (let cursor = 0; cursor < queue.length && cursor < RETREAT_SEARCH_LIMIT; cursor += 1) {
    const node = queue[cursor] as { tile: TileIndex; doors: number };
    if (node.doors > 0 && !map.hasFlag(node.tile, TileFlag.Outdoor) && node.tile !== from) {
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
  const bedroom = buildings.bedroomOf(dwarfId);
  const zone = bedroom === 0 ? undefined : buildings.zone(bedroom);
  const tiles = zone?.tiles.filter((tile) => path.reachable(from, tile, 'walker')) ?? [];
  tiles.sort((a, b) => distance(a) - distance(b) || a - b);
  return tiles[0] ?? -1;
}
