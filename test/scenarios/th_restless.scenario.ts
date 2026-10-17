/**
 * `th_restless` of `04-implementation/acceptance-tests.md` § 18 Threats:
 * "old_battlefield, autumn night | RestlessRose; all collapse at dawn"
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';

const scenario: Scenario = {
  id: 'th_restless',
  milestone: 6,
  seed: 'th-restless',
  world: {
    region: { traits: ['old_battlefield'], temper: 2 },
  },
  embark: 'none',
  // Autumn day 1, 17:00 (one hour before dusk)
  startTick: 56 * TICKS_PER_DAY + 17 * TICKS_PER_HOUR,
  setup: (w: TestWorld) => {
    // Spawn a dwarf so there is a fortress creature target
    w.spawnDwarf({ at: w.index(24, 24, FLAT_TEST_SURFACE_Z) });
  },
  run: (w: TestWorld) => {
    // Step through dusk (17:00 -> 20:00)
    w.step(3 * TICKS_PER_HOUR);

    const roseEvents = w.events('RestlessRose');
    expect(roseEvents.length).toBeGreaterThanOrEqual(1);
    const count = roseEvents[0]?.['count'] as number;
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(8);

    // Living restless dead on map
    const restless = w.game.world.entities
      .with(C.Hostile)
      .filter((id) => w.game.world.entities.get(id, C.Hostile)?.role === 'restless');
    expect(restless.length).toBe(count);

    // Step through the night to dawn (20:00 -> 10:00 next day)
    w.step(14 * TICKS_PER_HOUR);

    // All restless dead have collapsed
    const remaining = w.game.world.entities
      .with(C.Hostile)
      .filter(
        (id) =>
          w.game.world.entities.alive(id) &&
          w.game.world.entities.get(id, C.Hostile)?.role === 'restless',
      );
    expect(remaining.length).toBe(0);

    const died = w.events('CreatureDied').filter((e) => e['species'] === 'restless_dead');
    expect(died.length).toBe(count);
  },
};

export default scenario;
