/**
 * `fl_conservation` of `04-implementation/acceptance-tests.md` § 04 Fluids: "a closed basin with
 * 700 units, no sources, 5,000 ticks | Σ levels = 700 at every sampled tick".
 *
 * The basin is cut into the granite of `flat-test`: a 10×10 floor at z = 25 under a 10×10 open
 * level at z = 26, walled on every side and roofed by the rock at z = 27. Half the water starts
 * on the west half of the floor, half hangs in the open level above it, so the run exercises the
 * fall and the spread (and the equalizing draw) before the basin comes to rest full at z = 25.
 */

import { expect } from 'vitest';
import { FLUID_MAX_LEVEL } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { Scenario } from './runner';

const X = 40;
const Y = 40;
const FLOOR_Z = 25;
const SIZE = 10;

function basin(w: { index(x: number, y: number, z: number): TileIndex }): TileIndex[] {
  const out: TileIndex[] = [];
  for (const z of [FLOOR_Z, FLOOR_Z + 1]) {
    for (let y = Y; y < Y + SIZE; y += 1) for (let x = X; x < X + SIZE; x += 1) out.push(w.index(x, y, z));
  }
  return out;
}

const scenario: Scenario = {
  id: 'fl_conservation',
  milestone: 3,
  seed: 'fl-conservation',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    for (let y = Y; y < Y + SIZE; y += 1) {
      for (let x = X; x < X + SIZE; x += 1) {
        w.carve(w.index(x, y, FLOOR_Z), TileKind.Floor);
        w.carve(w.index(x, y, FLOOR_Z + 1), TileKind.Open);
      }
    }
    for (let y = Y; y < Y + SIZE; y += 1) {
      for (let x = X; x < X + SIZE / 2; x += 1) {
        w.setFluid(w.index(x, y, FLOOR_Z), FLUID_MAX_LEVEL);
        w.setFluid(w.index(x, y, FLOOR_Z + 1), FLUID_MAX_LEVEL);
      }
    }
  },
  run: (w) => {
    const tiles = basin(w);
    expect(w.fluidSum(tiles)).toBe(700);
    for (let sample = 0; sample < 50; sample += 1) {
      w.step(100);
      expect(w.fluidSum(tiles)).toBe(700);
    }
  },
  expect: (w) => {
    // Decision F-03d: at rest with equalize budget.
    expect(w.fluids.reader().activeCount()).toBe(0);
    for (let y = Y; y < Y + SIZE; y += 1) {
      for (let x = X; x < X + SIZE; x += 1) {
        expect(w.fluids.sim.level(w.index(x, y, FLOOR_Z))).toBeGreaterThanOrEqual(6);
        expect(w.fluids.sim.level(w.index(x, y, FLOOR_Z + 1))).toBeLessThanOrEqual(1);
      }
    }
    expect(w.fluidSum(basin(w))).toBe(700);
  },
};

export default scenario;
