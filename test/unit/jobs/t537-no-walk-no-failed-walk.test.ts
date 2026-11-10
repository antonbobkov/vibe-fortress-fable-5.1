/**
 * T-537: a job turned back with no walk tried is no failed walk. In the sweep's `three-years-p4-1` at
 * shift 50 (day 254) two `craft` jobs held `travelling` had their workshop's work tile on fire: burning
 * blocks every walker (22) but the labels know the terrain only, so they still joined the worker (who
 * had its tile) to the work tile, and the job took the failed-walk memory and waited
 * `FAILED_WALK_RETRY_TICKS` though no walk was tried. And a worker with no tile (a dwarf a cage trap
 * caught, 19) keeps no job: it goes back to the board, progress kept.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
import type { JobBoard } from '@systems/jobs';
import { BLOCKED_RETRY_TICKS } from '@systems/jobs/constants';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

function setUp(seed: string): { w: TestWorld; board: JobBoard; worker: number; id: number; work: number } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const worker = w.spawnDwarf({ at: w.index(40, 40, Z) });
  for (const need of ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const) w.setNeed(worker, need, 0);
  w.step(1);
  const board = w.game.world.services.jobs as JobBoard;
  const work = w.index(52, 40, Z);
  const id = board.create('t537:walk', { type: 'haul_to_stockpile', target: { kind: 'tile', ref: work }, workTile: work, inputs: [] });
  expect(board.claim(worker, board.jobs.get(id)!)).toBe(true);
  w.until(() => board.jobs.get(id)?.state === 'travelling' && w.map.xOf(w.game.movement.tileOf(worker)) >= 43, 400);
  return { w, board, worker, id, work };
}

describe('T-537 an unclaim with no walk tried', () => {
  it('blocks a job whose work tile is burning without the memory of a failed walk', () => {
    const { w, board, worker, id, work } = setUp('t537-no-stand');
    // The labels see the terrain only, so they still join the worker to the burning work tile.
    w.map.setFlag(work, TileFlag.Burning, true);
    w.until(() => board.jobs.get(id)?.state === 'blocked', 50);
    const job = board.jobs.get(id)!;
    expect(w.reachable(w.game.movement.tileOf(worker), work)).toBe(true);
    expect(job.blockedReason).toBe('unreachable');
    expect(job.failedWalk).not.toBe(true);
    expect(job.retryTick - w.tick).toBeLessThanOrEqual(BLOCKED_RETRY_TICKS);
  });

  it('gives back the job of a worker with no tile, open and with no failed walk', () => {
    const { w, board, worker, id } = setUp('t537-no-tile');
    const world = w.game.world;
    // What a cage trap does to a creature it catches (19): off the map, into the cage.
    const from = w.game.movement.tileOf(worker);
    w.game.movement.stopWalking(worker);
    world.services.spatial?.remove(worker, from);
    world.entities.remove(worker, C.Position);
    w.step(2);
    const job = board.jobs.get(id)!;
    expect(job.state).toBe('open');
    expect(job.workerId).toBe(0);
    expect(job.failedWalk).not.toBe(true);
    expect(world.entities.get(worker, C.Worker)?.jobId).toBe(0);
    expect(w.events('JobBlocked').filter((e) => e['jobId'] === id)).toEqual([]);
  });
});
