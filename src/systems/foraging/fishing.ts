import { FLUID_DEEP_LEVEL } from '@core/constants';
import { FluidType, TileFlag, TileKind, type Map3D } from '@core/map3d';
import type { TileIndex } from '@core/types';
import { FISH_BANK_DROP, FISH_PER_TILE, MIN_FISHING_TILES } from './constants';

export type BodyKind = 'river' | 'lake' | 'cavern';
export interface WaterBody { id: number; version: number; tileCount: number; fishPool: number; kind: BodyKind; }

/** Horizontal cardinal flood fill: a fishing bank belongs to the neighbouring deep-water body. */
export function floodBodies(map: Map3D, version: number): { bodies: WaterBody[]; bodyOfTile: Map<TileIndex, number> } {
  const bodyOfTile = new Map<TileIndex, number>();
  const bodies: WaterBody[] = [];
  for (let start = 0; start < map.tileCount; start += 1) {
    if (!water(map, start) || bodyOfTile.has(start)) continue;
    const id = bodies.length + 1;
    const queue = [start];
    bodyOfTile.set(start, id);
    let source = false;
    let cavern = true;
    for (let head = 0; head < queue.length; head += 1) {
      const tile = queue[head] as number;
      if (map.fluidSourceAt(tile)) source = true;
      if (map.hasFlag(tile, TileFlag.Outdoor)) cavern = false;
      for (const n of cardinal(map, tile)) {
        if (!water(map, n) || bodyOfTile.has(n)) continue;
        bodyOfTile.set(n, id);
        queue.push(n);
      }
    }
    const tileCount = queue.length;
    bodies.push({ id, version, tileCount, fishPool: tileCount < MIN_FISHING_TILES ? 0 : tileCount * FISH_PER_TILE,
      kind: source ? 'river' : cavern ? 'cavern' : 'lake' });
  }
  return { bodies, bodyOfTile };
}

export function cardinal(map: Map3D, tile: TileIndex): TileIndex[] {
  const z = map.zOf(tile);
  return map.neighbors6(tile).filter((n) => map.zOf(n) === z);
}

export function water(map: Map3D, tile: TileIndex): boolean {
  return map.fluidLevelAt(tile) > 0 && map.fluidTypeAt(tile) === FluidType.Water;
}

export function fishingWater(map: Map3D, tile: TileIndex): boolean {
  if (map.fluidLevelAt(tile) < FLUID_DEEP_LEVEL || map.fluidTypeAt(tile) !== FluidType.Water || map.fluidFrozenAt(tile)) return false;
  return !cardinal(map, tile).some((n) => map.fluidLevelAt(n) > 0 && map.fluidTypeAt(n) === FluidType.Magma);
}

/** The bank's cardinal shore column: only open air may separate it from lower water. */
export function waterOfBank(map: Map3D, bank: TileIndex): TileIndex {
  if (!map.validIndex(bank)) return -1;
  for (const shore of cardinal(map, bank)) {
    let tile = shore;
    for (let drop = 0; drop <= FISH_BANK_DROP; drop += 1) {
      if (fishingWater(map, tile)) return tile;
      if (map.kindAt(tile) !== TileKind.Open || map.fluidLevelAt(tile) !== 0 || map.zOf(tile) === 0) break;
      tile = map.index(map.xOf(tile), map.yOf(tile), map.zOf(tile) - 1);
    }
  }
  return -1;
}
