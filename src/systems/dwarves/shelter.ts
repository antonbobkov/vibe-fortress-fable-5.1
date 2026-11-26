/**
 * The shelter of a civilian under a `hearth` alert (10 § Behavior selection, step 2), shared by the
 * dwarf brain (10) and the job board (11) so that both read one area.
 */
import { TileFlag, TileKind, type Map3D } from '@core/map3d';
import type { ReaderSetLike } from '@core/system';
import type { TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { RETREAT_SEARCH_LIMIT } from '@systems/defense/constants';
import { CIVILIAN_FLEE_NODE_LIMIT, COLD_SHELTER_C } from './constants';

/** Whether a door, hatch, floodgate or drawbridge stands on the tile: the shelter ends there. */
export function isShelterBarrier(buildings: BuildingsReader | undefined, tile: TileIndex): boolean {
  if (buildings === undefined) return false;
  if (buildings.doorAt(tile)) return true;
  const id = buildings.at(tile);
  if (id === 0) return false;
  const state = buildings.mechanismState(id);
  return state !== '' && state !== 'on' && state !== 'off';
}

/**
 * The tiles a civilian sheltering at `shelter` is sheltered by: the hearth hall when `shelter` is
 * one of its tiles, else the indoor tiles around `shelter` that a dwarf walks to along the walker
 * graph (a level changes only by stairs or a ramp) without passing a door, hatch, floodgate or
 * drawbridge, within `CIVILIAN_FLEE_NODE_LIMIT` tiles.
 */
export function shelterArea(map: Map3D, readers: ReaderSetLike, shelter: TileIndex): (tile: TileIndex) => boolean {
  const buildings = readers.has('14') ? readers.of<BuildingsReader>('14') : undefined;
  const hall = new Set<TileIndex>(buildings?.hearthHallTiles() ?? []);
  if (hall.has(shelter)) return (tile) => hall.has(tile);
  const barrier = (tile: TileIndex): boolean => isShelterBarrier(buildings, tile);
  const area = new Set<TileIndex>([shelter]);
  const queue = [shelter];
  for (let cursor = 0; cursor < queue.length && area.size < CIVILIAN_FLEE_NODE_LIMIT; cursor += 1) {
    for (const [next] of readers.pathing.edges(queue[cursor] as TileIndex, 'walker')) {
      if (area.has(next) || map.hasFlag(next, TileFlag.Outdoor) || barrier(next)) continue;
      area.add(next);
      queue.push(next);
    }
  }
  return (tile) => area.has(tile);
}

/**
 * 10 § Behavior selection, step 9, *Out of the cold*: the tile a dwarf idles and sleeps on the floor
 * at in place of the wagon while the wagon's tile is colder than `COLD_SHELTER_C`, which keeps a night
 * out of 17's frostbite (below `COLD_INJURY_C`, ten degrees colder): the
 * first covered floor tile with no building on it that a walker reaches from the wagon, breadth first
 * along the walker graph by step count, within `RETREAT_SEARCH_LIMIT` tiles. The wagon itself while it
 * is warmer, and when no such tile is found.
 */
export function wagonOutOfCold(map: Map3D, readers: ReaderSetLike, wagon: TileIndex): TileIndex {
  if (wagon < 0 || !map.validIndex(wagon) || !readers.has('05')) return wagon;
  if (!map.hasFlag(wagon, TileFlag.Outdoor)) return wagon;
  if (readers.of<{ temperatureAt(i: TileIndex): number }>('05').temperatureAt(wagon) >= COLD_SHELTER_C) return wagon;
  const buildings = readers.has('14') ? readers.of<BuildingsReader>('14') : undefined;
  const seen = new Set<TileIndex>([wagon]);
  const queue = [wagon];
  for (let cursor = 0; cursor < queue.length && cursor < RETREAT_SEARCH_LIMIT; cursor += 1) {
    const tile = queue[cursor] as TileIndex;
    if (tile !== wagon && !map.hasFlag(tile, TileFlag.Outdoor) && map.kindAt(tile) === TileKind.Floor && (buildings?.at(tile) ?? 0) === 0) return tile;
    for (const [next] of readers.pathing.edges(tile, 'walker')) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return wagon;
}
