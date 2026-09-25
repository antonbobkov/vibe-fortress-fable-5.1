import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import type { Scenario } from './runner';

/** Seven civilians consume the stocked food and drink over three days. */
const scenario: Scenario = {
  id: 'dw_needs', milestone: 4, seed: 'dw-needs', world: 'flat-test', embark: 'none',
  setup: (w) => {
    const tile = w.index(12, 12, FLAT_TEST_SURFACE_Z);
    w.zone('stockpile', [tile]);
    for (let i = 0; i < 7; i += 1) w.spawnDwarf({ at: w.index(12 + i, 12, FLAT_TEST_SURFACE_Z) });
    w.spawnItem('plant_food', 'dimcap', tile, 40);
    w.spawnItem('drink', 'ale', tile, 70);
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
