/**
 * `pf_water` of `04-implementation/acceptance-tests.md` § 22 Pathfinding: "corridor with water
 * level 4 | impassable for walkers; level 3 passable at ×2 cost".
 *
 * Since T-M3-02 the water is 04's: two dry rooms one level below the `flat-test` surface (z 31)
 * are joined only by a corridor one level lower (z 30), reached by a stair at each end. The
 * corridor is flooded through 04 (every tile at the same level, so it stays still), and 04's own
 * writes dirty the chunks that 22 relabels; nothing marks a chunk by hand.
 */

import { expect } from 'vitest';
import { FLUID_DEEP_LEVEL, FLUID_WADE_LEVEL } from '@core/constants';
import { TileKind } from '@core/map3d';
import { WADE_COST_MULTIPLIER } from '@core/path-constants';
import type { TileIndex } from '@core/types';
import type { Scenario } from './runner';

const Y = 30;
const ROOMS = 31;
const CORRIDOR = 30;

function corridor(w: { index(x: number, y: number, z: number): TileIndex }): TileIndex[] {
  const out: TileIndex[] = [];
  for (let x = 20; x <= 30; x += 1) out.push(w.index(x, Y, CORRIDOR));
  return out;
}

const scenario: Scenario = {
  id: 'pf_water',
  milestone: 3,
  seed: 'pf-water',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    w.digRoom(16, Y, ROOMS, 4, 1); // x 16..19
    w.digRoom(31, Y, ROOMS, 4, 1); // x 31..34
    w.carve(w.index(20, Y, ROOMS), TileKind.StairsDown);
    w.carve(w.index(30, Y, ROOMS), TileKind.StairsDown);
    for (const t of corridor(w)) w.carve(t, TileKind.Floor);
    w.carve(w.index(20, Y, CORRIDOR), TileKind.StairsUp);
    w.carve(w.index(30, Y, CORRIDOR), TileKind.StairsUp);
  },
  run: (w) => {
    const from = w.index(16, Y, ROOMS);
    const to = w.index(34, Y, ROOMS);
    const wet = w.index(25, Y, CORRIDOR);
    const flood = (level: number): void => {
      for (const t of corridor(w)) w.setFluid(t, level);
      w.step(2);
    };
    w.step(1);
    expect(w.reachable(from, to)).toBe(true);
    const dry = w.pathing.graph.cost(wet, 'walker');

    flood(FLUID_DEEP_LEVEL);
    expect(w.fluids.sim.level(wet)).toBe(FLUID_DEEP_LEVEL);
    expect(w.pathing.graph.passable(wet, 'walker')).toBe(false);
    expect(w.reachable(from, to)).toBe(false);
    expect(w.findPath(from, to)).toBeNull();

    flood(FLUID_WADE_LEVEL);
    expect(w.fluids.sim.level(wet)).toBe(FLUID_WADE_LEVEL);
    expect(w.pathing.graph.passable(wet, 'walker')).toBe(true);
    expect(w.reachable(from, to)).toBe(true);
    expect(w.findPath(from, to)).toContain(wet);
    expect(w.pathing.graph.cost(wet, 'walker')).toBe(dry * WADE_COST_MULTIPLIER);
  },
};

export default scenario;
