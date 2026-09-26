/**
 * `an_predator` of `04-implementation/acceptance-tests.md` § 08 Animals / 16 Combat:
 * "wolf pack near unarmed dwarves, `beastwood` | ≥ 1 attack within a day;
 * wolves flee below their species `flee` percent (45; `FLEE_BLOOD_PERCENT` is only the default)"
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { AnimalsReader } from '@systems/animals';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';

let wolf = 0;
let dwarf = 0;

const scenario: Scenario = {
  id: 'an_predator',
  milestone: 6,
  seed: 'an-predator',
  world: {
    region: { traits: ['beastwood'], biome: 'taiga' },
  },
  embark: 'none',
  setup: (w: TestWorld) => {
    // Unarmed dwarf
    dwarf = w.spawnDwarf({ at: w.index(40, 48, FLAT_TEST_SURFACE_Z) });
    // Hungry wolf near the dwarf (within perception radius 12)
    wolf = w.spawnCreature('wolf', w.index(45, 48, FLAT_TEST_SURFACE_Z), 'wild');
    const wild = w.game.world.entities.get(wolf, C.Wild);
    if (wild !== undefined) {
      w.game.world.entities.add(wolf, C.Wild, { ...wild, hungry: true });
    }
  },
  run: (w: TestWorld) => {
    expect(w.game.world.entities.alive(dwarf)).toBe(true);
    const animals = w.readers.of<AnimalsReader>('08');
    expect(animals.isWild(wolf)).toBe(true);

    // ≥ 1 attack within 1 day (1200 ticks)
    w.until((world) => world.events('AttackResolved').length >= 1, 1200);
    expect(w.events('AttackResolved').length).toBeGreaterThanOrEqual(1);

    // Wolf flees below its species flee percent (45)
    const body = w.game.world.entities.get(wolf, C.Body);
    expect(body).toBeDefined();
    if (body) {
      // Set blood to 40% of maxBlood (< 45%)
      const reducedBlood = Math.floor((body.maxBlood * 40) / 100);
      w.game.world.entities.add(wolf, C.Body, { ...body, blood: reducedBlood });
    }

    // Advance ticks to let wolf react and flee
    w.until((world) => world.events('CreatureFled').length >= 1, 20);
    expect(w.events('CreatureFled').length).toBeGreaterThanOrEqual(1);
    expect(animals.state(wolf)).toBe('flee');
  },
};

export default scenario;
