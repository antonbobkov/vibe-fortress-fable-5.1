import { describe, expect, it } from 'vitest';
import { TileKind } from '@core/map3d';
import type { JobsSystem } from '@systems/jobs';
import { setupThreeYearsFortress, threeYearsWorld } from '../scenarios/three_years_fortress';
import { keepWaterInside } from '../scenarios/three_years_cistern';
import { feedSeal } from '../scenarios/cistern-well';

/**
 * T-694: the traffic the cistern forbids on the brook's side before the breach reaches only the
 * levels the brook's water can fill. On `three-years-p2-7` the bank's ramp in the brook's ravine
 * beside the feed, (11, 32, 32), is joined to the fortress only through the feed stair's level above
 * the water once the bank and the shaft are channelled; with that level forbidden too, the miner
 * who opened the bank stepped off onto the ramp, was shut in and starved there (and the jobs for his
 * corpse were left blocked, the sweep's invariant failure).
 */
describe('T-694 the feed seal leaves the stair above the water open', () => {
  it('forbids the tunnel and the stair up to the brook water and no higher, so the bank ramp is no pocket', () => {
    const w = threeYearsWorld('three-years-p2-7', 2);
    const state = setupThreeYearsFortress(w);
    keepWaterInside(w, state);
    const plan = state.cistern!.plan;
    const { bz, cisternZ: L, tops } = plan;
    const seal = feedSeal(w, plan);
    expect(seal.every((t) => w.map.zOf(t) <= bz), 'nothing above the water').toBe(true);
    expect(seal).toContain(w.index(plan.t.x, plan.t.y, bz));
    expect(seal).toContain(w.index(plan.tunnel[0]!.x, plan.tunnel[0]!.y, L));

    // The works as they stand at the breach: the bank channelled to a ramp at the water, the shaft
    // open to the tunnel, the stair cut, the tunnel's near half dug.
    for (let z = tops.p; z > bz; z -= 1) w.carve(w.index(plan.p.x, plan.p.y, z), TileKind.Open);
    w.carve(w.index(plan.p.x, plan.p.y, bz), TileKind.Ramp);
    for (let z = tops.s; z > L; z -= 1) w.carve(w.index(plan.s.x, plan.s.y, z), TileKind.Open);
    w.carve(w.index(plan.t.x, plan.t.y, tops.t), TileKind.StairsDown);
    for (let z = tops.t - 1; z > L; z -= 1) w.carve(w.index(plan.t.x, plan.t.y, z), TileKind.StairsUpDown);
    w.carve(w.index(plan.t.x, plan.t.y, L), TileKind.StairsUp);
    for (const c of plan.tunnel.slice(0, plan.gate)) w.carve(w.index(c.x, c.y, L), TileKind.Floor);
    const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
    const ramp = w.index(11, 32, bz + 1);
    expect(w.map.kindAt(ramp)).toBe(TileKind.Ramp);

    w.game.world.applyCommand({ type: 'SetTraffic', tiles: seal, mode: 'forbidden' });
    w.step(1);
    expect(board.pocketOf(ramp), 'the ramp is joined to the fortress').toBe(0);

    // The stair's level above the water forbidden as well (the seal as it was): the ramp is shut in.
    w.game.world.applyCommand({ type: 'SetTraffic', tiles: [w.index(plan.t.x, plan.t.y, bz + 1)], mode: 'forbidden' });
    w.step(1);
    expect(board.pocketOf(ramp), 'the ramp shut in').not.toBe(0);
  });
});
