/**
 * Stage 7: ratings. `02-systems/01-world-generation.md` § Ratings; `algorithms/world-generation.md`
 * step 7; thresholds from `03-content/regions-biomes-and-traits.md` § Rating thresholds.
 */

import { RATING_MAX } from '@core/constants';
import type { Registry } from '@core/registry';
import { MOUNTAIN_ELEVATION, PERIL_DISTANCE_STEP } from '../constants';
import type { Geology, GenRegion, GenWorld } from '../state';
import { stageStream } from './common';

interface ThresholdRow {
  readonly rating: string;
  readonly bands: readonly (readonly [number, number])[];
}

export interface RatingThresholds {
  readonly wealth: readonly number[];
  readonly peril: readonly number[];
  readonly temper: readonly number[];
}

/** The content bands as `bucket` thresholds: the lower bound of every band after the first. */
export function ratingThresholds(registry: Registry): RatingThresholds {
  const rows = registry.derived<readonly ThresholdRow[]>('ratingThresholds');
  const of = (rating: string): number[] => {
    const row = rows.find((r) => r.rating === rating);
    if (row === undefined) throw new RangeError(`ratingThresholds has no "${rating}" row`);
    return row.bands.slice(1).map((b) => b[0]);
  };
  return { wealth: of('wealth'), peril: of('peril'), temper: of('temper') };
}

/** `bucket(v, thresholds)`: the number of thresholds ≤ v, clamped to 0 … `RATING_MAX`. */
export function bucket(v: number, thresholds: readonly number[]): number {
  let n = 0;
  for (const t of thresholds) if (t <= v) n += 1;
  return Math.max(0, Math.min(RATING_MAX, n));
}

/** `geologyScore`: sedimentary 1, mixed 2, metamorphic 3, igneous 3. */
export function geologyScore(g: Geology): number {
  return g === 'sedimentary' ? 1 : g === 'mixed' ? 2 : 3;
}

/** `biomeTemper`: glacier, tundra, desert, alpine 2; taiga, badlands, savanna, mountain 1; else 0. */
export function biomeTemper(biome: string): number {
  if (biome === 'glacier' || biome === 'tundra' || biome === 'desert' || biome === 'alpine') return 2;
  if (biome === 'taiga' || biome === 'badlands' || biome === 'savanna' || biome === 'mountain') return 1;
  return 0;
}

export function wealthScore(r: GenRegion, noise: number): number {
  return geologyScore(r.geology) + (r.volcano ? 2 : 0) + Math.floor(r.deepness / 64) + noise;
}

export function perilScore(r: GenRegion): number {
  const gloam = Math.min(4, Math.floor(r.civDistance.gloam / PERIL_DISTANCE_STEP));
  const harsh = r.biome === 'badlands' || r.biome === 'dark_forest' || r.biome === 'wetland' ? 1 : 0;
  return 4 - gloam + Math.floor(r.deepness / 96) + harsh;
}

export function temperScore(r: GenRegion, noise: number): number {
  return biomeTemper(r.biome) + (r.elevation >= MOUNTAIN_ELEVATION ? 1 : 0) + (r.rain > 200 ? 1 : 0) + noise;
}

export function stageRatings(g: GenWorld, registry: Registry): void {
  const st = stageStream(g.s, 'worldgen.ratings');
  const t = ratingThresholds(registry);
  for (const r of g.regions) {
    r.wealth = bucket(wealthScore(r, st.int(0, 2)), t.wealth);
    r.peril = bucket(perilScore(r), t.peril);
    r.temper = bucket(temperScore(r, st.int(0, 1)), t.temper);
  }
}
