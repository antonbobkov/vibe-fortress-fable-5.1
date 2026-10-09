import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs/reader';
import type { WorkshopsReader } from '@systems/workshops';
import { TestWorld } from '../scenarios/test-world';

const Z = 32;

function setup(): { w: TestWorld; shop: number; bone: number } {
  const w = new TestWorld({ seed: 't182-orders', world: 'flat-test', embark: 'none' });
  const shop = w.build('craftdwarf', w.index(15, 15, Z));
  const bone = w.spawnItem('bone_pile', 'bone', w.index(19, 17, Z));
  w.spawnItem('raw_stone', 'granite', w.index(20, 17, Z));
  w.spawnItem('raw_stone', 'granite', w.index(20, 18, Z));
  w.spawnItem('easy_meal', 'dimcap', w.index(25, 25, Z), 60);
  w.spawnItem('drink', 'ale', w.index(26, 25, Z), 60);
  w.step(1);
  expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: shop,
    order: { recipeId: 'craft_bone', mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
  expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: shop,
    order: { recipeId: 'make_mug_stone', mode: 'once', remaining: 2, priority: 5 } })).toEqual({ ok: true });
  w.step(3);
  return { w, shop, bone };
}

describe('T-182 a workshop does not wait on a job it cannot supply', () => {
  it('the second order runs while the first has lost its input, and the first runs when the input returns', () => {
    const { w, shop, bone } = setup();
    const jobs = w.readers.of<JobsReader>('11');
    const ws = w.readers.of<WorkshopsReader>('12');
    const items = w.readers.of<ItemsReader>('13');
    expect(w.game.world.entities.get(shop, C.Workshop)?.currentJobId).not.toBe(0);
    expect(w.game.world.applyCommand({ type: 'ForbidItem', itemId: bone, on: true })).toEqual({ ok: true });
    w.spawnDwarf({ at: w.index(17, 17, Z), ageYears: 30, skills: { crafting: 5 } });
    const mugs = (): number => w.events('ItemCrafted').filter((e) => e['recipeId'] === 'make_mug_stone').length;
    w.until(() => mugs() >= 2, 20 * TICKS_PER_DAY);
    expect(mugs()).toBe(2);
    expect(items.count('mug')).toBeGreaterThanOrEqual(2);
    expect(w.events('JobCancelled').some((e) => e['reason'] === 'order_not_runnable')).toBe(true);
    expect(ws.isRunnable('craft_bone', shop)).not.toBe(true);
    w.step(2);
    expect(w.events('WorkshopBlocked').filter((e) => e['workshopId'] === shop)).toHaveLength(1);
    expect(jobs.list().filter((j) => j.blockedReason === 'missing_input')).toHaveLength(0);
    expect(w.game.world.applyCommand({ type: 'ForbidItem', itemId: bone, on: false })).toEqual({ ok: true });
    w.until(() => w.events('ItemCrafted').some((e) => e['recipeId'] === 'craft_bone'), 10 * TICKS_PER_DAY);
    expect(w.events('ItemCrafted').some((e) => e['recipeId'] === 'craft_bone')).toBe(true);
  }, 120_000);

  it('a job blocked for no_worker is kept', () => {
    const { w, shop, bone } = setup();
    const jobs = w.readers.of<JobsReader>('11');
    const d = w.spawnDwarf({ at: w.index(17, 17, Z), ageYears: 30, skills: { crafting: 5 } });
    for (const name of w.game.registry.table('labors').ids()) w.setLabor(d, name, false);
    w.step(3);
    expect(w.game.world.applyCommand({ type: 'ForbidItem', itemId: bone, on: true })).toEqual({ ok: true });
    w.step(2 * TICKS_PER_DAY);
    const current = w.game.world.entities.get(shop, C.Workshop)?.currentJobId ?? 0;
    expect(current).not.toBe(0);
    expect(jobs.list().find((j) => j.id === current)?.blockedReason).toBe('no_worker');
    expect(w.events('JobCancelled').filter((e) => e['reason'] === 'order_not_runnable')).toHaveLength(0);
  }, 120_000);
});
