/**
 * `pf_water` of `04-implementation/acceptance-tests.md` § 22 Pathfinding: "corridor with water
 * level 4 | impassable for walkers; level 3 passable at ×2 cost".
 *
 * A one-tile corridor dug one level below the `flat-test` surface; its middle tile holds water.
 * 04 fluids arrives in M3, so the level is written into the fluid grid directly and the chunk is
 * dirtied as `FluidsChanged` will dirty it.
 */

import { expect } from 'vitest';
import { FLUID_DEEP_LEVEL, FLUID_WADE_LEVEL } from '@core/constants';
import { FluidType, Map3D } from '@core/map3d';
import { WADE_COST_MULTIPLIER } from '@core/path-constants';
import type { Scenario } from './runner';

const Z = 31;
const Y = 30;

const scenario: Scenario = {
  id: 'pf_water',
  milestone: 1,
  seed: 'pf-water',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    w.digRoom(20, Y, Z, 11, 1); // x 20..30
  },
  run: (w) => {
    const from = w.index(20, Y, Z);
    const to = w.index(30, Y, Z);
    const wet = w.index(25, Y, Z);
    const flood = (level: number): void => {
      w.map.fluid[wet] = Map3D.packFluid(level, FluidType.Water, true);
      w.map.markChunkDirty(wet, true, true);
      w.step(1);
    };
    w.step(1);
    const dry = w.pathing.graph.cost(wet, 'walker');

    flood(FLUID_DEEP_LEVEL);
    expect(w.pathing.graph.passable(wet, 'walker')).toBe(false);
    expect(w.reachable(from, to)).toBe(false);
    expect(w.findPath(from, to)).toBeNull();

    flood(FLUID_WADE_LEVEL);
    expect(w.pathing.graph.passable(wet, 'walker')).toBe(true);
    expect(w.reachable(from, to)).toBe(true);
    expect(w.findPath(from, to)).toContain(wet);
    expect(w.pathing.graph.cost(wet, 'walker')).toBe(dry * WADE_COST_MULTIPLIER);
  },
};

export default scenario;
