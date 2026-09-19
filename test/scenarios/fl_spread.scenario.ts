/**
 * `fl_spread` of `04-implementation/acceptance-tests.md` § 04 Fluids: "7 units in one tile of a
 * 5×5 sealed floor | after 200 steps all 25 tiles at level 0–1 with Σ = 7; every tile settled".
 *
 * C-002: rule 2's equalizing draw moves a level-1 unit into an empty neighbour with
 * `SPREAD_EQUALIZE_PERMILLE` every step, so level-1 water never settles, and rule 4 evaporates the
 * units that wander off on their own, so Σ = 7 cannot hold either. The rules are implemented as
 * written; this scenario is reported as `it.todo('C-002')`, and the part that holds (every tile at
 * 0–1, Σ plus the evaporated units = 7) is the unit test "7 units in one tile of a sealed 5×5
 * floor …" in `test/unit/fluids/fluids.test.ts`.
 */

import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { Scenario } from './runner';

const Z = 25;

function floor(w: { index(x: number, y: number, z: number): TileIndex }): TileIndex[] {
  const out: TileIndex[] = [];
  for (let y = 40; y < 45; y += 1) for (let x = 40; x < 45; x += 1) out.push(w.index(x, y, Z));
  return out;
}

const scenario: Scenario = {
  id: 'fl_spread',
  milestone: 3,
  seed: 'fl-spread',
  world: 'flat-test',
  embark: 'none',
  todo: 'C-002',
  setup: (w) => {
    for (const t of floor(w)) w.carve(t, TileKind.Floor);
    w.setFluid(w.index(42, 42, Z), 7);
  },
  // 200 water steps.
  run: 400,
  expect: (w) => {
    const tiles = floor(w);
    for (const t of tiles) expect(w.fluids.sim.level(t)).toBeLessThanOrEqual(1);
    expect(w.fluidSum(tiles)).toBe(7);
    expect(tiles.filter((t) => w.fluids.sim.isActive[t] === 1)).toEqual([]);
  },
};

export default scenario;
