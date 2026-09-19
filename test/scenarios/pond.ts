/**
 * An outdoor pond on `flat-test` for the freezing tests: a 3×3 floor one level below the surface
 * (z 31) with the surface tiles above it opened, so the pond lies under the sky, holding water at
 * one level.
 */

import { TileFlag, TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { TestWorld } from './test-world';

export const POND_Z = 31;

export function pondTiles(w: TestWorld, x = 40, y = 40): TileIndex[] {
  const out: TileIndex[] = [];
  for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 3; dx += 1) out.push(w.index(x + dx, y + dy, POND_Z));
  return out;
}

export function digPond(w: TestWorld, level: number, x = 40, y = 40): TileIndex[] {
  const tiles = pondTiles(w, x, y);
  for (const t of tiles) {
    w.carve(t, TileKind.Floor);
    const above = w.map.above(t);
    w.carve(above, TileKind.Open);
    w.map.setFlag(above, TileFlag.Outdoor, true);
    w.map.setFlag(t, TileFlag.Outdoor, true);
    w.discover(t);
  }
  for (const t of tiles) w.setFluid(t, level);
  // The pond was dug outside the terrain API; 04 learns of its outdoor tiles as 03 would tell it.
  w.fluids.freezer.tilesChanged(tiles);
  return tiles;
}
