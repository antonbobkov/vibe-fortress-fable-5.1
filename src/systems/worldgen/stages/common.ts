/**
 * Helpers shared by the world generation stages (`algorithms/world-generation.md`).
 */

import { RngStream } from '@core/rng';
import { hash } from '@core/noise';
import { FIXED_SCALE, type Fixed } from '@core/fixed';
import type { Edge } from '@core/types';
import { HILLS_ELEVATION, MOUNTAIN_ELEVATION, SEA_LEVEL } from '../constants';
import type { GenRegion, GenWorld } from '../state';

/**
 * `stream(S, name, attempt)`: the stage's own stream (`01` § Stage order and rng streams), seeded
 * from `hash(S, name, attempt)` so that one stage never shifts another's draws.
 */
export function stageStream(s: string, name: string, attempt = 0): RngStream {
  return new RngStream(hash(s, name, attempt));
}

/** A noise `Fixed` to the nearest integer (halves up; noise is never negative). */
export function roundFx(v: Fixed): number {
  return Math.floor((v + FIXED_SCALE / 2) / FIXED_SCALE);
}

export function clamp(lo: number, hi: number, v: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function regionAt(g: GenWorld, x: number, y: number): GenRegion | undefined {
  if (x < 0 || y < 0 || x >= g.size || y >= g.size) return undefined;
  return g.regions[y * g.size + x];
}

/** The four cardinal neighbours in `n, e, s, w` order (absent at the world's edge). */
export function neighbors4(g: GenWorld, r: GenRegion): GenRegion[] {
  const out: GenRegion[] = [];
  const n = regionAt(g, r.x, r.y - 1);
  const e = regionAt(g, r.x + 1, r.y);
  const s = regionAt(g, r.x, r.y + 1);
  const w = regionAt(g, r.x - 1, r.y);
  if (n !== undefined) out.push(n);
  if (e !== undefined) out.push(e);
  if (s !== undefined) out.push(s);
  if (w !== undefined) out.push(w);
  return out;
}

/** The eight surrounding regions, row by row. */
export function neighbors8(g: GenWorld, r: GenRegion): GenRegion[] {
  const out: GenRegion[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const n = regionAt(g, r.x + dx, r.y + dy);
      if (n !== undefined) out.push(n);
    }
  }
  return out;
}

export function chebyshev(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** The edge of `from` that faces the cardinal neighbour `to`. North is row 0. */
export function edgeToward(from: { x: number; y: number }, to: { x: number; y: number }): Edge {
  if (to.y < from.y) return 'n';
  if (to.x > from.x) return 'e';
  if (to.y > from.y) return 's';
  return 'w';
}

export function isOcean(r: { elevation: number }): boolean {
  return r.elevation < SEA_LEVEL;
}

// ---------- bands (`algorithms/world-generation.md` § Helpers) ----------

export type TempBand = 'frozen' | 'cold' | 'temperate' | 'warm' | 'hot';
export type RainBand = 'arid' | 'dry' | 'moderate' | 'wet';
export type ElevBand = 'ocean' | 'lowland' | 'hills' | 'mountain';

export const TEMP_BANDS: readonly TempBand[] = ['frozen', 'cold', 'temperate', 'warm', 'hot'];
export const RAIN_BANDS: readonly RainBand[] = ['arid', 'dry', 'moderate', 'wet'];
export const ELEV_BANDS: readonly ElevBand[] = ['ocean', 'lowland', 'hills', 'mountain'];

export function tempBand(tempC: number): TempBand {
  return tempC < -5 ? 'frozen' : tempC < 5 ? 'cold' : tempC < 18 ? 'temperate' : tempC < 26 ? 'warm' : 'hot';
}

export function rainBand(rain: number): RainBand {
  return rain < 60 ? 'arid' : rain < 110 ? 'dry' : rain < 170 ? 'moderate' : 'wet';
}

export function elevBand(elevation: number): ElevBand {
  return elevation < SEA_LEVEL
    ? 'ocean'
    : elevation < HILLS_ELEVATION
      ? 'lowland'
      : elevation < MOUNTAIN_ELEVATION
        ? 'hills'
        : 'mountain';
}
