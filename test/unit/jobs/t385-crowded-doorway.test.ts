/** T-385: a walk that creatures standing in a doorway keep blocking is not a failed walk to a place that has no route. */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { JobBoard } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

/** A wall across the map with a door in it, a guard who does not move standing in the doorway, and a miner south of it. */
function crowdedDoor(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 20, Z), TileKind.Wall, granite);
  const doorTile = w.index(40, 20, Z);
  w.build('door', doorTile, 'oak');
  w.step(1);
  const guard = w.spawnDwarf({ at: doorTile });
  w.game.world.entities.remove(guard, C.Brain);
  const target = w.index(44, 15, Z);
  w.carve(target, TileKind.Wall);
  const at = w.index(40, 24, Z);
  const miner = w.spawnDwarf({ at, skills: { mining: 10 } });
  const pick = w.spawnItem('pick', 'iron', at);
  w.items.attachToCarrier(pick, miner);
  w.game.world.entities.add(miner, C.Worker, { jobId: 0, phase: 0, carrying: 0, toolId: pick });
  const equipment = w.game.world.entities.get(miner, C.Equipment)!;
  w.game.world.entities.add(miner, C.Equipment, { ...equipment, weapon: pick });
  expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: [target] }).ok).toBe(true);
  return { w, doorTile, guard, target };
}

describe('T-385 a doorway that creatures keep blocked does not strand a job', () => {
  it('reopens the job once the doorway is clear, with no change of the map', () => {
    const { w, doorTile, guard, target } = crowdedDoor('t385-crowded-door');
    const board = w.game.world.services.jobs as JobBoard;
    // The miner walks up to the door and gives up on it after REPATH_LIMIT waits.
    let job = [...board.jobs.values()].find((j) => j.target.ref === target);
    for (let k = 0; k < 60; k += 1) {
      w.step(10);
      job = [...board.jobs.values()].find((j) => j.target.ref === target);
      expect(job).toBeDefined();
      // Only a walk that found no route waits for a change of the map: this one tries again by itself.
      expect(job?.failedWalk).not.toBe(true);
    }
    const id = (job as { id: number }).id;
    expect(w.events('JobBlocked').filter((e) => e['jobId'] === id && e['reason'] === 'unreachable').length).toBeGreaterThanOrEqual(1);
    // It waits for the doorway to clear (the retry loop of every interval is T-388's).
    expect(board.jobs.get(id)?.data['crowdedTile']).toBe(doorTile);
    expect(w.pathing.reader().reachable(w.index(40, 24, Z), w.index(40, 16, Z), 'walker')).toBe(true);
    expect(w.game.movement.teleport(guard, w.index(36, 24, Z))).toBe(true);
    w.until((v) => v.events('JobCompleted').some((e) => e['jobId'] === id), 1500);
    expect(w.map.kindAt(target)).toBe(TileKind.Floor);
    expect(w.game.movement.tileOf(guard)).not.toBe(doorTile);
  });
});
