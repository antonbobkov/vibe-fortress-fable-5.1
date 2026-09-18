/**
 * `wg_determinism` of `04-implementation/acceptance-tests.md` § 01 World generation:
 * "same seed twice | identical `WorldMap`".
 */

import { expect } from 'vitest';
import { WORLD_SIZE_STANDARD } from '@core/constants';
import { StateHasher } from '@core/serialize';
import { generate } from '@systems/worldgen';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'wg_determinism',
  milestone: 1,
  seed: 'wg-determinism',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    const a = generate(w.game.world.seed, WORLD_SIZE_STANDARD, w.game.registry);
    const b = generate(w.game.world.seed, WORLD_SIZE_STANDARD, w.game.registry);
    expect(b).toEqual(a);
    expect(new StateHasher().value(b).digest()).toBe(new StateHasher().value(a).digest());
    const other = generate(`${w.game.world.seed}-other`, WORLD_SIZE_STANDARD, w.game.registry);
    expect(other).not.toEqual(a);
  },
};

export default scenario;
