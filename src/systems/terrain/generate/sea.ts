/**
 * Stage 5: the Sea of Fire. `03-terrain-and-mining.md` § Local map generation stage 5;
 * `algorithms/local-map-generation.md` step 3 (the `z ≤ MAGMA_SEA_TOP_Z` rows).
 */

import { FLUID_MAX_LEVEL, MAGMA_SEA_TOP_Z } from '@core/constants';
import { FIXED_SCALE } from '@core/fixed';
import { FluidType, Map3D, TileKind } from '@core/map3d';
import { noise2 } from '@core/noise';
import { materialIndex, stageStream, type LocalGen } from './common';

/** "the outer 2-tile rim which is basalt wall". */
export const SEA_RIM = 2;
/** Pillars: `noise(stream('terrain.pillars'), x, y, [6], [100]) > 92` ("noise threshold 8%"). */
export const PILLAR_PERIOD = 6;
export const PILLAR_THRESHOLD = 92;

export function isRim(g: { w: number; h: number }, x: number, y: number): boolean {
  return x < SEA_RIM || y < SEA_RIM || x >= g.w - SEA_RIM || y >= g.h - SEA_RIM;
}

/**
 * z `0 … MAGMA_SEA_TOP_Z`: open with magma 7 and `source`, except basalt pillars and the basalt
 * rim; z = `MAGMA_SEA_TOP_Z + 1` is the basalt roof.
 */
export function stageSea(g: LocalGen): void {
  const salt = stageStream(g.s, 'terrain.pillars').nextU32();
  const basalt = materialIndex(g, 'basalt');
  const magma = Map3D.packFluid(FLUID_MAX_LEVEL, FluidType.Magma, false, true);
  const map = g.map;
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      const pillar = noise2(salt, x, y, [PILLAR_PERIOD], [100]) > PILLAR_THRESHOLD * FIXED_SCALE;
      const solid = isRim(g, x, y) || pillar;
      for (let z = 0; z <= MAGMA_SEA_TOP_Z; z += 1) {
        const i = map.index(x, y, z);
        if (solid) {
          map.kind[i] = TileKind.Wall;
          map.material[i] = basalt;
          map.fluid[i] = 0;
        } else {
          map.kind[i] = TileKind.Open;
          map.material[i] = 0;
          map.fluid[i] = magma;
        }
      }
      const roof = map.index(x, y, MAGMA_SEA_TOP_Z + 1);
      map.kind[roof] = TileKind.Wall;
      map.material[roof] = basalt;
    }
  }
}
