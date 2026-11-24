/**
 * `fl_tunnel_pressure` of `04-implementation/acceptance-tests.md` § 04 Fluids: "a source over a
 * shaft seven deep onto a 1-wide level tunnel 40 tiles long, ending under a second shaft twelve
 * high | every tunnel tile full and the second shaft full to the source's level − 1 within 2,000
 * ticks; never above".
 *
 * Cut into the granite of `flat-test`: a water source at (10, 40, 28) over an open shaft down to
 * the floor of a tunnel at z 20, which runs 40 tiles east to (50, 40, 20) under an open shaft up to
 * z 32. The source's water falls down its shaft, and the full column's pressure (rule 3, sideways)
 * carries the water along the tunnel tile by tile and then lifts it up the second shaft, to z 27,
 * one below the source, and never higher.
 */

import { expect } from 'vitest';
import { FLUID_MAX_LEVEL } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { Scenario } from './runner';

const Y = 40;
const FLOOR = 20;
const FEED_X = 10;
const LENGTH = 40;
const END_X = FEED_X + LENGTH;
const SOURCE_Z = FLOOR + 8;
const SHAFT_TOP = FLOOR + 12;

const scenario: Scenario = {
  id: 'fl_tunnel_pressure',
  milestone: 3,
  seed: 'fl-tunnel-pressure',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    for (let x = FEED_X; x <= END_X; x += 1) w.carve(w.index(x, Y, FLOOR), TileKind.Floor);
    for (let z = FLOOR + 1; z <= SOURCE_Z; z += 1) w.carve(w.index(FEED_X, Y, z), TileKind.Open);
    for (let z = FLOOR + 1; z <= SHAFT_TOP; z += 1) w.carve(w.index(END_X, Y, z), TileKind.Open);
    w.setFluid(w.index(FEED_X, Y, SOURCE_Z), FLUID_MAX_LEVEL, 'water', true);
  },
  run: (w) => {
    const level = (x: number, z: number): number => w.fluids.sim.level(w.index(x, Y, z));
    const full = (): boolean => {
      for (let x = FEED_X; x <= END_X; x += 1) if (level(x, FLOOR) !== FLUID_MAX_LEVEL) return false;
      for (let z = FLOOR + 1; z < SOURCE_Z; z += 1) if (level(END_X, z) !== FLUID_MAX_LEVEL) return false;
      return true;
    };
    let filledAt = -1;
    for (let t = 0; t < 2000; t += 1) {
      w.step(1);
      for (let z = SOURCE_Z; z <= SHAFT_TOP; z += 1) expect(level(END_X, z), `the second shaft at z ${z}, tick ${t}`).toBe(0);
      if (filledAt < 0 && full()) filledAt = t;
    }
    expect(filledAt, 'the tunnel and the second shaft filled').toBeGreaterThanOrEqual(0);
  },
  expect: (w) => {
    const level = (x: number, z: number): number => w.fluids.sim.level(w.index(x, Y, z));
    for (let x = FEED_X; x <= END_X; x += 1) expect(level(x, FLOOR), `tunnel tile ${x}`).toBe(FLUID_MAX_LEVEL);
    for (let z = FLOOR + 1; z < SOURCE_Z; z += 1) expect(level(END_X, z), `second shaft at z ${z}`).toBe(FLUID_MAX_LEVEL);
    expect(level(END_X, SOURCE_Z)).toBe(0);
    // Settled: the filled body does not keep the simulation busy.
    expect(w.fluids.sim.activeCount()).toBe(0);
  },
};

export default scenario;
