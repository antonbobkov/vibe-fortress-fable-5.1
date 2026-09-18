/**
 * `wg_ratings` of `04-implementation/acceptance-tests.md` § 01 World generation:
 * "any seed | all ratings in 0–4; `serene_vale` regions have peril 0; no traits on ocean or glacier".
 */

import { expect } from 'vitest';
import { RATING_MAX, WORLD_SIZE_STANDARD } from '@core/constants';
import { generate } from '@systems/worldgen';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'wg_ratings',
  milestone: 1,
  seed: 'wg-ratings',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    let traited = 0;
    for (const seed of [w.game.world.seed, 'wg-ratings-2', 'wg-ratings-3']) {
      const world = generate(seed, WORLD_SIZE_STANDARD, w.game.registry);
      for (const r of world.regions) {
        for (const v of [r.wealth, r.peril, r.temper]) {
          expect(Number.isInteger(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(RATING_MAX);
        }
        if (r.traits.includes('serene_vale')) expect(r.peril).toBe(0);
        if (r.biome === 'ocean' || r.biome === 'glacier') expect(r.traits).toEqual([]);
        if (r.traits.length > 0) traited += 1;
      }
    }
    expect(traited).toBeGreaterThan(0);
  },
};

export default scenario;
