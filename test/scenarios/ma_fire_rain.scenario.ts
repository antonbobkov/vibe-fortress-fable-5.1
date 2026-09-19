/**
 * `ma_fire_rain` of `04-implementation/acceptance-tests.md` § 05 Materials: "same under `rain` | ≤ 10
 * tiles burn". 06 weather is T-M3-06, so the rain comes from a stand-in 06 whose reader answers
 * `rain` (D-036's pattern); T-M3-06 can swap in `TestWorld.forceWeather`.
 */

import { expect } from 'vitest';
import { FLAT_TEST_LAYERS, FLAT_TEST_SPEC, HeadlessGame } from '@app/headless';
import type { Scenario } from './runner';
import { burnedTiles, setupField, withWeather } from './fire-field';

const scenario: Scenario = {
  id: 'ma_fire_rain',
  milestone: 3,
  seed: 'ma-fire-rain',
  world: 'flat-test',
  embark: 'none',
  systems: () => withWeather(HeadlessGame.standardSystems(FLAT_TEST_SPEC, FLAT_TEST_LAYERS), 'rain'),
  setup: setupField,
  run: 3000,
  expect: (w) => {
    const burned = burnedTiles(w);
    expect(burned.size).toBeGreaterThanOrEqual(1);
    expect(burned.size).toBeLessThanOrEqual(10);
    expect(w.materials.fire.burning.size).toBe(0);
  },
};

export default scenario;
