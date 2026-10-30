/**
 * Stage 1: the heightmap. `03-terrain-and-mining.md` § Local map generation stage 1;
 * `algorithms/local-map-generation.md` step 1.
 *
 * Relief 0 is level ground. From relief 1: two octaves of swells and ridges along a third field,
 * scaled by the relief, one pass of a 3×3 median; then outcrops of bare rock and, where the biome
 * has them, crags with scree.
 */

import { SURFACE_Z_MAX, SURFACE_Z_MIN } from '@core/constants';
import { FIXED_SCALE } from '@core/fixed';
import { noise2 } from '@core/noise';
import type { RngStream } from '@core/rng';
import { SEA_LEVEL } from '@systems/worldgen/constants';
import {
  CRAG_HEIGHT_MAX,
  CRAG_HEIGHT_MIN,
  CRAG_RADIUS_MAX,
  CRAG_RADIUS_MIN,
  CRAGS_PER_RELIEF,
  OUTCROP_EDGE_MARGIN,
  OUTCROP_RADIUS_MAX,
  OUTCROP_RADIUS_MIN,
  OUTCROPS_PER_RELIEF,
  RIDGE_PERIOD,
  RIDGE_THRESHOLD,
  SCREE_RING,
} from '../constants';
import { clamp, stageStream, type LocalGen } from './common';

/** `amp = [0, 3, 5, 8][spec.relief]`: relief 0 is level; relief 1 swells a level up and down. */
export const RELIEF_AMPLITUDE: readonly number[] = [0, 3, 5, 8];

/** The two octaves: periods 32 and 12, amplitudes 0.7 and 0.3 of `amp`. */
export const HEIGHT_PERIODS: readonly number[] = [32, 12];

/** Ridge height in levels by relief: none on level ground. */
export const RIDGE_LEVELS: readonly number[] = [0, 1, 2, 3];

/** `base = SURFACE_Z_MIN + (elevation − SEA_LEVEL) × (SURFACE_Z_MAX − SURFACE_Z_MIN) / (255 − SEA_LEVEL)`. */
export function baseSurfaceZ(elevation: number): number {
  const base = SURFACE_Z_MIN + Math.trunc(((elevation - SEA_LEVEL) * (SURFACE_Z_MAX - SURFACE_Z_MIN)) / (255 - SEA_LEVEL));
  return clamp(SURFACE_Z_MIN, SURFACE_Z_MAX, base);
}

/**
 * `round(noise − amp/2)` with ties toward zero, in `Fixed`: a sample exactly half an amplitude
 * away rounds to the nearer-to-base level (docs/04-implementation/algorithms/local-map-generation.md).
 */
export function roundOffset(offsetFx: number): number {
  const whole = Math.trunc(offsetFx / FIXED_SCALE);
  const rest = Math.abs(offsetFx - whole * FIXED_SCALE);
  const r = rest > FIXED_SCALE / 2 ? whole + Math.sign(offsetFx) : whole;
  return r === 0 ? 0 : r;
}

/**
 * The ridge rise of one sample of the ridge field (`Fixed`, 0 … 1000): a ridge runs where the
 * field crosses its middle; above `RIDGE_THRESHOLD` of closeness it rises linearly to `levels`.
 */
export function ridgeRise(sampleFx: number, levels: number): number {
  if (levels <= 0) return 0;
  const near = FIXED_SCALE - Math.abs(2 * sampleFx - FIXED_SCALE);
  if (near <= RIDGE_THRESHOLD) return 0;
  return Math.round(((near - RIDGE_THRESHOLD) * levels) / (FIXED_SCALE - RIDGE_THRESHOLD));
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

interface SurfaceRow {
  readonly id: string;
  readonly surface?: { readonly outcrops: number; readonly crags: number };
}

/** A count per 96 × 96 map, scaled to this map's area. */
function perMap(g: LocalGen, count: number): number {
  return Math.round((count * g.w * g.h) / (96 * 96));
}

/** A knob: the columns of a disc around a drawn centre, raised to the centre's height plus `rise`, bare rock. */
function raiseDisc(g: LocalGen, cx: number, cy: number, radius: number, rise: (d2: number) => number): void {
  const centre = g.heights[cy * g.w + cx] as number;
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 > radius * (radius + 1)) continue;
      const c = y * g.w + x;
      const top = clamp(SURFACE_Z_MIN, SURFACE_Z_MAX, centre + rise(d2));
      if (top < (g.heights[c] as number)) continue;
      g.heights[c] = top;
      g.rocky[c] = 1;
    }
  }
}

/** Scree around a crag: the ring of `SCREE_RING` columns outside its disc. */
function markScree(g: LocalGen, cx: number, cy: number, radius: number): void {
  const outer = radius + SCREE_RING;
  for (let y = cy - outer; y <= cy + outer; y += 1) {
    for (let x = cx - outer; x <= cx + outer; x += 1) {
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 <= radius * (radius + 1) || d2 > outer * (outer + 1)) continue;
      g.scree[y * g.w + x] = 1;
    }
  }
}

function centreOf(st: RngStream, g: LocalGen): { x: number; y: number } {
  return { x: st.int(OUTCROP_EDGE_MARGIN, g.w - 1 - OUTCROP_EDGE_MARGIN), y: st.int(OUTCROP_EDGE_MARGIN, g.h - 1 - OUTCROP_EDGE_MARGIN) };
}

/**
 * From relief 1, outcrops (every biome, more with relief): small discs of bare rock one level above
 * their centre (one or two at relief 3). Crags (biomes with a crag count): cones of bare rock two to
 * four levels plus the relief above 1 high, ringed with scree. Both after the median, so they keep
 * their edges.
 */
export function stageRelief(g: LocalGen): void {
  const st = stageStream(g.s, 'terrain.relief');
  const surface = g.registry.table<SurfaceRow>('biomes').byId(g.spec.biome)?.surface;
  const relief = g.spec.relief;
  // Level ground (relief 0) has neither.
  if (relief === 0) return;
  const outcrops = perMap(g, (surface?.outcrops ?? 0) + OUTCROPS_PER_RELIEF * (relief - 1));
  for (let k = 0; k < outcrops; k += 1) {
    const { x, y } = centreOf(st, g);
    const radius = st.int(OUTCROP_RADIUS_MIN, OUTCROP_RADIUS_MAX + (relief >= 3 ? 1 : 0));
    const rise = relief >= 3 ? st.int(1, 2) : 1;
    raiseDisc(g, x, y, radius, () => rise);
  }
  const baseCrags = surface?.crags ?? 0;
  const crags = baseCrags > 0 ? perMap(g, baseCrags + CRAGS_PER_RELIEF * (relief - 1)) : 0;
  for (let k = 0; k < crags; k += 1) {
    const { x, y } = centreOf(st, g);
    const radius = st.int(CRAG_RADIUS_MIN, CRAG_RADIUS_MAX);
    const peak = st.int(CRAG_HEIGHT_MIN, CRAG_HEIGHT_MAX) + relief - 1;
    raiseDisc(g, x, y, radius, (d2) => Math.max(1, Math.round(peak * (1 - Math.sqrt(d2) / (radius + 1)))));
    markScree(g, x, y, radius);
  }
}

export function stageHeight(g: LocalGen): void {
  const st = stageStream(g.s, 'terrain.height');
  const salt = st.nextU32();
  const ridgeSalt = st.nextU32();
  const base = baseSurfaceZ(g.spec.elevation);
  const amp = RELIEF_AMPLITUDE[g.spec.relief] as number;
  const ridges = RIDGE_LEVELS[g.spec.relief] as number;
  const amps = [amp * 0.7, amp * 0.3];
  const half = Math.round((amp * FIXED_SCALE) / 2);
  const raw = new Int16Array(g.w * g.h);
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      const n = noise2(salt, x, y, HEIGHT_PERIODS, amps);
      const ridge = ridges > 0 ? ridgeRise(noise2(ridgeSalt, x, y, [RIDGE_PERIOD], [1]), ridges) : 0;
      raw[y * g.w + x] = clamp(SURFACE_Z_MIN, SURFACE_Z_MAX, base + roundOffset(n - half) + ridge);
    }
  }
  g.heights.set(median3x3(raw, g.w, g.h));
  stageRelief(g);
}
