/**
 * T-487: a fetch walk that fails while the connectivity labels join the worker to the item (here the
 * only way to it is forbidden traffic, which the labels do not see) is no failure of the job's stand
 * tiles. The job is blocked without the failed-walk memory, its periodic retry reopens it, and the
 * next claim passes that item by.
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { TileKind } from '@core/map3d';
import type { JobBoard } from '@systems/jobs';
import { BLOCKED_RETRY_TICKS } from '@systems/jobs/constants';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

/** A wall across the map whose one gap is forbidden; a worker and a patient south of it; a drink north of it. */
function forbiddenGap(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 20, Z), TileKind.Wall, granite);
  const gap = w.index(40, 20, Z);
  expect(w.game.world.applyCommand({ type: 'SetTraffic', tiles: [gap], mode: 'forbidden' }).ok).toBe(true);
  const worker = w.spawnDwarf({ at: w.index(40, 24, Z) });
  const patient = w.spawnDwarf({ at: w.index(46, 28, Z) });
  const beyond = w.spawnItem('drink', 'ale', w.index(40, 17, Z));
  w.step(1);
  const board = w.game.world.services.jobs as JobBoard;
  const id = board.create('t487:water', { type: 'water_patient', target: { kind: 'entity', ref: patient }, workTile: 'adjacent',
    inputs: [{ filter: { category: 'drink' }, count: 1 }], data: { patient } });
  return { w, board, id, gap, worker, beyond };
}

describe('T-487 a failed fetch walk is retried on the timer', () => {
  it('reopens the job and takes another drink when the walk to the nearest one fails with the labels joined', () => {
    const { w, board, id, worker, beyond } = forbiddenGap('t487-forbidden-gap');
    const near = w.spawnItem('drink', 'ale', w.index(40, 34, Z));
    expect(board.claim(worker, board.jobs.get(id)!)).toBe(true);
    expect(board.jobs.get(id)!.inputs[0]!.reserved).toEqual([beyond]);
    w.until(() => board.jobs.get(id)?.state === 'blocked', 600);
    const blocked = board.jobs.get(id)!;
    expect(blocked.blockedReason).toBe('unreachable');
    // The labels join the worker to the drink beyond the gap: only the forbidden gap kept the walk from it.
    expect(w.pathing.reader().reachable(w.game.movement.tileOf(worker), w.index(40, 17, Z), 'walker')).toBe(true);
    expect(blocked.failedWalk).not.toBe(true);
    expect(blocked.data['unreachableItem']).toBe(beyond);
    expect(roundTrip(w.game).game.hash()).toBe(w.game.hash());
    // No trigger fires: the periodic retry reopens the job, and the claim takes the drink on the worker's side.
    w.until((v) => v.events('JobCompleted').some((e) => e['jobId'] === id), BLOCKED_RETRY_TICKS + 900);
    expect(w.game.world.entities.alive(near)).toBe(false);
    expect(w.game.world.entities.alive(beyond)).toBe(true);
  });

  it('keeps retrying a job whose drinks all lie beyond the gap, and completes once the gap opens', () => {
    const { w, board, id, gap } = forbiddenGap('t487-only-beyond');
    // More drinks beyond the gap, so that a thirsty dwarf's own drink does not leave the job without one.
    for (const x of [38, 42]) w.spawnItem('drink', 'ale', w.index(x, 16, Z));
    w.step(6 * BLOCKED_RETRY_TICKS);
    const job = board.jobs.get(id)!;
    expect(job.failedWalk).not.toBe(true);
    // Never lost: the job is claimed again and again while its stand tiles are reachable.
    expect(w.events('JobClaimed').filter((e) => e['jobId'] === id).length).toBeGreaterThan(2);
    expect(w.events('JobCompleted').some((e) => e['jobId'] === id)).toBe(false);
    expect(w.game.world.applyCommand({ type: 'SetTraffic', tiles: [gap], mode: 'normal' }).ok).toBe(true);
    w.until((v) => v.events('JobCompleted').some((e) => e['jobId'] === id), 3 * BLOCKED_RETRY_TICKS + 900);
  });
});
