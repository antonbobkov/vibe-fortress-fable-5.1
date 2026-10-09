import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import type { ItemsReader } from '@systems/items';
import { QUALITY_VALUE_PERMILLE } from '@systems/items/constants';
import type { JobsSystem } from '@systems/jobs';
import { RESERVE_KEEP_TICKS } from '@systems/jobs/constants';
import type { Job } from '@systems/jobs/state';
import { TestWorld } from '../../scenarios/test-world';

interface ItemRowLike { id: string; quality: boolean; tags?: readonly string[]; mult: number }
interface RecipeRowLike { id: string; quality: boolean; outputs: readonly { item: string }[] }

describe('F-17a crafts carry their quality', () => {
  it('every item a Q-marked recipe can output, by id or by tag, is quality-bearing', () => {
    const w = new TestWorld({ seed: 'f17-quality-content', world: 'flat-test', embark: 'none' });
    const items = w.game.registry.table<ItemRowLike>('items');
    const recipes = w.game.registry.table<RecipeRowLike>('recipes');
    const checked: string[] = [];
    for (const recipe of recipes.rows.slice(1)) {
      if (!recipe.quality) continue;
      for (const output of recipe.outputs) {
        const rows = items.has(output.item)
          ? [items.byId(output.item) as ItemRowLike]
          : items.rows.slice(1).filter((row) => row.tags?.includes(output.item) === true);
        expect(rows.length, `${recipe.id} output ${output.item}`).toBeGreaterThan(0);
        for (const row of rows) {
          expect(row.quality, `${recipe.id} → ${row.id}`).toBe(true);
          checked.push(row.id);
        }
      }
    }
    // The symbolic `craft` output of workshops-and-recipes.md: figurines, rings and amulets.
    for (const id of ['figurine', 'ring', 'amulet']) expect(checked).toContain(id);
  });

  it('a stone craft is worth material × type × quality: a fine granite figurine is 9 marks', () => {
    const w = new TestWorld({ seed: 'f17-quality-value', world: 'flat-test', embark: 'none' });
    const items = w.readers.of<ItemsReader>('13');
    const at = w.index(10, 10, 32);
    const byTier = [0, 1, 2, 3, 4, 5].map((q) => items.value(w.spawnItem('figurine', 'granite', at, 1, q)));
    // granite 2 × figurine 3 × (0.5, 1, 1.5, 2, 3, 5): items.md § Value examples, balance.md § Trade.
    expect(byTier).toEqual([3, 6, 9, 12, 18, 30]);
    expect(byTier).toEqual(QUALITY_VALUE_PERMILLE.map((p) => Math.floor((2 * 3 * p) / 1000)));
    expect(items.value(w.spawnItem('amulet', 'granite', at, 1, 2))).toBe(9);
    expect(items.value(w.spawnItem('ring', 'granite', at, 1, 2))).toBe(6);
    expect(items.value(w.spawnItem('ring', 'granite', at, 1, 5))).toBe(20);
  });

  it('a craft made at the workshop is valued by the quality it was rolled with', () => {
    const w = new TestWorld({ seed: 'f17-quality-loop', world: 'flat-test', embark: 'none' });
    const shop = w.build('craftdwarf', w.index(12, 12, 32));
    w.spawnDwarf({ at: w.index(16, 14, 32), skills: { crafting: 12 } });
    for (let k = 0; k < 6; k += 1) w.spawnItem('raw_stone', 'granite', w.index(18 + k, 14, 32));
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: shop,
      order: { recipeId: 'craft_stone', remaining: 6, mode: 'once' } })).toEqual({ ok: true });
    w.until(() => w.events('ItemCrafted').length >= 6, 20000);
    const items = w.readers.of<ItemsReader>('13');
    const registry = w.game.registry.table<ItemRowLike>('items');
    const qualities = new Set<number>();
    for (const event of w.events('ItemCrafted')) {
      const it = items.get(event['itemId'] as EntityId);
      if (it === undefined) continue;
      expect(it.quality).toBe(event['quality']);
      qualities.add(it.quality);
      const mult = (registry.byIndex(it.type) as ItemRowLike).mult;
      expect(items.value(event['itemId'] as EntityId))
        .toBe(Math.floor((2 * mult * (QUALITY_VALUE_PERMILLE[it.quality] as number) * it.count) / 1_000_000));
    }
    // A level-12 crafter rolls above common, so the quality factor is really exercised.
    expect([...qualities].some((q) => q >= 2)).toBe(true);
  });
});

describe('F-17b a job never outputs from inputs it no longer holds', () => {
  function setup(seed: string) {
    const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
    const shopA = w.build('craftdwarf', w.index(12, 12, 32));
    const shopB = w.build('craftdwarf', w.index(24, 12, 32));
    const first = w.spawnDwarf({ at: w.index(16, 16, 32) });
    const stone = w.spawnItem('raw_stone', 'granite', w.index(18, 16, 32));
    w.step(1);
    const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
    const items = w.readers.of<ItemsReader>('13');
    const jobAt = (shop: EntityId): Job | undefined => [...board.jobs.values()].find((j) => j.target.ref === shop);
    const order = (shop: EntityId, worker: EntityId): void => {
      expect(w.game.world.applyCommand({ type: 'SetWorkshopWorker', workshopId: shop, dwarfId: worker })).toEqual({ ok: true });
      expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: shop,
        order: { recipeId: 'craft_stone', remaining: 1, mode: 'once' } })).toEqual({ ok: true });
    };
    /** One entry per completed craft job (the recipe makes one stack of three). */
    const crafted = (): { material: number; value: number; count: number; workshopId: EntityId }[] =>
      w.events('ItemCrafted').map((e) => ({
        material: items.get(e['itemId'] as EntityId)?.material ?? -1,
        value: items.value(e['itemId'] as EntityId),
        count: items.get(e['itemId'] as EntityId)?.count ?? 0,
        workshopId: e['workshopId'] as EntityId,
      }));
    const granite = w.game.registry.table('materials').index('granite');
    const expectRealCrafts = (jobs: number): void => {
      expect(crafted()).toHaveLength(jobs);
      for (const c of crafted()) {
        expect(c.material).toBe(granite);
        expect(c.count).toBe(3);
        expect(c.value).toBeGreaterThan(0);
      }
    };
    return { w, shopA, shopB, first, stone, board, items, jobAt, order, crafted, expectRealCrafts };
  }

  /**
   * reports/M8-balance-economy.md § Additional unfixed bugs 2 (seed three-years-p0-2, craft job
   * 1005 and job 1470), reduced: job A delivers its stone and is interrupted; its reservation
   * was released; job B reserves the same stone; A resumes. A used to keep the stale delivered id, so
   * two jobs "used" one stone and one of them completed with three material-0, value-0 crafts.
   */
  it('T-143: an externally released, re-reserved input is fetched again, never crafted from thin air', () => {
    const { w, shopA, shopB, first, stone, board, items, jobAt, order, crafted, expectRealCrafts } = setup('f17-stale-input');
    order(shopA, first);
    w.until(() => jobAt(shopA)?.inputs[0]?.delivered.includes(stone) === true, 3000);
    const jobA = jobAt(shopA) as Job;
    expect(jobA.workerId).toBe(first);
    expect(items.get(stone)?.reservedBy).toBe(jobA.id);

    // Interrupted (a need, an alert): delivered workshop inputs remain reserved to the order.
    board.interrupt(first, true);
    w.setLabor(first, 'crafts', false);
    expect(jobA.state).toBe('open');
    expect(jobA.inputs[0]?.delivered).toEqual([stone]);
    expect(items.get(stone)?.reservedBy).toBe(jobA.id);
    w.step(RESERVE_KEEP_TICKS + 2);
    expect(items.get(stone)?.reservedBy).toBe(jobA.id);
    // Keep the F-17 stale/foreign-input regression: explicitly release it through the item API.
    w.items.release(stone);
    expect(items.get(stone)?.reservedBy).toBe(0);
    expect(jobA.state).toBe('open');
    expect(jobA.inputs[0]?.delivered).toEqual([stone]);

    // Another job, at another workshop with its own worker, reserves the very same stone.
    const second = w.spawnDwarf({ at: w.index(26, 16, 32) });
    w.step(1);
    order(shopB, second);
    w.until(() => jobAt(shopB)?.inputs[0]?.reserved.includes(stone) === true, 400);
    const jobB = jobAt(shopB) as Job;
    expect(jobB.workerId).toBe(second);
    expect(items.get(stone)?.reservedBy).toBe(jobB.id);

    // The first job resumes: its delivered stone is no longer its own, and there is no other.
    w.setLabor(first, 'crafts', true);
    w.until(() => jobA.state === 'blocked', 400);
    expect(jobA.blockedReason).toBe('missing_input');
    expect(jobA.inputs[0]?.delivered).toEqual([]);
    expect(jobA.inputs[0]?.reserved).toEqual([]);

    w.until(() => w.events('ItemCrafted').length >= 1, 6000);
    w.step(1500);
    // Exactly one job's worth of crafts, granite, worth something; nothing from workshop A.
    expectRealCrafts(1);
    expect(crafted()[0]?.workshopId).toBe(shopB);
    expect(items.get(stone)).toBeUndefined();
    // T-182: the blocked job's order is no longer runnable, so the workshop lets the job go.
    expect(board.jobs.get(jobA.id)).toBeUndefined();
    expect(jobA.state).toBe('cancelled');

    // A new stone: the workshop makes a new job for the order, which completes with real material.
    const fresh = w.spawnItem('raw_stone', 'granite', w.index(14, 16, 32));
    w.until(() => w.events('ItemCrafted').length >= 2, 6000);
    expect(items.get(fresh)).toBeUndefined();
    expectRealCrafts(2);
    expect(crafted()[1]?.workshopId).toBe(shopA);
  });

  it('a delivered input that vanishes while the job is being worked sends it back to fetch', () => {
    const { w, shopA, first, stone, board, items, jobAt, order, expectRealCrafts } = setup('f17-vanished-input');
    order(shopA, first);
    w.until(() => jobAt(shopA)?.state === 'working', 3000);
    const jobA = jobAt(shopA) as Job;
    w.game.world.services.items?.destroy(stone, 'test');
    expect(items.get(stone)).toBeUndefined();
    w.step(1200);
    // No stone anywhere: the job blocks instead of completing with material 0.
    expectRealCrafts(0);
    // T-182: it blocks on the missing input, and the workshop then lets it go: its order is not runnable.
    expect(board.jobs.get(jobA.id)).toBeUndefined();
    expect(jobA.state).toBe('cancelled');
    expect(jobA.inputs[0]?.delivered).toEqual([]);
    expect(w.game.world.entities.get(first, C.Worker)?.jobId).toBe(0);

    w.spawnItem('raw_stone', 'granite', w.index(14, 16, 32));
    w.until(() => w.events('ItemCrafted').length >= 1, 6000);
    expectRealCrafts(1);
  });

  it('a replacement within reach is reserved at once and the kept progress finishes the job', () => {
    const { w, shopA, first, stone, jobAt, order, expectRealCrafts } = setup('f17-replaced-input');
    const spare = w.spawnItem('raw_stone', 'granite', w.index(20, 16, 32));
    order(shopA, first);
    w.until(() => jobAt(shopA)?.state === 'working', 3000);
    const jobA = jobAt(shopA) as Job;
    const lost = jobA.inputs[0]?.delivered[0] as EntityId;
    const other = lost === stone ? spare : stone;
    w.game.world.services.items?.destroy(lost, 'test');
    w.until(() => jobA.state === 'fetching', 1000);
    expect(jobA.inputs[0]?.reserved).toEqual([other]);
    expect(jobA.inputs[0]?.delivered).toEqual([]);
    expect(jobA.progress).toBe(999);
    w.until(() => w.events('ItemCrafted').length >= 1, 6000);
    expectRealCrafts(1);
  });
});
