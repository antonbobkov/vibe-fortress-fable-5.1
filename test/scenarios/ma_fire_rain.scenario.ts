/**
 * `ma_fire_rain` of `04-implementation/acceptance-tests.md` § 05 Materials: "same under `rain` | ≤ 10
 * tiles burn". The rain is 06's, held with `TestWorld.forceWeather` (T-M3-06).
 */

import { expect } from 'vitest';
import type { Scenario } from './runner';
import { burnedTiles, setupField } from './fire-field';

const scenario: Scenario = {
  id: 'ma_fire_rain',
  milestone: 3,
  seed: 'ma-fire-rain',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    setupField(w);
    w.forceWeather('rain');
  },
  run: 3000,
  expect: (w) => {
    const burned = burnedTiles(w);
    expect(burned.size).toBeGreaterThanOrEqual(1);
    expect(burned.size).toBeLessThanOrEqual(10);
    expect(w.materials.fire.burning.size).toBe(0);
  },
};

export default scenario;
