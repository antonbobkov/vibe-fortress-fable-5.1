/**
 * `th_thief` of `04-implementation/acceptance-tests.md` § 18 Threats:
 * "snatcher, unattended barrel outdoors, no dogs | ThiefEscaped within a day;
 * with a war-trained dog within 10 tiles: ThiefSpotted before pickup ≥ 80% of runs"
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import { arriveParty } from '@systems/threats';
import type { Scenario } from './runner';
import { TestWorld } from './test-world';

let barrelId = 0;

const scenario: Scenario = {
  id: 'th_thief',
  milestone: 6,
  seed: 'th-thief',
  world: 'flat-test',
  embark: 'none',
  setup: (w: TestWorld) => {
    const z = FLAT_TEST_SURFACE_Z;
    const barrelTile = w.index(24, 15, z);

    // Spawn an unattended barrel outdoors
    barrelId = w.spawnItem('barrel', 'granite', barrelTile);

    // Arrive snatcher at north edge with no dogs
    arriveParty(
      w.game.world,
      w.game.registry,
      w.game.world.rngFor('18'),
      'thief',
      'gloam',
      1,
      'n',
      w.tick,
      0,
      2,
      false,
    );
  },
  run: (w: TestWorld) => {
    // Part 1: No dogs -> snatcher picks up barrel and escapes within a day (1200 ticks)
    w.until((world) => world.events('ThiefEscaped').length > 0, TICKS_PER_DAY);

    const thiefEscaped = w.events('ThiefEscaped').find((e) => e['itemId'] === barrelId);
    expect(thiefEscaped).toBeDefined();

    // Part 2: Statistical trial with dog within 10 tiles -> ThiefSpotted before pickup in >= 80% of runs
    const trials = 10;
    let spottedBeforePickupCount = 0;

    for (let i = 0; i < trials; i++) {
      const trialWorld = new TestWorld({
        world: 'flat-test',
        seed: `th-thief-dog-${i}`,
      });
      const z = FLAT_TEST_SURFACE_Z;
      const bTile = trialWorld.index(24, 15, z);
      const bId = trialWorld.spawnItem('barrel', 'granite', bTile);

      // Spawn a tame dog at (25, 8), which is within 10 tiles of the approach path
      const dogTile = trialWorld.index(25, 8, z);
      // T-185: the guard in this trial is explicitly trained; untrained livestock do not spot.
      trialWorld.spawnTame('dog', dogTile, { trained: 'war' });

      // Arrive snatcher at north edge (24, 0)
      arriveParty(
        trialWorld.game.world,
        trialWorld.game.registry,
        trialWorld.game.world.rngFor('18'),
        'thief',
        'gloam',
        1,
        'n',
        trialWorld.tick,
        0,
        2,
        false,
      );

      // Step until either ThiefSpotted or ThiefEscaped
      let spotted = false;
      let escaped = false;
      for (let t = 0; t < 600; t++) {
        trialWorld.step(1);
        if (trialWorld.events('ThiefSpotted').length > 0) {
          spotted = true;
          break;
        }
        if (trialWorld.events('ThiefEscaped').some((e) => e['itemId'] === bId)) {
          escaped = true;
          break;
        }
      }

      if (spotted && !escaped) {
        spottedBeforePickupCount++;
      }
    }

    const rate = spottedBeforePickupCount / trials;
    expect(rate).toBeGreaterThanOrEqual(0.8);
  },
};

export default scenario;
