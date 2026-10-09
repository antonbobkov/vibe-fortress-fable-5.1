import { describe, expect, it } from 'vitest';
import type { ItemsReader, ItemsSystem } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

function setup() {
  const w = new TestWorld({ seed: 'T-132-reserved-barrel', world: 'flat-test', embark: 'none' });
  const tile = w.index(40, 40, 32);
  const pile = w.zone('stockpile', [tile]);
  expect(
    w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: pile, filter: 'food' }).ok,
  ).toBe(true);
  const barrel = w.spawnItem('barrel', 'oak', tile);
  const food = w.spawnItem('plant_food', 'dimcap', w.index(42, 40, 32), 4);
  const system = w.game.world.scheduler.byId('13') as unknown as ItemsSystem;
  const items = w.readers.of<ItemsReader>('13');
  return { w, tile, pile, barrel, food, system, items };
}

describe('T-132 stockpile hauling respects a brewing barrel', () => {
  it('uses an unreserved barrel as a food slot', () => {
    const { pile, barrel, food, system } = setup();
    expect(system.stockpiles.findSlot(pile, food)).toMatchObject({ container: barrel });
  });

  it('does not select a barrel reserved as a workshop input', () => {
    const { w, pile, barrel, food, system } = setup();
    w.items.reserve(barrel, 900);
    expect(w.readers.of<ItemsReader>('13').get(barrel)?.reservedBy).toBe(900);
    expect(system.stockpiles.findSlot(pile, food)).toBeNull();
  });

  it('leaves an incoming haul on the ground when brewing reserved its destination meanwhile', () => {
    const { w, barrel, food, system, items } = setup();
    w.step(2);
    const job = w.readers.of<JobsReader>('11').byKey(`haul:${food}`);
    expect(job).toBeDefined();
    expect(job?.data['container']).toBe(barrel);
    w.items.reserve(barrel, 900);
    expect(w.readers.of<ItemsReader>('13').get(barrel)?.reservedBy).toBe(900);
    const stillTile = w.index(45, 40, 32);
    w.items.dropAt(barrel, stillTile);
    system.hauling.complete(job!);
    expect(items.containerOf(food)).toBe(0);
    expect(items.inContainer(barrel)).toEqual([]);
    expect(items.room(barrel)).toBe(20);
    expect(items.get(barrel)?.reservedBy).toBe(900);
    expect(system.stockpiles.reservations.size).toBe(0);
  });

  it('finishes brewing when a previously selected food haul arrives at its barrel', () => {
    const { w, barrel, food, system, items } = setup();
    const shop = w.build('still', w.index(45, 40, 32));
    const brewer = w.spawnDwarf({ at: w.index(44, 40, 32), skills: { brewing: 5 } });
    w.setLabor(brewer, 'hauling', false);
    w.spawnItem('plant_food', 'dimcap', w.index(45, 40, 32), 4);
    w.step(2);
    const jobs = w.readers.of<JobsReader>('11');
    const haul = jobs.byKey(`haul:${food}`);
    expect(haul?.data['container']).toBe(barrel);
    expect(
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: shop,
        order: { recipeId: 'brew', mode: 'once', remaining: 1 },
      }).ok,
    ).toBe(true);
    w.until(
      () =>
        jobs
          .list()
          .some(
            (j) =>
              j.target.ref === shop && j.inputs.some((input) => input.delivered.includes(barrel)),
          ),
      2000,
    );
    system.hauling.complete(haul!);
    w.until(() => w.events('ItemCrafted').some((e) => e['recipeId'] === 'brew'), 1000);
    expect(w.events('ItemCrafted').filter((e) => e['recipeId'] === 'brew')).toHaveLength(1);
    expect(items.count('drink')).toBe(20);
  });

  it('does not teleport a haul into a container that left its stockpile', () => {
    const { w, barrel, food, system, items } = setup();
    w.step(2);
    const job = w.readers.of<JobsReader>('11').byKey(`haul:${food}`);
    expect(job).toBeDefined();
    w.items.dropAt(barrel, w.index(45, 40, 32));
    system.hauling.complete(job!);
    expect(items.containerOf(food)).toBe(0);
    expect(items.inContainer(barrel)).toEqual([]);
  });
});
