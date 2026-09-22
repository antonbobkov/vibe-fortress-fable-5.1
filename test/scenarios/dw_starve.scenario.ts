import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import type { Scenario } from './runner';

/** `dw_starve` up to the daily `Starvation` event; 17 health resolves damage and death in M6. */
const scenario: Scenario = {
  id: 'dw_starve', milestone: 4, seed: 'dw-starve', world: 'flat-test', embark: 'none',
  run: (w) => {
    const id = w.spawnDwarf({ at: w.index(12, 12, FLAT_TEST_SURFACE_Z) });
    w.setNeed(id, 'hunger', 100);
    for (let day = 0; day < 8; day += 1) {
      w.setNeed(id, 'thirst', 0);
      w.step(TICKS_PER_DAY);
    }
    expect(w.events('Starving').some((e) => e['id'] === id && e['need'] === 'hunger')).toBe(true);
    expect(w.events('Starvation').some((e) => e['id'] === id)).toBe(true);
    expect(w.game.world.entities.alive(id)).toBe(true);
  },
};
export default scenario;
