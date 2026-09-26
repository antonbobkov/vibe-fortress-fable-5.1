/**
 * `he_limb` of `04-implementation/acceptance-tests.md` § 17 Health:
 * "60 damage to an arm (maxHp 36) | LimbLost; cannot wield two-handed".
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { HealthReader } from '@systems/health';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'he_limb',
  milestone: 6,
  seed: 'he-limb',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    const at = w.index(40, 40, FLAT_TEST_SURFACE_Z);
    const id = w.spawnDwarf({ at });

    // Arm maxHp is 36. 60 damage destroys it.
    w.game.world.emit({
      type: 'DamageDealt',
      defenderId: id,
      part: 'left_arm',
      damageType: 'edge',
      amount: 60,
      attackerId: 0,
    });

    w.step(5);
    expect(w.events('LimbLost').some((e) => e['id'] === id && e['part'] === 'left_arm')).toBe(true);

    const health = w.readers.of<HealthReader>('17');
    expect(health.canWield(id, 2)).toBe(false);
    expect(health.canWield(id, 1)).toBe(true);
  },
};

export default scenario;
