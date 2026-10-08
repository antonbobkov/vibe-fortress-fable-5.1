/**
 * Stage 6: caverns. `03-terrain-and-mining.md` § Local map generation stage 6;
 * `algorithms/local-map-generation.md` step 4.
 */

import {
  CAVERN_1_Z_MAX,
  CAVERN_1_Z_MIN,
  CAVERN_2_Z_MAX,
  CAVERN_2_Z_MIN,
  CAVERN_3_Z_MAX,
  CAVERN_3_Z_MIN,
  FLUID_MAX_LEVEL,
} from '@core/constants';
import { FIXED_SCALE, type Fixed } from '@core/fixed';
import { FluidType, Map3D, TileFlag, TileKind } from '@core/map3d';
import { noise3 } from '@core/noise';
import type { RngStream } from '@core/rng';
import type { TileIndex } from '@core/types';
import {
  CAVE_LOAM_PERMILLE,
  CAVERN_LAKE_PERCENT,
  CAVERN_OPEN_FRACTION_MAX,
  CAVERN_OPEN_FRACTION_MIN,
  DEEP_WELL_LAKE_PERCENT,
  DEEP_WELL_OPEN_FRACTION,
  FUNGAL_DEPTHS_OPEN_BONUS,
  MAGMA_POOL_PERMILLE,
  MAGMA_POOL_RADIUS_MAX,
  MAGMA_POOL_RADIUS_MIN,
} from '../constants';
import { hasTrait, materialIndex, stageStream, type LocalGen } from './common';
import { isRim } from './sea';

export const CAVERN_PERIODS: readonly number[] = [14, 6];
export const CAVERN_AMPS: readonly number[] = [70, 30];
export const CAVERN_LAKE_PERIOD = 10;

/** The z band of a cavern tier (1 shallowest, 3 deepest). */
export function cavernBand(tier: number): [number, number] {
  return tier === 1 ? [CAVERN_1_Z_MIN, CAVERN_1_Z_MAX] : tier === 2 ? [CAVERN_2_Z_MIN, CAVERN_2_Z_MAX] : [CAVERN_3_Z_MIN, CAVERN_3_Z_MAX];
}

/** The tier whose band holds z, or 0. */
export function cavernTierAt(z: number): number {
  for (let t = 1; t <= 3; t += 1) {
    const [lo, hi] = cavernBand(t);
    if (z >= lo && z <= hi) return t;
  }
  return 0;
}

/**
 * `CAVERN_OPEN_FRACTION`: 0.25 at deepness 0 to 0.55 at 255, `fungal_depths` +0.15, `deep_well`
 * cavern one 0.7. A `Fixed`, capped at 1.
 */
export function cavernOpenTarget(deepness: number, tier: number, traits: readonly string[]): Fixed {
  if (tier === 1 && traits.includes('deep_well')) return DEEP_WELL_OPEN_FRACTION;
  const base =
    CAVERN_OPEN_FRACTION_MIN + Math.floor(((CAVERN_OPEN_FRACTION_MAX - CAVERN_OPEN_FRACTION_MIN) * deepness) / 255);
  return Math.min(FIXED_SCALE, base + (traits.includes('fungal_depths') ? FUNGAL_DEPTHS_OPEN_BONUS : 0));
}

/**
 * The indices of the lowest `fraction` of `values` (ties by position): "a 3D noise field
 * thresholded so that roughly `CAVERN_OPEN_FRACTION` of the band is open" (docs/04-implementation/algorithms/local-map-generation.md).
 */
export function lowestFraction(values: readonly number[], fraction: Fixed): number[] {
  const order = values.map((_, k) => k).sort((a, b) => (values[a] as number) - (values[b] as number) || a - b);
  return order.slice(0, Math.floor((values.length * fraction) / FIXED_SCALE));
}

/** A disc of magma (level 7, no source) over the `Floor` tiles at one level (`03` stage 6). */
export function magmaPool(g: LocalGen, center: TileIndex, radius: number): void {
  const map = g.map;
  const cx = map.xOf(center);
  const cy = map.yOf(center);
  const z = map.zOf(center);
  const magma = Map3D.packFluid(FLUID_MAX_LEVEL, FluidType.Magma);
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if (!map.inBounds(x, y, z) || (x - cx) * (x - cx) + (y - cy) * (y - cy) > radius * radius) continue;
      const i = map.index(x, y, z);
      if (map.kindAt(i) !== TileKind.Floor) continue;
      map.kind[i] = TileKind.Open;
      map.flags[i] = (map.flags[i] as number) & ~TileFlag.Grass;
      map.fluid[i] = magma;
    }
  }
}

function carveTier(g: LocalGen, tier: number, st: RngStream): void {
  const map = g.map;
  const [zmin, zmax] = cavernBand(tier);
  const salt = st.nextU32();
  const tiles: TileIndex[] = [];
  const values: number[] = [];
  for (let z = zmin; z <= zmax; z += 1) {
    for (let y = 0; y < g.h; y += 1) {
      for (let x = 0; x < g.w; x += 1) {
        if (isRim(g, x, y)) continue;
        tiles.push(map.index(x, y, z));
        values.push(noise3(salt, x, y, z, CAVERN_PERIODS, CAVERN_AMPS));
      }
    }
  }
  const open = lowestFraction(values, cavernOpenTarget(g.spec.deepness, tier, g.spec.traits));
  for (const k of open) {
    const i = tiles[k] as TileIndex;
    map.kind[i] = TileKind.Open;
    map.material[i] = 0;
  }
  g.cavernOpen[tier] = Math.floor((open.length * FIXED_SCALE) / Math.max(1, tiles.length));

  // "the tile below [an] open tile … becomes floor"; 60% of floors are cave loam with grass.
  const loam = materialIndex(g, 'cave_loam');
  const floors: TileIndex[] = [];
  let lowestOpen = zmax + 1;
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      for (let z = zmin; z <= zmax; z += 1) {
        const i = map.index(x, y, z);
        if (map.kindAt(i) !== TileKind.Open) continue;
        lowestOpen = Math.min(lowestOpen, z);
        const below = map.index(x, y, z - 1);
        if (map.kindAt(below) !== TileKind.Wall) continue;
        map.kind[below] = TileKind.Floor;
        if (st.chance(CAVE_LOAM_PERMILLE)) {
          map.material[below] = loam;
          map.flags[below] = (map.flags[below] as number) | TileFlag.Grass;
        }
        floors.push(below);
      }
    }
  }
  floors.sort((a, b) => a - b);

  // Lakes: the lowest-noise 18% of the floors (60% for deep_well's cavern one) hold water up to
  // one above the band's lowest open level.
  const lakeSalt = st.nextU32();
  const lakeNoise = floors.map((i) => noise3(lakeSalt, map.xOf(i), map.yOf(i), map.zOf(i), [CAVERN_LAKE_PERIOD], [100]));
  const percent = tier === 1 && hasTrait(g, 'deep_well') ? DEEP_WELL_LAKE_PERCENT : CAVERN_LAKE_PERCENT;
  const water = Map3D.packFluid(FLUID_MAX_LEVEL, FluidType.Water);
  for (const k of lowestFraction(lakeNoise, percent * 10)) {
    const f = floors[k] as TileIndex;
    const x = map.xOf(f);
    const y = map.yOf(f);
    for (let z = map.zOf(f); z <= lowestOpen + 1 && z <= zmax; z += 1) {
      const i = map.index(x, y, z);
      const kind = map.kindAt(i);
      if (kind !== TileKind.Open && kind !== TileKind.Floor) break;
      map.fluid[i] = water;
    }
  }

  // Magma pools in caverns two and three.
  if (tier >= 2) {
    for (const f of floors) {
      if (map.kindAt(f) !== TileKind.Floor || map.fluidLevelAt(f) > 0) continue;
      if (st.chance(MAGMA_POOL_PERMILLE)) magmaPool(g, f, st.int(MAGMA_POOL_RADIUS_MIN, MAGMA_POOL_RADIUS_MAX));
    }
  }
  g.cavernFloors[tier] = floors.filter((i) => map.kindAt(i) === TileKind.Floor);
}

export function stageCaverns(g: LocalGen): void {
  for (let tier = 1; tier <= 3; tier += 1) carveTier(g, tier, stageStream(g.s, `terrain.cavern${tier}`));
}
