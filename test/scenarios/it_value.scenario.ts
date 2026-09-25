/**
 * `it_value` of `04-implementation/acceptance-tests.md` § 13 Items: "masterwork steel breastplate |
 * value 4,000" (`items.md` § Value examples: 40 × 20 × 5.0).
 */

import { expect } from 'vitest';
import type { ItemsReader } from '@systems/items';
import type { Scenario } from './runner';

let breastplate = 0;

const scenario: Scenario = {
  id: 'it_value',
  milestone: 2,
  seed: 'it-value',
  world: 'flat-test',
  setup: (w) => {
    breastplate = w.spawnItem('breastplate', 'steel', w.index(40, 40, 32), 1, 5);
  },
  run: (w) => {
    const items = w.readers.of<ItemsReader>('13');
    // First assertion: directly-constructed masterwork steel breastplate value check
    expect(items.get(breastplate)).toMatchObject({ quality: 5, count: 1 });
    expect(items.value(breastplate)).toBe(4000);

    // Second assertion: through the real workshop loop
    const forge = w.build('forge', w.index(15, 15, 32));
    const maker = w.spawnDwarf({ at: w.index(18, 16, 32), skills: { armorsmithing: 20 } });
    for (const labor of w.game.registry.table<{ id: string }>('labors').ids()) {
      if (labor !== 'smithing') {
        w.game.world.applyCommand({ type: 'SetLabor', dwarfId: maker, labor, on: false });
      }
    }

    for (let i = 0; i < 8; i += 1) {
      w.spawnItem('bar', 'steel', w.index(19, 18, 32), 5);
    }
    for (let i = 0; i < 2; i += 1) {
      w.spawnItem('charcoal_bar', 'charcoal', w.index(19, 18, 32), 5);
    }

    w.step(1);
    w.game.world.applyCommand({
      type: 'AddWorkOrder',
      workshopId: forge,
      order: { recipeId: 'forge_breastplate', mode: 'once', remaining: 10, priority: 5 },
    });

    w.until(() => {
      return w.events('ItemCrafted').some((e) => e['recipeId'] === 'forge_breastplate' && e['quality'] === 5);
    }, 20000);

    const crafted = w.events('ItemCrafted').find((e) => e['recipeId'] === 'forge_breastplate' && e['quality'] === 5);
    expect(crafted).toBeDefined();
    const craftedId = crafted?.['itemId'] as number;
    expect(items.get(craftedId)).toMatchObject({
      quality: 5,
      material: w.game.registry.table('materials').index('steel'),
    });
    expect(items.value(craftedId)).toBe(4000);
  },
};

export default scenario;
