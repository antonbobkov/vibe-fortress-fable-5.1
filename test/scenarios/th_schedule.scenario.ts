/**
 * `th_schedule` of `04-implementation/acceptance-tests.md` § 18 Threats:
 * "peril 1 region, 3 years | no raid before autumn year 2; `size` 5–12 (the captain is added on top)"
 */

import { expect } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_YEAR } from '@core/constants';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';

const scenario: Scenario = {
  id: 'th_schedule',
  milestone: 6,
  seed: 'th-schedule',
  world: { region: { peril: 1 } },
  embark: 'none',
  run: (w: TestWorld) => {
    // T-175: ended parties expire after one day; observe their composition while arriving.
    const arrivedParties = new Map<number, { members: number[]; leaderId: number }>();
    w.game.world.onEvents((batch) => {
      for (const event of batch) {
        if (event.type !== 'HostileSpawned') continue;
        const party = w.game.world.entities.get(event['partyId'] as number, C.Party);
        if (party?.purpose === 'raid') arrivedParties.set(event['partyId'] as number, { members: [...party.members], leaderId: party.leaderId });
      }
    });
    const autumnYear2Tick = (112 + 56) * TICKS_PER_DAY; // Day 168

    // Step up to autumn year 2: no raids allowed before this point
    w.step(autumnYear2Tick);
    expect(w.events('RaidArrived').filter((e) => e['kind'] === 'raid')).toHaveLength(0);

    // Step the remainder of the 3 years
    w.step(3 * TICKS_PER_YEAR - autumnYear2Tick);

    const raidEvents = w.events('RaidArrived').filter((e) => e['kind'] === 'raid');
    expect(raidEvents.length).toBeGreaterThan(0);

    for (const event of raidEvents) {
      const size = event['size'] as number;
      const partyId = event['partyId'] as number;

      // Size is between 5 and 12
      expect(size).toBeGreaterThanOrEqual(5);
      expect(size).toBeLessThanOrEqual(12);

      // Captain added on top: total members = size + 1
      const party = arrivedParties.get(partyId);
      expect(party).toBeDefined();
      expect(party?.members.length).toBe(size + 1);
      expect(party?.leaderId).toBeGreaterThan(0);
    }
  },
};

export default scenario;
