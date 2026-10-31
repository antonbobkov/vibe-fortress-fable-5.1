/**
 * Stage 9, the lie of the surface: slopes, loose boulders and lying snow.
 * `03-terrain-and-mining.md` § Local map generation stage 9; the biome's surface row of
 * `03-content/regions-biomes-and-traits.md` § Biome surface.
 */

import type { Fixed } from '@core/fixed';
import { FIXED_SCALE } from '@core/fixed';
import { TileFlag, TileKind } from '@core/map3d';
import { noise2 } from '@core/noise';
import { ROCK_BOULDER_FACTOR, SCREE_BOULDER_PERMILLE, SNOW_PERIODS } from '../constants';
import { COL_LAKE, COL_RIVER, stageStream, type LocalGen } from './common';
import { baseSurfaceZ } from './height';

interface SurfaceRow {
  readonly id: string;
  readonly surface?: { readonly boulders: Fixed; readonly snow: Fixed };
}

const CARDINALS: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function dry(g: LocalGen, c: number): boolean {
  return ((g.colFlags[c] as number) & (COL_RIVER | COL_LAKE)) === 0;
}

/**
 * Slopes: a dry surface floor one level below a cardinal neighbour's dry surface floor becomes a
 * `ramp` of its own material, leaning on the neighbour's side, so every one-level step of the
 * surface can be walked. Two or more levels stay a cliff.
 */
export function stageRamps(g: LocalGen): void {
  const map = g.map;
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      const c = y * g.w + x;
      if (!dry(g, c)) continue;
      const z = g.heights[c] as number;
      if (z + 1 >= g.d) continue;
      const i = map.index(x, y, z);
      if (map.kindAt(i) !== TileKind.Floor || map.fluidLevelAt(i) > 0) continue;
      if (map.kindAt(map.index(x, y, z + 1)) !== TileKind.Open) continue;
      for (const [dx, dy] of CARDINALS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
        const side = map.index(nx, ny, z);
        const top = map.index(nx, ny, z + 1);
        // The neighbour may already be a ramp: a slope of several steps is walked up every one.
        const topKind = map.kindAt(top);
        if (map.kindAt(side) !== TileKind.Wall || (topKind !== TileKind.Floor && topKind !== TileKind.Ramp) || map.fluidLevelAt(top) > 0) continue;
        map.kind[i] = TileKind.Ramp;
        map.flags[i] = (map.flags[i] as number) & ~TileFlag.Grass;
        break;
      }
    }
  }
}

/**
 * Loose boulders, from relief 1: each dry surface floor holds one with the biome's `boulders` probability, three
 * times that on bare rock, and at least `SCREE_BOULDER_PERMILLE` in a crag's scree. A boulder is
 * of the first rock under the column's soil.
 */
export function stageBoulders(g: LocalGen): void {
  // Level ground (relief 0) has no loose boulders, as it has no outcrops or crags.
  if (g.spec.relief === 0) return;
  const st = stageStream(g.s, 'terrain.boulders');
  const map = g.map;
  const density = g.registry.table<SurfaceRow>('biomes').byId(g.spec.biome)?.surface?.boulders ?? 0;
  const materials = g.registry.table<{ id: string; class: string }>('materials');
  const soil = (m: number): boolean => materials.byIndex(m)?.class === 'soil';
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      const c = y * g.w + x;
      if (!dry(g, c) || g.bare[c] === 1) continue;
      const z = g.heights[c] as number;
      const i = map.index(x, y, z);
      if (map.kindAt(i) !== TileKind.Floor || map.fluidLevelAt(i) > 0) continue;
      let p = g.rocky[c] === 1 ? density * ROCK_BOULDER_FACTOR : density;
      if (g.scree[c] === 1) p = Math.max(p, SCREE_BOULDER_PERMILLE);
      if (p <= 0 || st.fixed() >= p) continue;
      let rockZ = z;
      while (rockZ > 0 && soil(map.materialAt(map.index(x, y, rockZ)))) rockZ -= 1;
      map.kind[i] = TileKind.Boulder;
      map.material[i] = map.materialAt(map.index(x, y, rockZ));
      map.flags[i] = (map.flags[i] as number) & ~TileFlag.Grass;
    }
  }
}

/**
 * Lying snow: where the biome has a `snow` share, the dry surface floors and ramps open to the sky
 * whose patch field (raised a tenth for each level above the base surface) lies in the top `snow`
 * of its range carry `snow` (06 melts it like fallen snow).
 */
export function stageSnow(g: LocalGen): void {
  const share = g.registry.table<SurfaceRow>('biomes').byId(g.spec.biome)?.surface?.snow ?? 0;
  if (share <= 0) return;
  const salt = stageStream(g.s, 'terrain.snow').nextU32();
  const map = g.map;
  const base = baseSurfaceZ(g.spec.elevation);
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      const c = y * g.w + x;
      if (!dry(g, c)) continue;
      const z = g.heights[c] as number;
      const i = map.index(x, y, z);
      const kind = map.kindAt(i);
      if ((kind !== TileKind.Floor && kind !== TileKind.Ramp) || map.fluidLevelAt(i) > 0) continue;
      const field = noise2(salt, x, y, SNOW_PERIODS, [0.7, 0.3]) + Math.max(0, z - base) * (FIXED_SCALE / 10);
      if (field >= FIXED_SCALE - share) map.flags[i] = (map.flags[i] as number) | TileFlag.Snow;
    }
  }
}
