import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'an_starve', milestone: 4, seed: 'an-starve', world: 'flat-test', embark: 'none',
  run: (w) => {
    const id = w.spawnTame('cow', w.index(8, 8, FLAT_TEST_SURFACE_Z));
    w.until((v) => v.events('AnimalStarving').some((e) => e['id'] === id), 4 * TICKS_PER_DAY);
    expect(w.tick).toBeLessThanOrEqual(3 * TICKS_PER_DAY);
    expect(w.game.world.entities.get(id, C.Tame)?.condition).toBe(100);
    const starvingTick = w.tick;
    w.until((v) => v.events('CreatureDied').some((e) => e['id'] === id), 11 * TICKS_PER_DAY);
    expect(w.tick - starvingTick).toBeGreaterThanOrEqual(10 * TICKS_PER_DAY);
    expect(w.game.world.entities.alive(id)).toBe(false);
  },
};
export default scenario;
