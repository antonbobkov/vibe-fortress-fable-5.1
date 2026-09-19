/**
 * `fl_pressure` of `04-implementation/acceptance-tests.md` § 04 Fluids: "a U-tube: source column 5
 * high, connected at the bottom to an empty column | the empty column fills to the source's level
 * − 1 within 2,000 ticks; never above".
 *
 * Cut into the granite of `flat-test`: the source column at (40, 40) is five water sources at
 * z 20 … 24 (a floor at z 20, open above); a floor corridor at z 20 joins it to the empty column at
 * (45, 40), a floor at z 20 with an open shaft above it up to z 28 under the rock. Rule 3 lifts
 * water up the shaft from the higher part of the body, so the shaft fills to z 23, one below the
 * source's top at z 24, and never reaches z 24.
 */

import { expect } from 'vitest';
import { FLUID_MAX_LEVEL } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { Scenario } from './runner';

const Y = 40;
const BOTTOM = 20;
const SOURCE_TOP = 24;
const SHAFT_TOP = 28;

const scenario: Scenario = {
  id: 'fl_pressure',
  milestone: 3,
  seed: 'fl-pressure',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    for (let x = 40; x <= 45; x += 1) w.carve(w.index(x, Y, BOTTOM), TileKind.Floor);
    for (let z = BOTTOM + 1; z <= SOURCE_TOP; z += 1) w.carve(w.index(40, Y, z), TileKind.Open);
    for (let z = BOTTOM + 1; z <= SHAFT_TOP; z += 1) w.carve(w.index(45, Y, z), TileKind.Open);
    for (let z = BOTTOM; z <= SOURCE_TOP; z += 1) w.setFluid(w.index(40, Y, z), FLUID_MAX_LEVEL, 'water', true);
  },
  run: (w) => {
    const full = (): boolean => {
      for (let z = BOTTOM; z < SOURCE_TOP; z += 1) if (w.fluids.sim.level(w.index(45, Y, z)) !== FLUID_MAX_LEVEL) return false;
      return true;
    };
    let filledAt = -1;
    for (let t = 0; t < 2000; t += 1) {
      w.step(1);
      for (let z = SOURCE_TOP; z <= SHAFT_TOP; z += 1) expect(w.fluids.sim.level(w.index(45, Y, z))).toBe(0);
      if (filledAt < 0 && full()) filledAt = t;
    }
    expect(filledAt).toBeGreaterThanOrEqual(0);
  },
  expect: (w) => {
    for (let z = BOTTOM; z < SOURCE_TOP; z += 1) expect(w.fluids.sim.level(w.index(45, Y, z))).toBe(FLUID_MAX_LEVEL);
    expect(w.fluids.sim.level(w.index(45, Y, SOURCE_TOP))).toBe(0);
  },
};

export default scenario;
