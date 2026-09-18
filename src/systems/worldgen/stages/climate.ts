/**
 * Stage 2: climate. `02-systems/01-world-generation.md` § Climate;
 * `algorithms/world-generation.md` step 2.
 */

import { noise2 } from '@core/noise';
import {
  COAST_RAIN_BONUS,
  MOUNTAIN_ELEVATION,
  RAIN_SHADOW_DECAY,
  RAIN_SHADOW_STRENGTH,
  SEA_LEVEL,
  TEMP_LAPSE_PER_ELEVATION,
  TEMP_NORTH,
  TEMP_SOUTH,
} from '../constants';
import type { GenWorld } from '../state';
import { clamp, isOcean, neighbors4, roundFx, stageStream } from './common';

/** The two rain octave amplitudes, `160, 95`. */
export const RAIN_AMPS: readonly number[] = [160, 95];

/**
 * `tempC = TEMP_SOUTH − (TEMP_SOUTH − TEMP_NORTH) × y / size − max(0, elevation − SEA_LEVEL) ×
 * TEMP_LAPSE_PER_ELEVATION / 100`; each quotient truncates toward zero (D-006).
 */
export function temperatureOf(y: number, size: number, elevation: number): number {
  const latitude = Math.trunc(((TEMP_SOUTH - TEMP_NORTH) * y) / size);
  const lapse = Math.trunc((Math.max(0, elevation - SEA_LEVEL) * TEMP_LAPSE_PER_ELEVATION) / 100);
  return TEMP_SOUTH - latitude - lapse;
}

/**
 * The rain shadow and the coast bonus over a finished base rainfall, in place: scanning each row
 * west to east, a mountain sets `shadow = RAIN_SHADOW_STRENGTH`, every region loses `shadow`, and
 * `shadow` decays by `RAIN_SHADOW_DECAY`; a region with an ocean 4-neighbour gains
 * `COAST_RAIN_BONUS`.
 */
export function applyRainShadow(g: GenWorld): void {
  for (let y = 0; y < g.size; y += 1) {
    let shadow = 0;
    for (let x = 0; x < g.size; x += 1) {
      const r = g.regions[y * g.size + x];
      if (r === undefined) continue;
      if (r.elevation >= MOUNTAIN_ELEVATION) shadow = RAIN_SHADOW_STRENGTH;
      r.rain = clamp(0, 255, r.rain - shadow);
      shadow = Math.max(0, shadow - RAIN_SHADOW_DECAY);
      if (neighbors4(g, r).some(isOcean)) r.rain = Math.min(255, r.rain + COAST_RAIN_BONUS);
    }
  }
}

export function stageClimate(g: GenWorld): void {
  const st = stageStream(g.s, 'worldgen.climate');
  const salt = st.nextU32();
  const periods = [g.size / 16, g.size / 8];
  for (const r of g.regions) {
    r.tempC = temperatureOf(r.y, g.size, r.elevation);
    r.rain = clamp(0, 255, roundFx(noise2(salt, r.x, r.y, periods, RAIN_AMPS)));
  }
  applyRainShadow(g);
}
