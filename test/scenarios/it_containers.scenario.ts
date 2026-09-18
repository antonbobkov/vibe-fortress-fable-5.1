/**
 * `it_containers` of `04-implementation/acceptance-tests.md` § 13 Items: "drink stockpile with 0
 * barrels wanted | barrels of ale still accepted (they are containers); seeds need bags".
 *
 * Checked through 13's reader (`stockpileAccepts`, `findSlot`): the barrel of ale gets a tile of the
 * drink stockpile although no barrels are wanted; loose seeds in a seed stockpile are refused until
 * the stockpile wants bags (then a bag must be hauled in first) and go into a bag once one is there.
 */

import { expect } from 'vitest';
import type { ItemsReader } from '@systems/items';
import type { Scenario } from './runner';
import { rect } from './m1-helpers';

const Z = 32;

const scenario: Scenario = {
  id: 'it_containers',
  milestone: 2,
  seed: 'it-containers',
  world: 'flat-test',
  run: (w) => {
    w.step(1);
    const items = w.readers.of<ItemsReader>('13');
    const drinkPile = w.zone('stockpile', rect(w, 20, 20, Z, 4, 4));
    expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: drinkPile, filter: 'drink' })).toEqual({ ok: true });
    expect(items.stockpile(drinkPile)?.containersWanted.barrel).toBe(0);
    const barrel = w.spawnItem('barrel', 'oak', w.index(40, 40, Z));
    w.spawnItem('drink', 'dimcap_ale', { containerId: barrel }, 20);
    expect(items.stockpileAccepts(drinkPile, barrel)).toBe(true);
    expect(items.findSlot(drinkPile, barrel)).toMatchObject({ tile: w.index(20, 20, Z), container: 0 });

    const seedPile = w.zone('stockpile', rect(w, 30, 20, Z, 4, 4));
    w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: seedPile, filter: 'seeds' });
    const seeds = w.spawnItem('seed', 'barley', w.index(41, 40, Z), 12);
    expect(items.stockpileAccepts(seedPile, seeds)).toBe(true);
    expect(items.findSlot(seedPile, seeds)).toBeNull();
    w.game.world.applyCommand({ type: 'SetStockpileContainers', zoneId: seedPile, wants: { bag: 1 } });
    expect(items.findSlot(seedPile, seeds)).toEqual({ needContainer: 'bag' });
    const bag = w.spawnItem('bag', 'flax_cloth', w.index(31, 21, Z));
    expect(items.findSlot(seedPile, seeds)).toMatchObject({ container: bag, tile: w.index(31, 21, Z) });
    w.step(10);
  },
};

export default scenario;
