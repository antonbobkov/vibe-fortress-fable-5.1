import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { JobsReader } from '@systems/jobs/reader';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

/** Steps until the predicate holds or the ticks run out (no throw: the assertions say what failed). */
function runUntil(w: TestWorld, predicate: () => boolean, maxTicks: number): void {
  for (let t = 0; t < maxTicks && !predicate(); t += 10) w.step(10);
}

/**
 * T-527: on `defence_year` the carpenter's `make_bed` job (priority 5) stood open for two months while
 * its carpenters, eligible for it, took jobs of priority 4 (planting, harvest, building, other
 * workshops' orders) one after another. The workshop holds one job at a time, so the cage order at
 * the head of its list, runnable since a trap's cage was spent, never ran. An unclaimed job that
 * nothing has been put into gives way to a runnable order ahead of it (12 § Operation, step 1).
 */
function setup(): { w: TestWorld; carpenter: number; dwarf: number } {
  const w = new TestWorld({ seed: 't527-gives-way', world: 'flat-test', embark: 'none' });
  const carpenter = w.build('carpenter', w.index(15, 15, Z));
  const mason = w.build('mason', w.index(30, 15, Z));
  w.spawnItem('log', 'oak', w.index(17, 18, Z), 10);
  for (let k = 0; k < 40; k += 1) w.spawnItem('raw_stone', 'granite', w.index(28 + (k % 8), 19 + Math.floor(k / 8), Z));
  w.spawnItem('easy_meal', 'dimcap', w.index(25, 25, Z), 60);
  w.spawnItem('drink', 'ale', w.index(26, 25, Z), 60);
  const dwarf = w.spawnDwarf({ at: w.index(29, 18, Z), ageYears: 30 });
  for (const name of w.game.registry.table('labors').ids()) w.setLabor(dwarf, name, name === 'carpentry' || name === 'masonry');
  w.step(1);
  // A standing supply of more urgent work: the mason's blocks at priority 4.
  expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: mason,
    order: { recipeId: 'make_stone_block', mode: 'maintain', threshold: 999, priority: 4 } })).toEqual({ ok: true });
  expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: carpenter,
    order: { recipeId: 'make_bed', mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
  w.step(3);
  return { w, carpenter, dwarf };
}

describe('T-527 a workshop does not hold an unclaimed job while an order ahead of it can run', () => {
  it('the bed job nobody takes gives way to the cage order moved to the head of the list', () => {
    const { w, carpenter } = setup();
    const jobs = w.readers.of<JobsReader>('11');
    const current = (): number => w.game.world.entities.get(carpenter, C.Workshop)?.currentJobId ?? 0;
    const bedJob = current();
    expect(bedJob).not.toBe(0);
    // The priority-4 blocks keep the only carpenter busy: the bed job waits, open and unclaimed.
    w.step(TICKS_PER_DAY);
    expect(jobs.get(bedJob)?.state).toBe('open');
    expect(w.events('ItemCrafted').filter((e) => e['recipeId'] === 'make_stone_block').length).toBeGreaterThan(0);
    // The player adds a cage order and moves it to the top, as the defence script does.
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: carpenter,
      order: { recipeId: 'make_cage_wood', mode: 'maintain', threshold: 1, priority: 3 } })).toEqual({ ok: true });
    expect(w.game.world.applyCommand({ type: 'ReorderWorkOrder', workshopId: carpenter, from: 1, to: 0 })).toEqual({ ok: true });
    runUntil(w, () => w.events('ItemCrafted').some((e) => e['recipeId'] === 'make_cage_wood'), 2 * TICKS_PER_DAY);
    expect(w.events('JobCancelled').filter((e) => e['jobId'] === bedJob).map((e) => e['reason'])).toEqual(['order_ahead']);
    expect(w.events('ItemCrafted').some((e) => e['recipeId'] === 'make_cage_wood')).toBe(true);
    // The bed order stands, and its job comes back once the cage order is met.
    const orders = w.game.world.entities.get(carpenter, C.Workshop)?.orders ?? [];
    expect(orders.map((o) => w.game.registry.table('recipes').byIndex(o.recipe)?.id)).toEqual(['make_cage_wood', 'make_bed']);
    w.step(200);
    expect(jobs.get(current())?.data['recipe']).toBe('make_bed');
  }, 120_000);

  it('a job a worker has claimed keeps its place', () => {
    const { w, carpenter, dwarf } = setup();
    const jobs = w.readers.of<JobsReader>('11');
    // No more blocks: the carpenter takes the bed job.
    w.setLabor(dwarf, 'masonry', false);
    const bedJob = w.game.world.entities.get(carpenter, C.Workshop)?.currentJobId ?? 0;
    runUntil(w, () => jobs.get(bedJob)?.state === 'working', TICKS_PER_DAY);
    expect(jobs.get(bedJob)?.state).toBe('working');
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: carpenter,
      order: { recipeId: 'make_cage_wood', mode: 'maintain', threshold: 1, priority: 3 } })).toEqual({ ok: true });
    expect(w.game.world.applyCommand({ type: 'ReorderWorkOrder', workshopId: carpenter, from: 1, to: 0 })).toEqual({ ok: true });
    runUntil(w, () => w.events('ItemCrafted').some((e) => e['recipeId'] === 'make_bed'), 2 * TICKS_PER_DAY);
    expect(w.events('ItemCrafted').some((e) => e['recipeId'] === 'make_bed')).toBe(true);
    expect(w.events('JobCancelled').filter((e) => e['jobId'] === bedJob)).toHaveLength(0);
  }, 120_000);
});
