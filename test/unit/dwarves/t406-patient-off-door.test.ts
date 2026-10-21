/**
 * T-406: a patient with no bed rests where it stands, but never on a door's tile. Any creature on a
 * door stops every walker at it (22), so a patient resting in a doorway held a care job's walk up for
 * good: the job waited for the doorway to clear, and it never did.
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { JobBoard } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

/** A wall across the map with a door in it; a worker and a thirsty dwarf south of it, a drink north of it, a hurt dwarf in the doorway. */
function doorway(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) world.services.terrain.setKind(w.index(x, 20, Z), TileKind.Wall, granite);
  const doorTile = w.index(40, 20, Z);
  w.build('door', doorTile, 'oak');
  const worker = w.spawnDwarf({ at: w.index(40, 24, Z) });
  const thirsty = w.spawnDwarf({ at: w.index(46, 28, Z) });
  const hurt = w.spawnDwarf({ at: doorTile });
  w.spawnItem('drink', 'ale', w.index(40, 10, Z));
  for (const id of [worker, thirsty, hurt])
    for (const need of ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const) w.setNeed(id, need, 0);
  // A broken bone with no splint in the fortress keeps the dwarf a patient; there is no bed to send it to.
  world.emit({ type: 'DamageDealt', defenderId: hurt, attackerId: 0, part: 'torso', damageType: 'fracture', amount: 5 });
  w.step(2);
  world.entities.get(hurt, C.Body)!.diagnosed = true;
  expect(world.entities.get(hurt, C.Patient)?.bedId).toBe(0);
  const board = world.services.jobs as JobBoard;
  const id = board.create('t406:water', { type: 'water_patient', target: { kind: 'entity', ref: thirsty }, workTile: 'adjacent',
    inputs: [{ filter: { category: 'drink' }, count: 1 }], data: { patient: thirsty } });
  return { w, world, board, id, doorTile, worker, hurt };
}

describe('T-406 a patient with no bed does not rest in a doorway', () => {
  it('steps off the door, so a care job\'s walk through it goes on', () => {
    const { w, world, board, id, doorTile, worker, hurt } = doorway('t406-doorway');
    expect(board.claim(worker, board.jobs.get(id)!)).toBe(true);
    w.until((v) => v.events('JobCompleted').some((e) => e['jobId'] === id), 1200);
    expect(world.entities.get(hurt, C.Patient)).toBeDefined();
    expect(world.entities.get(hurt, C.Brain)?.behavior).toBe('patient');
    expect(w.game.movement.tileOf(hurt)).not.toBe(doorTile);
    expect(w.events('JobBlocked').filter((e) => e['jobId'] === id)).toHaveLength(0);
    expect(roundTrip(w.game).game.hash()).toBe(w.game.hash());
  });

  it('rests on a tile beside the door that is not a door, and stays there', () => {
    const { w, world, doorTile, hurt } = doorway('t406-beside');
    w.step(60);
    const at = w.game.movement.tileOf(hurt);
    expect(at).not.toBe(doorTile);
    expect(w.map.zOf(at)).toBe(Z);
    expect(Math.max(Math.abs(w.map.xOf(at) - 40), Math.abs(w.map.yOf(at) - 20))).toBe(1);
    expect(world.entities.get(hurt, C.Brain)?.targetTile).toBe(at);
    w.step(60);
    expect(w.game.movement.tileOf(hurt)).toBe(at);
  });
});
