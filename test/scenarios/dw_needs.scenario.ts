import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import type { Scenario } from './runner';

/** The stock is ready; T-M4-06 adds the eat and drink activities the acceptance row requires. */
const scenario: Scenario = {
  id: 'dw_needs', milestone: 4, seed: 'dw-needs', world: 'flat-test', embark: 'none',
  todo: 'T-M4-06',
  setup: (w) => {
    const tile = w.index(12, 12, FLAT_TEST_SURFACE_Z);
    for (let i = 0; i < 7; i += 1) w.spawnDwarf({ at: w.index(12 + i, 12, FLAT_TEST_SURFACE_Z) });
    w.spawnItem('plant_food', 'dimcap', tile, 40);
    w.spawnItem('drink', 'ale', tile, 70);
  },
  run: 3 * TICKS_PER_DAY,
  expect: (w) => {
    for (const id of w.dwarves.reader().list()) {
      const eaten = w.events('MealEaten').filter((e) => e['id'] === id).length;
      const drank = w.events('DrankAlcohol').filter((e) => e['id'] === id).length;
      expect(eaten).toBeGreaterThanOrEqual(3);
      expect(eaten).toBeLessThanOrEqual(5);
      expect(drank).toBeGreaterThanOrEqual(6);
      expect(drank).toBeLessThanOrEqual(8);
      for (const need of ['hunger', 'thirst'] as const) expect(w.dwarves.reader().need(id, need)).toBeLessThan(100);
    }
  },
};
export default scenario;
