import { describe, expect, it } from 'vitest';
import { TestWorld } from '../../scenarios/test-world';
import { C, ItemFlag } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { WorkshopsReader } from '@systems/workshops';

const make = (seed: string, startTick: number): TestWorld => new TestWorld({ seed, world: 'flat-test', embark: 'none', startTick });
const at = (w: TestWorld, x: number, y = 15): number => w.index(x, y, 32);

describe('T-M4-12 animal product jobs', () => {
  it('milks an adult cow every four days at the farmer workshop', () => {
    const w = make('milk-execution', 4 * TICKS_PER_DAY - 2);
    w.build('farmers_workshop', at(w, 15));
    const cow = w.spawnTame('cow', at(w, 11), { sex: 0 });
    w.spawnDwarf({ at: at(w, 14) });
    const items = w.readers.of<ItemsReader>('13');
    const jobs = w.readers.of<JobsReader>('11');
    w.step(1);
    expect(items.count('milk')).toBe(0);
    w.until(() => items.count('milk') === 1, 1000);
    expect(jobs.byKey(`milk:${cow}`)).toBeUndefined();
    expect(w.animals.ready.has(`milk:${cow}`)).toBe(false);
    expect(w.game.world.entities.get(cow, C.Tame)?.lastProductTick['milk']).toBe(4 * TICKS_PER_DAY + 1);
  });

  it('shears sheep at the seasonal interval and produces raw wool', () => {
    const w = make('wool-execution', 28 * TICKS_PER_DAY - 2);
    w.build('farmers_workshop', at(w, 15));
    const sheep = w.spawnTame('sheep', at(w, 11), { sex: 0 });
    w.spawnDwarf({ at: at(w, 14) });
    const items = w.readers.of<ItemsReader>('13');
    w.step(1);
    expect(items.count('wool_raw')).toBe(0);
    w.until(() => items.count('wool_raw') === 1, 1100);
    expect(w.animals.ready.has(`wool:${sheep}`)).toBe(false);
    expect(w.game.world.entities.get(sheep, C.Tame)?.lastProductTick['wool']).toBe(28 * TICKS_PER_DAY + 1);
  });

  it('holds an egg in its nest until auto collection, then hauls it', () => {
    const w = make('egg-collection', 3 * TICKS_PER_DAY - 2);
    w.build('nest_box', at(w, 12));
    const pileTile = at(w, 20);
    const pile = w.zone('stockpile', [pileTile]);
    expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: pile, filter: 'food' }).ok).toBe(true);
    w.spawnItem('barrel', 'oak', pileTile);
    w.spawnTame('chicken', at(w, 11), { sex: 0 });
    w.spawnDwarf({ at: at(w, 14) });
    expect(w.game.world.applyCommand({ type: 'SetStandingOrder', name: 'autoCollectProducts', on: false }).ok).toBe(true);
    w.until((v) => v.animals.eggs.size === 1, 4);
    const egg = [...w.animals.eggs.keys()][0]!;
    const items = w.readers.of<ItemsReader>('13');
    expect((items.get(egg)?.flags ?? 0) & ItemFlag.Reserved).toBe(ItemFlag.Reserved);
    w.step(30);
    expect(w.animals.eggs.has(egg)).toBe(true);
    expect(w.readers.of<JobsReader>('11').byKey(`haul:${egg}`)).toBeUndefined();
    expect(w.game.world.applyCommand({ type: 'SetStandingOrder', name: 'autoCollectProducts', on: true }).ok).toBe(true);
    w.until((v) => !v.animals.eggs.has(egg), 500);
    expect((items.get(egg)?.flags ?? 0) & ItemFlag.Reserved).toBe(0);
    expect(items.wantsHaulingCount()).toBe(1);
    expect(items.stockpileAccepts(pile, egg)).toBe(true);
    w.until(() => w.readers.of<JobsReader>('11').byKey(`haul:${egg}`) !== undefined, 20);
  });

  it('makes two cheese from three milk at the farmer workshop', () => {
    const w = make('cheese-execution', 0);
    const building = w.build('farmers_workshop', at(w, 15));
    w.spawnDwarf({ at: at(w, 14) });
    w.step(1);
    for (let i = 0; i < 3; i += 1) w.spawnItem('milk', 'milk', at(w, 14 + i));
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: building,
      order: { recipeId: 'make_cheese', remaining: 1, mode: 'once' } }).ok).toBe(true);
    const items = w.readers.of<ItemsReader>('13');
    w.until(() => items.count('cheese') === 2, 1300);
    expect(items.count('milk')).toBe(0);
    expect(w.readers.of<WorkshopsReader>('12').recipe('make_cheese')?.baseTicks).toBe(150);
  });
});
