/**
 * `it_wealth` of `04-implementation/acceptance-tests.md` § 13 Items: "craft 10 common granite
 * tables | wealth rises by 80 (2 × 4 × 10)".
 */

import { expect } from 'vitest';
import type { ItemsReader } from '@systems/items';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'it_wealth',
  milestone: 2,
  seed: 'it-wealth',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    w.step(20);
    const items = w.readers.of<ItemsReader>('13');
    const before = items.wealth();
    expect(w.game.world.fortress.wealthCached).toBe(before);
    for (let k = 0; k < 10; k += 1) w.spawnItem('table', 'granite', w.index(40 + k, 40, 32), 1, 1);
    expect(items.wealth() - before).toBe(80);
    w.step(10);
    expect(w.game.world.fortress.wealthCached - before).toBe(80);

    const mason = w.build('mason', w.index(15, 15, 32));
    w.spawnDwarf({ at: w.index(18, 16, 32), skills: { masonry: 0 } });

    const craftedBefore = items.wealth();
    for (let n = 0; n < 10; n += 1) {
      w.spawnItem('raw_stone', 'granite', w.index(19, 18, 32), 1);
    }

    w.step(1);
    w.game.world.applyCommand({
      type: 'AddWorkOrder',
      workshopId: mason,
      order: { recipeId: 'make_table_stone', mode: 'once', remaining: 10, priority: 5 },
    });

    w.until(() => w.events('ItemCrafted').filter((e) => e['recipeId'] === 'make_table_stone').length >= 10, 10000);

    const crafted = w.events('ItemCrafted').filter((e) => e['recipeId'] === 'make_table_stone');
    expect(crafted).toHaveLength(10);
    const craftedValue = crafted.reduce((sum, e) => sum + items.value(e['itemId'] as number), 0);
    expect(items.wealth() - craftedBefore).toBe(craftedValue);
    if (crafted.every((e) => items.get(e['itemId'] as number)?.quality === 1)) {
      expect(items.wealth() - craftedBefore).toBe(80);
    }
  },
};

export default scenario;
