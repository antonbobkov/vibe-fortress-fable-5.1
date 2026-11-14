import { describe, expect, it } from 'vitest';
import { buildFlatTestMap } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { C, type WorkOrder } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { TileIndex } from '@core/types';
import type { DwarvesReader } from '@systems/dwarves';
import { TIPSY_SLOW_PERCENT, TIPSY_TICKS } from '@systems/dwarves/constants';
import type { ItemsReader } from '@systems/items';
import type { MoraleReader } from '@systems/morale';
import type { WorkshopsReader, WorkshopsSystem } from '@systems/workshops';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

function world(seed: string): TestWorld {
  const registry = new TestWorld({ seed: `${seed}-registry`, world: 'flat-test', embark: 'none' }).game.registry;
  return new TestWorld({ seed, registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none', surfaceWildlife: 'none' });
}

function barrelOf(w: TestWorld, wood: string, drink: string, count: number, at: TileIndex): { barrel: number; drink: number } {
  const barrel = w.spawnItem('barrel', wood, at);
  return { barrel, drink: count > 0 ? w.spawnItem('drink', drink, { containerId: barrel }, count) : 0 };
}

describe('T-554 the still distils spirits', () => {
  it('takes twenty ale from a barrel and a fuel bar, and makes ten deepfire in an empty barrel', () => {
    const w = world('t554-distill');
    const still = w.build('still', w.index(10, 10, Z), 'granite');
    const brewer = w.spawnDwarf({ at: w.index(14, 12, Z), skills: { brewing: 5 } });
    w.setNeed(brewer, 'thirst', 0);
    const source = barrelOf(w, 'pine', 'ale', 20, w.index(16, 12, Z));
    const empty = w.spawnItem('barrel', 'pine', w.index(17, 12, Z));
    w.spawnItem('coal_bar', 'coal', w.index(18, 12, Z), 1);
    w.step(1);
    const workshops = w.readers.of<WorkshopsReader>('12');
    expect(workshops.recipesFor('still').map((r) => r.id)).toContain('distill');
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: still,
      order: { recipeId: 'distill', mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
    const items = w.readers.of<ItemsReader>('13');
    const deepfire = w.game.registry.table('materials').index('deepfire');
    w.until(() => items.countMatching({ materialId: deepfire }) > 0, 3 * TICKS_PER_DAY);
    const made = w.game.world.entities.with(C.Item).filter((id) => items.get(id)?.material === deepfire);
    expect(made).toHaveLength(1);
    const spirits = items.get(made[0] as number);
    expect(spirits?.count).toBe(10);
    expect(spirits?.containerId).toBe(empty);
    expect(items.itemCategory(made[0] as number)).toBe('drink/spirits');
    // The source barrel is a free container again; the ale and the coal are gone.
    expect(items.get(source.drink)).toBeUndefined();
    expect(items.inContainer(source.barrel)).toEqual([]);
    expect(items.count('coal_bar')).toBe(0);
  }, 120_000);

  it('refuses spirits as a distill input, and a maintain order counts only deepfire', () => {
    const w = world('t554-maintain');
    const still = w.build('still', w.index(10, 10, Z), 'granite');
    barrelOf(w, 'pine', 'deepfire', 20, w.index(16, 12, Z));
    barrelOf(w, 'pine', 'ale', 20, w.index(17, 12, Z));
    w.spawnItem('barrel', 'pine', w.index(18, 12, Z));
    w.spawnItem('coal_bar', 'coal', w.index(19, 12, Z), 1);
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: still,
      order: { recipeId: 'distill', mode: 'maintain', threshold: 15, priority: 5 } })).toEqual({ ok: true });
    // 20 deepfire stand, more than 15: the order is stocked though there is ale to distil.
    const operator = (w.game.world.scheduler.byId('12') as WorkshopsSystem).operator;
    expect(operator.problem(operator.workshop(still)?.orders[0] as WorkOrder, still)).toBe('stocked');
    const w2 = world('t554-spirits-in');
    const still2 = w2.build('still', w2.index(10, 10, Z), 'granite');
    barrelOf(w2, 'pine', 'deepfire', 20, w2.index(16, 12, Z));
    w2.spawnItem('barrel', 'pine', w2.index(18, 12, Z));
    w2.spawnItem('coal_bar', 'coal', w2.index(19, 12, Z), 1);
    w2.step(1);
    expect(w2.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: still2,
      order: { recipeId: 'distill', mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
    expect(w2.readers.of<WorkshopsReader>('12').isRunnable('distill', still2).reason).toBe('waiting for drink');
  }, 60_000);
});

describe('T-554 a dwarf who drinks spirits is tipsy', () => {
  it('walks and works 10% slower for two hours, talks twice over and sings', () => {
    const w = world('t554-tipsy');
    const dwarf = w.spawnDwarf({ at: w.index(14, 12, Z) });
    const spirits = barrelOf(w, 'pine', 'deepfire', 20, w.index(16, 12, Z));
    w.step(5);
    const reader = w.readers.of<DwarvesReader>('10');
    const before = w.game.world.entities.get(dwarf, C.Motion)?.speed ?? 0;
    const mood = (): number => w.readers.of<MoraleReader>('15').productivity(dwarf);
    expect(reader.productivity(dwarf)).toBe(mood());
    expect(reader.isTipsy(dwarf)).toBe(false);
    w.setNeed(dwarf, 'thirst', 90);
    w.until(() => w.events('DrankAlcohol').some((e) => e['id'] === dwarf), TICKS_PER_DAY);
    const drank = w.events('DrankAlcohol').find((e) => e['id'] === dwarf);
    expect(drank).toMatchObject({ group: 'spirits', aged: 0 });
    expect(w.readers.of<ItemsReader>('13').get(spirits.drink)?.count).toBe(19);
    const at = w.tick;
    expect(reader.isTipsy(dwarf)).toBe(true);
    expect(reader.productivity(dwarf)).toBe(Math.floor((mood() * (100 - TIPSY_SLOW_PERCENT)) / 100));
    w.step(2);
    const speed = w.game.world.entities.get(dwarf, C.Motion)?.speed ?? 0;
    expect(speed).toBeLessThan(before);
    expect(speed).toBeGreaterThanOrEqual(Math.floor((before * (100 - TIPSY_SLOW_PERCENT)) / 100) - 1);
    const thoughts = w.readers.of<MoraleReader>('15').thoughts(dwarf).map((t) => t.id);
    expect(thoughts).toContain('drank_strong_drink');
    expect(thoughts).not.toContain('drank_ale');
    // A save keeps the time; the dwarf is sober `TIPSY_TICKS` after the drink.
    const resumed = roundTrip(w.game).game;
    expect(resumed.world.readers.of<DwarvesReader>('10').isTipsy(dwarf)).toBe(true);
    w.step(at + TIPSY_TICKS - w.tick + 1);
    expect(reader.isTipsy(dwarf)).toBe(false);
    expect(reader.productivity(dwarf)).toBe(mood());
    expect(w.game.world.entities.get(dwarf, C.Motion)?.speed).toBe(before);
  }, 60_000);
});
