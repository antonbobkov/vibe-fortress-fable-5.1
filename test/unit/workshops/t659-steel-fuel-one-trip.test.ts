import { describe, expect, it } from 'vitest';
import type { ItemsReader } from '@systems/items';
import type { JobsSystem } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

/**
 * T-659 (12 § Fuel): a recipe that takes fuel into its product (steel's carbon) asks for the bar its
 * job burns with it, one input of two units, so one stack of two comes in one trip; a half fuel is
 * never steel's carbon and stays an input of its own.
 */
function steel(seed: string, fuel: { type: string; material: string; x: number; count: number }[]) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const smelter = w.build('smelter', w.index(15, 15, 32));
  const dwarf = w.spawnDwarf({ at: w.index(18, 18, 32), skills: { smelting: 8 } });
  w.spawnItem('bar', 'iron', w.index(18, 17, 32));
  w.spawnItem('raw_stone', 'limestone', w.index(19, 17, 32));
  for (const f of fuel) w.spawnItem(f.type, f.material, w.index(f.x, 18, 32), f.count);
  w.step(1);
  expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: smelter,
    order: { recipeId: 'alloy_steel', mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
  const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
  const job = (): ReturnType<typeof board.jobs.get> => [...board.jobs.values()].find((j) => j.target.ref === smelter);
  w.until(() => job() !== undefined, 50);
  const inputs = job()!.inputs.map((i) => ({ filter: i.filter, count: i.count }));
  // The trips: each time the worker takes an item in hand.
  let trips = 0;
  let held = 0;
  const items = w.readers.of<ItemsReader>('13');
  w.until(() => {
    const carrying = board.workerOf(dwarf).carrying;
    if (carrying !== 0 && carrying !== held) trips += 1;
    held = carrying;
    return w.events('ItemCrafted').some((e) => e['recipeId'] === 'alloy_steel');
  }, 3000);
  return { inputs, trips, items, w };
}

describe('T-659 the steel\'s two fuels in one trip', () => {
  it('asks for the carbon and the burned bar as one input of two, fetched as one stack', () => {
    const r = steel('t659-one-stack', [{ type: 'charcoal_bar', material: 'charcoal', x: 19, count: 2 }]);
    expect(r.inputs).toHaveLength(3);
    expect(r.inputs[2]).toEqual({ filter: { tag: 'fuel' }, count: 2 });
    expect(r.trips).toBe(3);
    expect(r.items.count('charcoal_bar')).toBe(0);
    const steelBar = r.w.events('ItemCrafted').find((e) => e['recipeId'] === 'alloy_steel');
    expect(r.items.get(steelBar?.['itemId'] as number)?.count).toBe(1);
  });

  it('takes the two bars from two stacks when no stack holds two, and burns both', () => {
    const r = steel('t659-two-stacks', [{ type: 'charcoal_bar', material: 'charcoal', x: 19, count: 1 },
      { type: 'coal_bar', material: 'coal', x: 20, count: 1 }]);
    expect(r.inputs[2]).toEqual({ filter: { tag: 'fuel' }, count: 2 });
    expect(r.trips).toBe(4);
    expect(r.items.count('charcoal_bar') + r.items.count('coal_bar')).toBe(0);
  });

  it('leaves the third bar of a stack of three by the smelter', () => {
    const r = steel('t659-stack-of-three', [{ type: 'charcoal_bar', material: 'charcoal', x: 19, count: 3 }]);
    expect(r.trips).toBe(3);
    expect(r.items.count('charcoal_bar')).toBe(1);
  });

  it('keeps a half fuel apart from the carbon: one bar into the steel and two peat bricks burned', () => {
    const r = steel('t659-half-fuel', [{ type: 'charcoal_bar', material: 'charcoal', x: 19, count: 1 },
      { type: 'peat_brick', material: 'peat', x: 20, count: 2 }]);
    expect(r.inputs).toHaveLength(4);
    expect(r.inputs[2]).toEqual({ filter: { tag: 'fuel' }, count: 1 });
    expect(r.inputs[3]).toEqual({ filter: { tag: 'fuel_half' }, count: 2 });
    expect(r.items.count('charcoal_bar')).toBe(0);
    expect(r.items.count('peat_brick')).toBe(0);
  });
});
