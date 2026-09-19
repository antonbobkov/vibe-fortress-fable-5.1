/**
 * `ma_temperature` of `04-implementation/acceptance-tests.md` § 05 Materials: "sample tiles at
 * surface, depth 10, z=5 next to magma | values match the formula ±1".
 *
 * The formula of `05` § Temperature model is written out again here, independently of the system:
 * the surface tile reads the surface temperature; the tile ten levels under the surface is past
 * the near-surface blend and above `DEEP_HEAT_START_Z`, so it reads `UNDERGROUND_BASE_C`; a pocket
 * dug at z = 5 beside a tile of magma reads the deep-heat base plus the magma's override at
 * distance 1 (`MAGMA_OVERRIDE / 2` units of 5 °C). The sampled z = 5 tile is the rock beside a
 * one-tile magma pocket, so the magma cannot spread onto it.
 */

import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import {
  DEEP_HEAT_PER_Z,
  DEEP_HEAT_START_Z,
  MAGMA_OVERRIDE,
  NEAR_SURFACE_DEPTH,
  UNDERGROUND_BASE_C,
} from '@systems/materials/constants';
import type { MaterialsReader } from '@systems/materials';
import type { Scenario } from './runner';

const SURFACE = 32;

const scenario: Scenario = {
  id: 'ma_temperature',
  milestone: 3,
  seed: 'ma-temperature',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    // A one-tile pocket of magma; the sampled tile is the rock beside it.
    w.carve(w.index(41, 40, 5), TileKind.Floor);
    w.carve(w.index(40, 40, 22), TileKind.Floor);
    w.setFluid(w.index(41, 40, 5), 7, 'magma');
  },
  run: 30,
  expect: (w) => {
    const m = w.readers.of<MaterialsReader>('05');
    const surfaceC = m.surfaceTempC();
    const deep = (z: number): number => {
      const depth = SURFACE - z;
      if (depth <= NEAR_SURFACE_DEPTH) return surfaceC + Math.trunc(((UNDERGROUND_BASE_C - surfaceC) * depth) / NEAR_SURFACE_DEPTH);
      return UNDERGROUND_BASE_C + Math.max(0, DEEP_HEAT_START_Z - z) * DEEP_HEAT_PER_Z;
    };
    const near = (actual: number, expected: number): void => {
      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
    };
    near(m.temperatureAt(w.index(40, 40, SURFACE)), surfaceC);
    near(m.temperatureAt(w.index(40, 40, SURFACE - 10)), deep(SURFACE - 10));
    near(m.temperatureAt(w.index(40, 40, 5)), deep(5) + (MAGMA_OVERRIDE / 2) * 5);
    // The near-surface blend, one level down.
    near(m.temperatureAt(w.index(40, 40, SURFACE - 1)), deep(SURFACE - 1));
  },
};

export default scenario;
