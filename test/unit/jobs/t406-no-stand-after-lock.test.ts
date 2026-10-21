/**
 * T-406: a worker carrying a care job's drink to its patient, cut off from every stand tile by a door
 * that locked on its way, has no stand tile left in its label. The labels explain that: the job is
 * blocked `unreachable` without the memory of a failed walk, and its periodic retry gives it to a
 * worker on the patient's side. With that memory it waited for a reachability trigger that had
 * already fired.
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { JobBoard } from '@systems/jobs';
import { BLOCKED_RETRY_TICKS } from '@systems/jobs/constants';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

describe('T-406 a care job whose worker no longer reaches any stand tile does not wait for a trigger', () => {
  it('reopens after a door locks between the carried drink and the patient, and a worker on the patient\'s side does it', () => {
    const w = new TestWorld({ seed: 't406-no-stand', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const world = w.game.world;
    const granite = w.game.registry.table('materials').index('granite');
    for (let x = 0; x < w.map.w; x += 1) if (x !== 40) world.services.terrain.setKind(w.index(x, 20, Z), TileKind.Wall, granite);
    const door = w.build('door', w.index(40, 20, Z), 'oak');
    const worker = w.spawnDwarf({ at: w.index(40, 26, Z) });
    const patient = w.spawnDwarf({ at: w.index(40, 10, Z) });
    const north = w.spawnDwarf({ at: w.index(46, 8, Z) });
    for (const id of [worker, patient, north])
      for (const need of ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const) w.setNeed(id, need, 0);
    const south = w.spawnItem('drink', 'ale', w.index(40, 28, Z));
    const beyond = w.spawnItem('drink', 'ale', w.index(48, 6, Z));
    w.step(1);
    const board = world.services.jobs as JobBoard;
    const id = board.create('t406:water', { type: 'water_patient', target: { kind: 'entity', ref: patient }, workTile: 'adjacent',
      inputs: [{ filter: { category: 'drink' }, count: 1 }], data: { patient } });
    expect(board.claim(worker, board.jobs.get(id)!)).toBe(true);
    expect(board.jobs.get(id)!.inputs[0]!.reserved).toEqual([south]);
    // The worker takes the drink and sets out north; the door locks when it is a few tiles from it.
    w.until(() => world.entities.get(worker, C.Worker)?.carrying === south && w.map.yOf(w.game.movement.tileOf(worker)) <= 23, 400);
    expect(world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'locked' })).toEqual({ ok: true });
    w.until(() => board.jobs.get(id)?.state === 'blocked', 600);
    const blocked = board.jobs.get(id)!;
    expect(blocked.blockedReason).toBe('unreachable');
    expect(blocked.failedWalk).not.toBe(true);
    // The retry opens the job; the dwarf on the patient's side takes the drink there and gives it.
    w.until((v) => v.events('JobCompleted').some((e) => e['jobId'] === id), BLOCKED_RETRY_TICKS + 900);
    expect(world.entities.alive(beyond)).toBe(false);
    expect(world.entities.alive(south)).toBe(true);
    expect(roundTrip(w.game).game.hash()).toBe(w.game.hash());
  });
});
