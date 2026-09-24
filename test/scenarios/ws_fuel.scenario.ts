/** `acceptance-tests.md` ws_fuel; `12` § Fuel and charcoal. */
import { expect } from 'vitest';
import type { Scenario } from './runner';
import type { ItemsReader } from '@systems/items';

const scenario: Scenario = {
  id: 'ws_fuel', milestone: 5, seed: 'ws-fuel', world: 'flat-test', embark: 'none',
  run: (w) => {
    const smelter = w.build('smelter', w.index(15, 15, 32));
    const furnace = w.build('wood_furnace', w.index(23, 15, 32));
    w.spawnDwarf({ at: w.index(19, 18, 32), skills: { smelting: 6 } });
    w.spawnItem('ore', 'hematite', w.index(18, 17, 32));
    w.spawnItem('log', 'oak', w.index(27, 17, 32));
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: smelter,
      order: { recipeId: 'smelt_hematite', mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
    w.step(3);
    expect(w.events('WorkshopBlocked').some((e) => e['workshopId'] === smelter && e['reason'] === 'missing_input')).toBe(true);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: furnace,
      order: { recipeId: 'make_charcoal', mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
    const items = w.readers.of<ItemsReader>('13');
    w.until(() => items.count('charcoal_bar') >= 1, 1000);
    w.until(() => w.events('ItemCrafted').some((e) => e['recipeId'] === 'smelt_hematite'), 1500);
    const smelt = w.events('ItemCrafted').find((e) => e['recipeId'] === 'smelt_hematite');
    expect(items.get(smelt?.['itemId'] as number)?.count).toBe(2);
    expect(items.count('charcoal_bar')).toBe(0);
  },
};

export default scenario;
