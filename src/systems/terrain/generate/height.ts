/**
 * Stage 1: the heightmap. `03-terrain-and-mining.md` § Local map generation stage 1;
 * `algorithms/local-map-generation.md` step 1.
 */

import { SURFACE_Z_MAX, SURFACE_Z_MIN } from '@core/constants';
import { FIXED_SCALE } from '@core/fixed';
import { noise2 } from '@core/noise';
import { SEA_LEVEL } from '@systems/worldgen/constants';
import { clamp, stageStream, type LocalGen } from './common';

/** `amp = [1, 2, 4, 6][spec.relief]`. */
export const RELIEF_AMPLITUDE: readonly number[] = [1, 2, 4, 6];

/** The two octaves: periods 32 and 12, amplitudes 0.7 and 0.3 of `amp`. */
export const HEIGHT_PERIODS: readonly number[] = [32, 12];

/** `base = SURFACE_Z_MIN + (elevation − SEA_LEVEL) × (SURFACE_Z_MAX − SURFACE_Z_MIN) / (255 − SEA_LEVEL)`. */
export function baseSurfaceZ(elevation: number): number {
  const base = SURFACE_Z_MIN + Math.trunc(((elevation - SEA_LEVEL) * (SURFACE_Z_MAX - SURFACE_Z_MIN)) / (255 - SEA_LEVEL));
  return clamp(SURFACE_Z_MIN, SURFACE_Z_MAX, base);
}

/**
 * `round(noise − amp/2)` with ties toward zero, in `Fixed`: a sample exactly half an amplitude
 * away rounds to the nearer-to-base level (docs/04-implementation/algorithms/local-map-generation.md), so relief 0 is flat at `base`.
 */
export function roundOffset(offsetFx: number): number {
  const whole = Math.trunc(offsetFx / FIXED_SCALE);
  const rest = Math.abs(offsetFx - whole * FIXED_SCALE);
  const r = rest > FIXED_SCALE / 2 ? whole + Math.sign(offsetFx) : whole;
  return r === 0 ? 0 : r;
}

/** Median of the 3×3 around each column (edges replicate), one pass. */
export function median3x3(src: Int16Array, w: number, h: number): Int16Array {
  const out = new Int16Array(src.length);
  const window = new Array<number>(9);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let k = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = clamp(0, w - 1, x + dx);
          const yy = clamp(0, h - 1, y + dy);
          window[k] = src[yy * w + xx] as number;
          k += 1;
        }
      }
      window.sort((a, b) => a - b);
      out[y * w + x] = window[4] as number;
    }
  }
  return out;
}

export function stageHeight(g: LocalGen): void {
  const st = stageStream(g.s, 'terrain.height');
  const salt = st.nextU32();
  const base = baseSurfaceZ(g.spec.elevation);
  const amp = RELIEF_AMPLITUDE[g.spec.relief] as number;
  const amps = [amp * 0.7, amp * 0.3];
  const half = Math.round((amp * FIXED_SCALE) / 2);
  const raw = new Int16Array(g.w * g.h);
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      const n = noise2(salt, x, y, HEIGHT_PERIODS, amps);
      raw[y * g.w + x] = clamp(SURFACE_Z_MIN, SURFACE_Z_MAX, base + roundOffset(n - half));
    }
  }
  g.heights.set(median3x3(raw, g.w, g.h));
}
