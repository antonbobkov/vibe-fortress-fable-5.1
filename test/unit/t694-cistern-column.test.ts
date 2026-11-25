import { describe, expect, it } from 'vitest';
import { FLUID_MAX_LEVEL } from '@core/constants';
import { TileKind } from '@core/map3d';
import { CISTERN_DEPTH } from '../scenarios/cistern-well';
import { TestWorld } from '../scenarios/test-world';

/**
 * T-694: the cistern's well column keeps its last level a ramp until the cistern is filled and the
 * floodgate shut (`cistern-well.ts`). On `flat-test`, the three-year fortress's longest feed: a
 * source over a shaft seven deep onto a level tunnel of 52 tiles to a 3 × 3 cistern, the well's
 * column open from the hall's floor down to a ramp over the cistern's middle. With the floodgate
 * standing open (here: no floodgate at all) the cistern fills to the brim and the water lifts no
 * higher, however long; with the tunnel shut and the ramp channelled, it stays where it is.
 */
const Y = 40;
const L = 20;
const H = L + CISTERN_DEPTH;
const FEED_X = 2;
const TUNNEL = 52;
const WELL_X = FEED_X + TUNNEL + 2;
const GATE_X = FEED_X + TUNNEL / 2;

function cisternWorld(): TestWorld {
  const w = new TestWorld({ seed: 't694', world: 'flat-test', embark: 'none' });
  for (let x = FEED_X; x <= FEED_X + TUNNEL; x += 1) w.carve(w.index(x, Y, L), TileKind.Floor);
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) w.carve(w.index(WELL_X + dx, Y + dy, L), TileKind.Floor);
  // The feed: a source over an open shaft down to the tunnel's first tile.
  for (let z = L + 1; z <= L + 8; z += 1) w.carve(w.index(FEED_X, Y, z), TileKind.Open);
  w.setFluid(w.index(FEED_X, Y, L + 8), FLUID_MAX_LEVEL, 'water', true);
  // The hall over the cistern, and the well's column: open from the hall's floor down to a ramp.
  for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) w.carve(w.index(WELL_X + dx, Y + dy, H), TileKind.Floor);
  for (let z = L + 2; z <= H; z += 1) w.carve(w.index(WELL_X, Y, z), TileKind.Open);
  w.carve(w.index(WELL_X, Y, L + 1), TileKind.Ramp);
  return w;
}

describe('T-694 the cistern fills under a ramp and the hall stays dry', () => {
  it('fills to the brim under the ramp however long the tunnel stays open, and keeps still once shut and opened up', () => {
    const w = cisternWorld();
    const level = (x: number, y: number, z: number): number => w.fluids.sim.level(w.index(x, y, z));
    const above = (): number => {
      let sum = 0;
      for (let z = L + 1; z <= H; z += 1) sum += level(WELL_X, Y, z);
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) sum += level(WELL_X + dx, Y + dy, H);
      return sum;
    };
    let fullAt = -1;
    for (let t = 0; t < 10_000; t += 1) {
      w.step(1);
      if (t % 50 === 0) expect(above(), `nothing above the cistern at tick ${t}`).toBe(0);
      if (fullAt < 0 && level(WELL_X, Y, L) === FLUID_MAX_LEVEL) fullAt = t;
    }
    expect(fullAt, 'the cistern filled under the well').toBeGreaterThanOrEqual(0);
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) expect(level(WELL_X + dx, Y + dy, L)).toBe(FLUID_MAX_LEVEL);
    expect(above()).toBe(0);

    // The floodgate shut (the tunnel's middle tile walled), then the ramp channelled: the cistern's
    // water stands level with nothing higher in its body, and lifts no further.
    const gate = w.index(GATE_X, Y, L);
    w.fluids.sim.setLevel(gate, 0, false);
    w.carve(gate, TileKind.Wall);
    w.carve(w.index(WELL_X, Y, L + 1), TileKind.Ramp);
    w.fluids.sim.touch(w.index(WELL_X, Y, L + 1));
    for (let t = 0; t < 4_000; t += 1) {
      w.step(1);
      if (t % 50 === 0) expect(above(), `nothing up the opened column at tick ${t}`).toBe(0);
    }
    expect(level(WELL_X, Y, L), 'water under the well').toBe(FLUID_MAX_LEVEL);
  });
});
