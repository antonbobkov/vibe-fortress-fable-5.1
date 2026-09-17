/**
 * Hand-built maps for the T-M0-09 pathfinding, connectivity, movement and spatial tests.
 * Nothing here is game content; the shapes come from the worked examples in
 * `02-systems/22-pathfinding-and-spatial.md` § Edges.
 */

import { Map3D, TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';

/** A map filled with `wall`, so a test only has to carve what it needs. */
export function solidMap(w: number, h: number, d: number): Map3D {
  const map = new Map3D(w, h, d);
  map.kind.fill(TileKind.Wall);
  return map;
}

/** A map filled with `open`, so a test only has to place what it needs. */
export function emptyMap(w: number, h: number, d: number): Map3D {
  return new Map3D(w, h, d);
}

/** Carve one tile. */
export function put(map: Map3D, x: number, y: number, z: number, kind: TileKind): TileIndex {
  const i = map.index(x, y, z);
  map.setKind(i, kind, 1);
  return i;
}

/** Carve a filled rectangle of one kind on one z-level. */
export function fillRect(
  map: Map3D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z: number,
  kind: TileKind,
): void {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) put(map, x, y, z, kind);
  }
}

/** The total cost of a path, counting the cost of every tile entered. */
export function pathCost(
  edgeCost: (from: TileIndex, to: TileIndex) => number,
  from: TileIndex,
  path: readonly TileIndex[],
): number {
  let total = 0;
  let cur = from;
  for (let k = 0; k < path.length; k += 1) {
    const next = path[k] as TileIndex;
    total += edgeCost(cur, next);
    cur = next;
  }
  return total;
}
