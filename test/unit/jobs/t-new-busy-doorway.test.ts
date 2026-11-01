/** A door in steady use does not hold a job back: only a creature that stays in it does (`11` § Blocked jobs). */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { JobBoard } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

function doorWithTwoGuards(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 20, Z), TileKind.Wall, granite);
  const doorTile = w.index(40, 20, Z);
  w.build('door', doorTile, 'oak');
  w.step(1);
  const first = w.spawnDwarf({ at: doorTile });
  const second = w.spawnDwarf({ at: w.index(30, 24, Z) });
  for (const guard of [first, second]) w.game.world.entities.remove(guard, C.Brain);
  const target = w.index(44, 15, Z);
  w.carve(target, TileKind.Wall);
  const at = w.index(38, 24, Z);
  const miner = w.spawnDwarf({ at, skills: { mining: 10 } });
  const pick = w.spawnItem('pick', 'iron', at);
  w.items.attachToCarrier(pick, miner);
  w.game.world.entities.add(miner, C.Worker, { jobId: 0, phase: 0, carrying: 0, toolId: pick });
  const equipment = w.game.world.entities.get(miner, C.Equipment)!;
  w.game.world.entities.add(miner, C.Equipment, { ...equipment, weapon: pick });
  expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: [target] }).ok).toBe(true);
  const board = w.game.world.services.jobs as JobBoard;
  w.until(() => [...board.jobs.values()].some((j) => j.target.ref === target && j.data['crowdedTile'] === doorTile), 1200);
  return { w, board, doorTile, first, second, target };
}

const heldBack = (board: JobBoard, target: number): boolean => [...board.jobs.values()].some((j) => j.target.ref === target && j.data['crowdedTile'] !== undefined);

describe('a door in steady use', () => {
  it('does not keep a job blocked: with someone else in the door at each look, the job reopens', () => {
    const { w, board, doorTile, first, second, target } = doorWithTwoGuards('busy-door');
    const away = w.index(30, 24, Z);
    let inDoor = first;
    let reopened = false;
    for (let t = 0; t < 600 && !reopened; t += 40) {
      // The door is never empty: one steps out as the other steps in.
      const other = inDoor === first ? second : first;
      expect(w.game.movement.teleport(inDoor, away)).toBe(true);
      expect(w.game.movement.teleport(other, doorTile)).toBe(true);
      inDoor = other;
      w.step(40);
      reopened = !heldBack(board, target);
    }
    expect(reopened).toBe(true);
  });

  it('a creature that stays in the door still holds the job, as long as it stays', () => {
    const { w, board, target } = doorWithTwoGuards('held-door');
    w.step(600);
    expect(heldBack(board, target)).toBe(true);
  });
});
