/**
 * T-629: under a `hearth` alert a civilian that 19 finds no shelter for (no hearth hall, no indoor
 * tile behind a door, no bedroom) works as under a `watchful` alert: 11 offers it every job, and it
 * keeps digging. When a shelter appears it is rechecked, its job outside the shelter goes back to the
 * board, and it retreats (11 § Assignment, 10 § Behavior selection step 2, 19 § Hearth alert retreat).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { DwarvesReader } from '@systems/dwarves';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const z = FLAT_TEST_SURFACE_Z;

/** A miner with a pick on open ground, and a row of rock designated for digging; nothing anywhere to shelter in. */
function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  const miner = w.spawnDwarf({ at: w.index(10, 10, z), skills: { mining: 5 } });
  w.spawnItem('pick', 'copper', w.index(10, 10, z));
  w.setLabor(miner, 'mining', true);
  const rock: TileIndex[] = [];
  for (let x = 14; x < 24; x += 1) {
    const tile = w.index(x, 12, z);
    w.carve(tile, TileKind.Wall, granite);
    rock.push(tile);
  }
  expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: rock }).ok).toBe(true);
  const dug = (): number => rock.filter((t) => w.map.kindAt(t) !== TileKind.Wall).length;
  const keepFed = (): void => {
    for (const need of ['hunger', 'thirst', 'rest'] as const) {
      const n = w.game.world.entities.get(miner, C.Needs);
      if (n !== undefined && n[need] > 20) w.setNeed(miner, need, 0);
    }
  };
  const run = (ticks: number, until?: () => boolean): void => {
    for (let t = 0; t < ticks; t += 1) {
      w.step(1);
      if (t % 10 === 0) keepFed();
      if (until?.() === true) return;
    }
  };
  return { w, miner, rock, dug, run };
}

describe('T-629 the Hearth alert with no shelter anywhere', () => {
  it('a civilian with no shelter keeps digging under the alert, and stops when a hall with a hearth is made', () => {
    const { w, miner, dug, run } = setup('t629-dig');
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(2);
    const dwarves = w.readers.of<DwarvesReader>('10');
    const jobs = w.readers.of<JobsReader>('11');
    expect(dwarves.unsheltered()).toEqual([miner]);
    // It digs as it would under a watchful alert.
    run(3000, () => dug() >= 3);
    expect(dug()).toBeGreaterThanOrEqual(3);
    run(400, () => dwarves.activityText(miner) === 'Dig');
    expect(dwarves.activityText(miner)).toBe('Dig');
    expect(jobs.forWorker(miner)).toBeDefined();

    // A hearth makes a hall: the miner is rechecked, gives its dig back to the board and shelters.
    w.build('hearth', w.index(30, 30, z), 'granite');
    run(20, () => w.game.world.entities.get(miner, C.Brain)?.behavior === 'retreat');
    expect(w.game.world.entities.get(miner, C.Brain)?.behavior).toBe('retreat');
    expect(dwarves.unsheltered()).toEqual([]);
    expect(dwarves.isUnsheltered(miner)).toBe(false);
    w.step(1);
    expect(jobs.forWorker(miner)).toBeUndefined();
    const before = dug();
    run(600);
    expect(dug()).toBe(before);
    expect(w.game.world.entities.get(miner, C.Brain)?.behavior).toBe('retreat');
  });

  it('the alert raised on a civilian at work with no shelter leaves its job with it', () => {
    const { w, miner, run } = setup('t629-at-work');
    const dwarves = w.readers.of<DwarvesReader>('10');
    const jobs = w.readers.of<JobsReader>('11');
    run(2000, () => dwarves.activityText(miner) === 'Dig');
    expect(dwarves.activityText(miner)).toBe('Dig');
    const job = jobs.forWorker(miner)?.id;
    expect(job).toBeDefined();
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(2);
    expect(dwarves.unsheltered()).toEqual([miner as EntityId]);
    expect(jobs.forWorker(miner)?.id).toBe(job);
    expect(w.game.world.entities.get(miner, C.Brain)?.behavior).toBe('work');
  });
});
