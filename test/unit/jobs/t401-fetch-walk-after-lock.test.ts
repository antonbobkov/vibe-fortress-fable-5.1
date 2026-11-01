/**
 * T-401: a walk to an item that failed because the connectivity labels changed under it (a door
 * locked while the worker was on its way) is not a walk that failed despite connected labels, so
 * it does not wait for a reachability trigger that already fired; the periodic retry reopens the job.
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { JobBoard } from '@systems/jobs';
import { BLOCKED_RETRY_TICKS } from '@systems/jobs/constants';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

/** A wall across the map with a door in it; a worker and a patient south of it; a drink north of it. */
function lockedGate(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 20, Z), TileKind.Wall, granite);
  const door = w.build('door', w.index(40, 20, Z), 'oak');
  const worker = w.spawnDwarf({ at: w.index(40, 24, Z) });
  const patient = w.spawnDwarf({ at: w.index(46, 28, Z) });
  const outside = w.spawnItem('drink', 'ale', w.index(40, 10, Z));
  w.step(1);
  const board = w.game.world.services.jobs as JobBoard;
  const id = board.create('t401:water', { type: 'water_patient', target: { kind: 'entity', ref: patient }, workTile: 'adjacent',
    inputs: [{ filter: { category: 'drink' }, count: 1 }], data: { patient } });
  return { w, board, id, door, worker, patient, outside };
}

describe('T-401 a fetch walk that the labels explain does not wait for a trigger', () => {
  it('reopens the job after a door locks on the worker\'s way, and takes the drink on its own side', () => {
    const { w, board, id, door, worker, outside } = lockedGate('t401-locked-gate');
    expect(board.claim(worker, board.jobs.get(id)!)).toBe(true);
    expect(board.jobs.get(id)!.inputs[0]!.reserved).toEqual([outside]);
    // The worker sets out for the drink beyond the wall; the door locks when it is a few tiles from it.
    w.until(() => board.jobs.get(id)?.state === 'fetching' && w.game.movement.tileOf(worker) !== w.index(40, 24, Z) &&
      w.map.yOf(w.game.movement.tileOf(worker)) <= 22, 300);
    expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'locked' })).toEqual({ ok: true });
    w.until(() => board.jobs.get(id)?.state === 'blocked', 600);
    const blocked = board.jobs.get(id)!;
    expect(blocked.blockedReason).toBe('unreachable');
    // The labels now keep the worker from the drink: that is no failure of a walk between connected labels.
    expect(w.pathing.reader().reachable(w.game.movement.tileOf(worker), w.index(40, 10, Z), 'walker')).toBe(false);
    expect(blocked.failedWalk).not.toBe(true);
    // A drink on the worker's side of the wall: the next retry takes it, with the door still locked.
    const inside = w.spawnItem('drink', 'ale', w.index(44, 26, Z));
    w.until((v) => v.events('JobCompleted').some((e) => e['jobId'] === id), BLOCKED_RETRY_TICKS + 600);
    expect(w.game.world.entities.alive(inside)).toBe(false);
    expect(w.game.world.entities.alive(outside)).toBe(true);
    expect(w.events('JobBlocked').filter((e) => e['jobId'] === id)).toHaveLength(1);
    expect(roundTrip(w.game).game.hash()).toBe(w.game.hash());
  });

  it('still waits for a trigger when the labels connect the worker to the place its walk failed to reach', () => {
    const { w, board, id, worker } = lockedGate('t401-connected');
    expect(board.claim(worker, board.jobs.get(id)!)).toBe(true);
    const job = board.jobs.get(id)!;
    // A walk that failed with connected labels (T-187's forbidden traffic): the worker and the drink share a label.
    expect(w.pathing.reader().reachable(w.game.movement.tileOf(worker), w.index(40, 10, Z), 'walker')).toBe(true);
    board.unclaim(job, 'unreachable', w.index(40, 10, Z));
    expect(job.failedWalk).toBe(true);
    expect(w.game.world.entities.get(worker, C.Worker)?.jobId).toBe(0);
  });
});
