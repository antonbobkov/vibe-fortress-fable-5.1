/**
 * Stage 1: elevation. `02-systems/01-world-generation.md` § Elevation;
 * `algorithms/world-generation.md` step 1.
 */

import { FIXED_SCALE, type Fixed } from '@core/fixed';
import { noise2 } from '@core/noise';
import { MIN_LAND_FRACTION, MOUNTAIN_ELEVATION, SEA_LEVEL } from '../constants';
import type { GenWorld } from '../state';
import { clamp, stageStream } from './common';

/** Bounded retries: "bounded to 8 attempts, then accept". */
export const ELEVATION_ATTEMPTS = 8;

/** The four octave amplitudes, `128, 64, 32, 16`. */
export const ELEVATION_AMPS: readonly number[] = [128, 64, 32, 16];

/** A continental mask: a `Fixed` 0 … 1 per region. "The continental mask is one function." */
export type ContinentalMask = (x: number, y: number, size: number) => Fixed;

/**
 * `1 − (distance from center / (size × 0.55))²`, clamped to 0 … 1, as a `Fixed`. Exact: the
 * denominator `(size × 0.55)²` is written `size² × 3025 / 10000`.
 */
export const continentalMask: ContinentalMask = (x, y, size) => {
  const cx = x - Math.floor(size / 2);
  const cy = y - Math.floor(size / 2);
  const d2 = cx * cx + cy * cy;
  const falloff = Math.floor((d2 * FIXED_SCALE * 10000) / (size * size * 3025));
  return clamp(0, FIXED_SCALE, FIXED_SCALE - falloff);
};

/** The octave periods of the elevation noise: `size/32, size/16, size/8, size/4`. */
export function elevationPeriods(size: number): number[] {
  return [size / 32, size / 16, size / 8, size / 4];
}

/** True when some 3×3 block of regions is entirely at or above `MOUNTAIN_ELEVATION`. */
export function hasMountainCluster(elev: ArrayLike<number>, size: number): boolean {
  for (let y = 0; y + 2 < size; y += 1) {
    for (let x = 0; x + 2 < size; x += 1) {
      let all = true;
      for (let dy = 0; dy < 3 && all; dy += 1) {
        for (let dx = 0; dx < 3 && all; dx += 1) {
          if ((elev[(y + dy) * size + x + dx] as number) < MOUNTAIN_ELEVATION) all = false;
        }
      }
      if (all) return true;
    }
  }
  return false;
}

/** Land is at least `MIN_LAND_FRACTION` percent of all regions. */
export function hasEnoughLand(elev: ArrayLike<number>, size: number): boolean {
  let land = 0;
  for (let i = 0; i < size * size; i += 1) if ((elev[i] as number) >= SEA_LEVEL) land += 1;
  return land * 100 >= MIN_LAND_FRACTION * size * size;
}

/** Fill `elevation` for one attempt. */
export function elevationAttempt(s: string, size: number, attempt: number, mask: ContinentalMask): number[] {
  const st = stageStream(s, 'worldgen.elevation', attempt);
  const salt = st.nextU32();
  const periods = elevationPeriods(size);
  const out = new Array<number>(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const n = noise2(salt, x, y, periods, ELEVATION_AMPS); // Fixed 0 … 240
      const m = mask(x, y, size); // Fixed 0 … 1
      const e = Math.floor((n * m + (FIXED_SCALE * FIXED_SCALE) / 2) / (FIXED_SCALE * FIXED_SCALE));
      out[y * size + x] = e;
    }
  }
  return normalize255(out);
}

/**
 * "Normalize to 0–255" (`01` § Elevation): a linear stretch of the masked field from its
 * minimum … maximum onto 0 … 255, rounded half up. The W4 pseudo-code omits the step; without it
 * the field tops out near 200 and no seed reaches `MIN_LAND_FRACTION`. See DECISIONS.md D-038.
 */
export function normalize255(values: number[]): number[] {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i] as number;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min;
  return values.map((v) => (span <= 0 ? 0 : clamp(0, 255, Math.floor(((v - min) * 255 * 2 + span) / (2 * span)))));
}

/**
 * Stage 1. Retries with `seed + attempt` until the land and mountain-cluster conditions hold,
 * at most {@link ELEVATION_ATTEMPTS} times, then accepts the last attempt.
 */
export function stageElevation(g: GenWorld, mask: ContinentalMask = continentalMask): void {
  let elev: number[] = [];
  let attempt = 0;
  for (;;) {
    elev = elevationAttempt(g.s, g.size, attempt, mask);
    attempt += 1;
    if (hasEnoughLand(elev, g.size) && hasMountainCluster(elev, g.size)) break;
    if (attempt === ELEVATION_ATTEMPTS) break;
  }
  g.elevationAttempts = attempt;
  for (let i = 0; i < g.regions.length; i += 1) (g.regions[i] as GenWorld['regions'][number]).elevation = elev[i] as number;
}
