/**
 * `ma_fire_spread` of `04-implementation/acceptance-tests.md` § 05 Materials: "ignite a grass tile
 * in a 10×10 dry grass field, clear weather | ≥ 60 tiles burn within 3,000 ticks; all end `Ash`; no
 * spread onto stone". The clear weather is held with `forceWeather` (T-M3-06).
 */

import { expect } from 'vitest';
import { TileFlag } from '@core/map3d';
import type { Scenario } from './runner';
import { burnedTiles, ringTiles, setupField } from './fire-field';

const scenario: Scenario = {
  id: 'ma_fire_spread',
  milestone: 3,
  seed: 'ma-fire-spread',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    setupField(w);
    w.forceWeather('clear');
  },
  run: 3000,
  expect: (w) => {
    const burned = burnedTiles(w);
    expect(burned.size).toBeGreaterThanOrEqual(60);
    expect(w.materials.fire.burning.size).toBe(0);
    for (const t of burned) {
      expect(w.map.hasFlag(t, TileFlag.Ash)).toBe(true);
      expect(w.map.hasFlag(t, TileFlag.Grass)).toBe(false);
      expect(w.map.hasFlag(t, TileFlag.Burning)).toBe(false);
    }
    for (const t of ringTiles(w)) expect(burned.has(t)).toBe(false);
  },
};

export default scenario;
