/**
 * T-392: an item that lies on a forbidden tile (traffic mode `forbidden`, impassable to dwarves) is not
 * an item a job can fetch. The connectivity labels do not know the forbidden set, so the item search
 * used to offer the item, a worker claimed the job, its walk to the item failed, and the job stood
 * blocked as `unreachable` with its walk marked failed, although every label connected the worker, the
 * item and the work tile.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, ItemFlag } from '@core/components';
import type { ItemsReader } from '@systems/items';
import type { JobBoard } from '@systems/jobs';
import { checkInvariants } from '../../scenarios/invariants';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

describe('T-392 items on forbidden tiles', () => {
  it('the search offers the item on open ground and not the nearer one on a forbidden tile', () => {
    const w = new TestWorld({ seed: 't392-search', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const from = w.index(20, 20, Z);
    const near = w.spawnItem('chair', 'pine', w.index(21, 20, Z));
    const far = w.spawnItem('chair', 'pine', w.index(30, 20, Z));
    const chair = w.game.registry.table('items').index('chair');
    const items = w.readers.of<ItemsReader>('13');
    expect(items.findItems({ type: chair }, 2, from)).toEqual([near, far]);
    expect(w.game.world.applyCommand({ type: 'SetTraffic', tiles: [w.index(21, 20, Z)], mode: 'forbidden' }).ok).toBe(true);
    expect(items.findItems({ type: chair }, 1, from)).toEqual([far]);
    expect(items.findItems({ type: chair }, 2, from)).toEqual([far]);
    expect(items.findItems({ type: chair, itemId: near }, 1, from)).toEqual([]);
    expect(w.game.world.applyCommand({ type: 'SetTraffic', tiles: [w.index(21, 20, Z)], mode: 'normal' }).ok).toBe(true);
    expect(items.findItems({ type: chair }, 1, from)).toEqual([near]);
  });

  it('a depot haul of an item on a forbidden tile waits for its item, then runs when the tile opens', () => {
    const w = new TestWorld({ seed: 't392-depot', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const depot = w.build('trade_depot', w.index(40, 20, Z), 'granite');
    const at = w.index(30, 24, Z);
    w.spawnDwarf({ at: w.index(30, 20, Z) });
    const chair = w.spawnItem('chair', 'pine', at);
    expect(w.game.world.applyCommand({ type: 'SetTraffic', tiles: [at], mode: 'forbidden' }).ok).toBe(true);
    w.step(1);
    w.submit({ type: 'MoveToDepot', depotId: depot, itemIds: [chair] });
    w.step(600);
    const board = w.game.world.services.jobs as JobBoard;
    const job = [...board.jobs.values()].find((j) => j.target.ref === chair);
    expect(job).toBeDefined();
    // Nobody is sent to a tile they cannot enter: no claim, no failed walk.
    expect(w.events('JobClaimed').filter((e) => e['jobId'] === job!.id)).toHaveLength(0);
    expect(job!.failedWalk).toBeUndefined();
    expect(job!.blockedReason).not.toBe('unreachable');
    expect(w.game.world.entities.get(chair, C.Item)!.flags & ItemFlag.AtDepot).toBe(0);
    // Open the tile: the job runs within its retry interval and the chair reaches the depot.
    expect(w.game.world.applyCommand({ type: 'SetTraffic', tiles: [at], mode: 'normal' }).ok).toBe(true);
    w.until((v) => v.events('JobCompleted').some((e) => e['jobId'] === job!.id), 2000);
    expect(w.game.world.entities.get(chair, C.Item)!.flags & ItemFlag.AtDepot).not.toBe(0);
  });

  it('a day later the checker finds no job blocked as unreachable while its walkers reach its stand tile', () => {
    const w = new TestWorld({ seed: 't392-checker', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const depot = w.build('trade_depot', w.index(40, 20, Z), 'granite');
    const at = w.index(30, 24, Z);
    w.spawnDwarf({ at: w.index(30, 20, Z) });
    const chair = w.spawnItem('chair', 'pine', at);
    w.game.world.applyCommand({ type: 'SetTraffic', tiles: [at], mode: 'forbidden' });
    w.step(1);
    w.submit({ type: 'MoveToDepot', depotId: depot, itemIds: [chair] });
    for (let k = 0; k < 40; k += 1) {
      w.step(100);
      checkInvariants(w.game);
    }
    expect(checkInvariants(w.game).filter((f) => f.inv.startsWith('job.unreachable'))).toEqual([]);
  });
});
