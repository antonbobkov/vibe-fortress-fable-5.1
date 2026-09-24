/** `acceptance-tests.md` ws_steel; `12` § Fuel and charcoal, `minerals-and-metals.md` § Flux. */
import { expect } from 'vitest';
import type { Scenario } from './runner';
import type { ItemsReader } from '@systems/items';

const scenario: Scenario = {
  id: 'ws_steel', milestone: 5, seed: 'ws-steel', world: 'flat-test', embark: 'none',
  run: (w) => {
    const smelter = w.build('smelter', w.index(15, 15, 32));
    w.spawnDwarf({ at: w.index(18, 18, 32), skills: { smelting: 8 } });
    w.spawnItem('bar', 'iron', w.index(18, 17, 32));
    w.spawnItem('raw_stone', 'limestone', w.index(19, 17, 32));
    w.spawnItem('charcoal_bar', 'charcoal', w.index(19, 18, 32), 2);
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: smelter,
      order: { recipeId: 'alloy_steel', mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
    const items = w.readers.of<ItemsReader>('13');
    w.until(() => w.events('ItemCrafted').some((e) => e['recipeId'] === 'alloy_steel'), 1500);
    const event = w.events('ItemCrafted').find((e) => e['recipeId'] === 'alloy_steel');
    const steel = items.get(event?.['itemId'] as number);
    expect(steel?.type).toBe(w.game.registry.table('items').index('bar'));
    expect(steel?.material).toBe(w.game.registry.table('materials').index('steel'));
    expect(steel?.count).toBe(1);
    expect(items.count('charcoal_bar')).toBe(0);
  },
};

export default scenario;
