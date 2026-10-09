import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import type { WorkshopsReader } from '@systems/workshops';
import { outputFilter } from '@systems/workshops/operate';
import { TestWorld } from '../scenarios/test-world';

function setup() {
  const w = new TestWorld({ seed: 't174-save', world: 'flat-test', embark: 'none' });
  const forge = w.build('forge', w.index(15, 22, 32), 'granite');
  w.step(1);
  return { w, forge, orders: w.readers.of<WorkshopsReader>('12') };
}
function add(w: TestWorld, workshopId: number, materialFilter: unknown) {
  return w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId,
    order: { recipeId: 'forge_pick', mode: 'once', remaining: 2, materialFilter } });
}

describe('T-174 material filters have one in-memory form', () => {
  it('the report forge-order probe hashes equally before its first and second loads', () => {
    const { w, forge } = setup();
    expect(add(w, forge, 'iron')).toEqual({ ok: true });
    w.step(1);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.game.hash());
    expect(roundTrip(loaded).game.hash()).toBe(loaded.hash());
    for (let i = 0; i < 50; i += 1) {
      w.step(1); loaded.step(1);
      expect(loaded.hash()).toBe(w.game.hash());
    }
  });
  it.each([false, true])('normalizes both adding and editing, global=%s', (global) => {
    const { w, forge, orders } = setup();
    const workshopId = global ? 0 : forge;
    const get = () => global ? orders.globalOrders()[0]! : orders.ordersOf(forge)[0]!;
    expect(add(w, workshopId, 'iron')).toEqual({ ok: true });
    expect(get().materialFilter).toBe(w.game.registry.table('materials').index('iron'));
    expect(w.game.world.applyCommand({ type: 'EditWorkOrder', workshopId, index: 0, patch: { materialFilter: 'copper' } })).toEqual({ ok: true });
    expect(get().materialFilter).toBe(w.game.registry.table('materials').index('copper'));
    expect(roundTrip(w.game).game.hash()).toBe(w.game.hash());
  });
  it.each(['metal', null, 'index'] as const)('preserves %s and its save', (filter) => {
    const { w, forge, orders } = setup();
    const value = filter === 'index' ? w.game.registry.table('materials').index('iron') : filter;
    expect(add(w, forge, value)).toEqual({ ok: true });
    expect(orders.ordersOf(forge)[0]!.materialFilter).toBe(value);
    expect(roundTrip(w.game).game.hash()).toBe(w.game.hash());
  });
  it.each(['no_such_material', 'any', '', 0, -1, 0.5, 999999, NaN, Infinity, false, [], {}].map((filter) => [filter]))('rejects malformed material %j without changing an order or job', (filter) => {
    const { w, forge } = setup();
    expect(add(w, forge, null)).toEqual({ ok: true });
    const before = w.game.hash();
    expect(add(w, forge, filter)).toEqual({ ok: false, reason: 'bad_setting' });
    expect(w.game.hash()).toBe(before);
    expect(w.game.world.applyCommand({ type: 'EditWorkOrder', workshopId: forge, index: 0, patch: { materialFilter: filter } })).toEqual({ ok: false, reason: 'bad_setting' });
    expect(w.game.hash()).toBe(before);
  });
  it('a normalized brewable plant still counts its drink output for a maintain order', () => {
    const { w, orders } = setup();
    const materials = w.game.registry.table('materials');
    const recipe = orders.recipe('brew')!;
    const filter = outputFilter(w.game.registry, recipe, { recipe: w.game.registry.table('recipes').index('brew'),
      remaining: 1, mode: 'maintain', threshold: 10, priority: 5, materialFilter: materials.index('dimcap') });
    expect(filter.materialId).toBe(materials.index('dimcap_ale'));
    const drink = w.spawnItem('drink', 'dimcap_ale', w.index(10, 10, 32), 10);
    expect(w.game.world.entities.get(drink, C.Item)?.material).toBe(filter.materialId);
  });
});
