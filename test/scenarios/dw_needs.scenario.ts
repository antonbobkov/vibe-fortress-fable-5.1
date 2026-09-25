import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import type { Scenario } from './runner';

/** Seven civilians consume the stocked food and drink over three days. */
const scenario: Scenario = {
  id: 'dw_needs', milestone: 4, seed: 'dw-needs', world: 'flat-test', embark: 'none',
  setup: (w) => {
    const tile = w.index(12, 12, FLAT_TEST_SURFACE_Z);
    const pile = w.zone('stockpile', [tile]);
    w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: pile, filter: 'drink' });
    for (let i = 0; i < 7; i += 1) w.spawnDwarf({ at: w.index(12 + i, 12, FLAT_TEST_SURFACE_Z) });
    w.spawnItem('plant_food', 'dimcap', tile, 40);
    const b1 = w.spawnItem('barrel', 'pine', tile);
    const b2 = w.spawnItem('barrel', 'pine', tile);
    const b3 = w.spawnItem('barrel', 'pine', tile);
    const b4 = w.spawnItem('barrel', 'pine', tile);
    w.spawnItem('drink', 'ale', { containerId: b1 }, 20);
    w.spawnItem('drink', 'ale', { containerId: b2 }, 20);
    w.spawnItem('drink', 'ale', { containerId: b3 }, 20);
    w.spawnItem('drink', 'ale', { containerId: b4 }, 10);
  },
  run: 3 * TICKS_PER_DAY,
  expect: (w) => {
    for (const id of w.dwarves.reader().list()) {
      const eaten = w.events('MealEaten').filter((e) => e['id'] === id).length;
      const drank = w.events('DrankAlcohol').filter((e) => e['id'] === id).length;
      expect(eaten).toBeGreaterThanOrEqual(1);
      expect(eaten).toBeLessThanOrEqual(2);
      expect(drank).toBeGreaterThanOrEqual(2);
      expect(drank).toBeLessThanOrEqual(3);
      for (const need of ['hunger', 'thirst'] as const) expect(w.dwarves.reader().need(id, need)).toBeLessThan(100);
    }
  },
};
export default scenario;
