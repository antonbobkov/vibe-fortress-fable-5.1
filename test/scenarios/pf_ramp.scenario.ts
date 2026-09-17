/**
 * `pf_ramp` of `04-implementation/acceptance-tests.md` § 22 Pathfinding:
 * "ramp between two levels | path exists both ways; large creature uses it; stairs refused for
 * `large`".
 *
 * The shapes are carved into the `flat-test` rock: a corridor one level below the surface, a ramp
 * leaning on the rock it was cut from, and a stairwell beside it.
 */

import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';

const SURFACE_Z = 32;
const BELOW_Z = 31;

/** The corridor at z = 31, its ramp, the surface tile the ramp leads to, and the stairwell. */
function tiles(w: TestWorld): {
  corridor: number;
  ramp: number;
  rampExit: number;
  stairsLower: number;
  stairsUpper: number;
} {
  return {
    corridor: w.index(10, 12, BELOW_Z),
    ramp: w.index(12, 12, BELOW_Z),
    rampExit: w.index(13, 12, SURFACE_Z),
    stairsLower: w.index(10, 12, BELOW_Z),
    stairsUpper: w.index(10, 12, SURFACE_Z),
  };
}

const scenario: Scenario = {
  id: 'pf_ramp',
  milestone: 0,
  seed: 'pf-ramp',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    // A corridor of three tiles at z = 31; (13, 12, 31) stays rock, so the ramp can lean on it.
    w.digRoom(10, 12, BELOW_Z, 3, 1);
    const t = tiles(w);
    w.carve(t.ramp, TileKind.Ramp);
    // The tile above a ramp must be open for it to work.
    w.carve(w.index(12, 12, SURFACE_Z), TileKind.Open);
    // A stairwell at the other end of the corridor.
    w.carve(t.stairsLower, TileKind.StairsUp);
    w.carve(t.stairsUpper, TileKind.StairsDown);
  },
  run: 1,
  expect: (w) => {
    const t = tiles(w);
    expect(w.map.kindAt(w.index(13, 12, BELOW_Z))).toBe(TileKind.Wall);

    // The ramp joins the two levels, both ways, for a walker and for a large creature.
    for (const cls of ['walker', 'large'] as const) {
      expect(w.pathing.graph.hasEdge(t.ramp, t.rampExit, cls)).toBe(true);
      expect(w.pathing.graph.hasEdge(t.rampExit, t.ramp, cls)).toBe(true);
      const up = w.findPath(t.corridor, t.rampExit, cls);
      const down = w.findPath(t.rampExit, t.corridor, cls);
      expect(up).not.toBeNull();
      expect(down).not.toBeNull();
      expect((up as number[])[(up as number[]).length - 1]).toBe(t.rampExit);
      expect((down as number[])[(down as number[]).length - 1]).toBe(t.corridor);
      expect(w.reachable(t.corridor, t.rampExit, cls)).toBe(true);
    }

    // The stairwell serves a walker and refuses a large creature.
    expect(w.pathing.graph.hasEdge(t.stairsLower, t.stairsUpper, 'walker')).toBe(true);
    expect(w.pathing.graph.hasEdge(t.stairsUpper, t.stairsLower, 'walker')).toBe(true);
    expect(w.pathing.graph.hasEdge(t.stairsLower, t.stairsUpper, 'large')).toBe(false);
    expect(w.pathing.graph.hasEdge(t.stairsUpper, t.stairsLower, 'large')).toBe(false);
  },
};

export default scenario;
