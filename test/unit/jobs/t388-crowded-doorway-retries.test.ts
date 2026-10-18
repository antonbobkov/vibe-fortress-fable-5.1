/** T-388: a doorway that stays crowded does not send workers on a retry loop. */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { JobBoard } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

/** A wall across the map with a door in it and a guard who does not move standing in the doorway; `miners` dwarves south of it with three dig jobs north of it. */
function crowdedDoor(seed: string, miners: number) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 20, Z), TileKind.Wall, granite);
  const doorTile = w.index(40, 20, Z);
  w.build('door', doorTile, 'oak');
  w.step(1);
  const guard = w.spawnDwarf({ at: doorTile });
  w.game.world.entities.remove(guard, C.Brain);
  const targets = [w.index(44, 15, Z), w.index(46, 15, Z), w.index(48, 15, Z)];
  for (const t of targets) w.carve(t, TileKind.Wall);
  for (let k = 0; k < miners; k += 1) {
    const at = w.index(38 + k, 24, Z);
    const miner = w.spawnDwarf({ at, skills: { mining: 10 } });
    const pick = w.spawnItem('pick', 'iron', at);
    w.items.attachToCarrier(pick, miner);
    w.game.world.entities.add(miner, C.Worker, { jobId: 0, phase: 0, carrying: 0, toolId: pick });
    const equipment = w.game.world.entities.get(miner, C.Equipment)!;
    w.game.world.entities.add(miner, C.Equipment, { ...equipment, weapon: pick });
  }
  expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: targets }).ok).toBe(true);
  return { w, doorTile, guard, targets };
}

describe('T-388 a doorway that stays crowded', () => {
  it('is walked to once by each job behind it, not again while the guard stands in it', () => {
    const { w, guard, targets } = crowdedDoor('t388-loop', 3);
    w.step(1800);
    const board = w.game.world.services.jobs as JobBoard;
    const jobs = [...board.jobs.values()].filter((j) => targets.includes(j.target.ref));
    expect(jobs).toHaveLength(3);
    for (const job of jobs) {
      const claims = w.events('JobClaimed').filter((e) => e['jobId'] === job.id).length;
      expect(claims, `job ${job.id} claimed`).toBeLessThanOrEqual(2);
      expect(job.failedWalk).not.toBe(true);
    }
    // Once the doorway is clear every job reopens within a retry interval and the room is dug.
    expect(w.game.movement.teleport(guard, w.index(36, 24, Z))).toBe(true);
    w.until((v) => targets.every((t) => v.map.kindAt(t) === TileKind.Floor), 3000);
  });

  it('remembers the crowded tile through a save', () => {
    const { w, doorTile, guard, targets } = crowdedDoor('t388-save', 1);
    w.step(900);
    const board = w.game.world.services.jobs as JobBoard;
    const blocked = [...board.jobs.values()].filter((j) => targets.includes(j.target.ref) && j.data['crowdedTile'] !== undefined);
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked[0]?.data['crowdedTile']).toBe(doorTile);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.game.hash());
    w.replaceGame(loaded);
    expect(w.game.movement.teleport(guard, w.index(36, 24, Z))).toBe(true);
    w.until((v) => targets.every((t) => v.map.kindAt(t) === TileKind.Floor), 4000);
  });
});
