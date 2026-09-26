/**
 * `he_bleed` of `04-implementation/acceptance-tests.md` § 17 Health:
 * "a dwarf with Toughness 50 and a serious cut on the torso, no treatment |
 * unconscious at 600 ± 10 ticks; dead at 800 ± 10 ticks".
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'he_bleed',
  milestone: 6,
  seed: 'he-bleed',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    const at = w.index(40, 40, FLAT_TEST_SURFACE_Z);
    const id = w.spawnDwarf({ at });
    const attrs = w.game.world.entities.get(id, C.Attributes);
    if (attrs) w.game.world.entities.add(id, C.Attributes, { ...attrs, tou: 50 });

    const body = w.game.world.entities.get(id, C.Body);
    if (body) {
      body.maxBlood = 600;
      body.blood = 600;
    }

    // Torso maxHp = 60. Serious cut: 20 damage (ratio = 20/60 = 0.333 in [0.2, 0.5)).
    w.game.world.emit({
      type: 'DamageDealt',
      defenderId: id,
      part: 'torso',
      damageType: 'edge',
      amount: 20,
      attackerId: 0,
    });

    // Step until unconscious
    w.until((v) => v.events('CreatureUnconscious').some((e) => e['id'] === id), 700);
    const unconTick = w.tick;
    expect(unconTick).toBeGreaterThanOrEqual(590);
    expect(unconTick).toBeLessThanOrEqual(610);

    // Step until dead
    w.until(
      (v) => v.events('CreatureDied').some((e) => e['id'] === id && e['cause'] === 'bled_out'),
      900,
    );
    const deathTick = w.tick;
    expect(deathTick).toBeGreaterThanOrEqual(790);
    expect(deathTick).toBeLessThanOrEqual(810);
  },
};

export default scenario;
