/**
 * `th_loiter` of `04-implementation/acceptance-tests.md` § 18 Threats:
 * "raid with the gate up | party loiters; RaidEnded { withdrew } after 2 days"
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import { arriveParty } from '@systems/threats';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';

let partyId = 0;

const scenario: Scenario = {
  id: 'th_loiter',
  milestone: 6,
  seed: 'th-loiter',
  world: 'flat-test',
  embark: 'none',
  setup: (w: TestWorld) => {
    const z = FLAT_TEST_SURFACE_Z;
    const center = w.index(24, 24, z);

    // Build the hearth at center
    w.build('hearth', center, 'granite');

    // Seal off the hearth in a ring of solid walls (gate up / sealed perimeter)
    // from x: 20..28, y: 20..28
    for (let x = 20; x <= 28; x++) {
      for (let y = 20; y <= 28; y++) {
        if (x === 20 || x === 28 || y === 20 || y === 28) {
          const t = w.index(x, y, z);
          w.carve(t, TileKind.Wall);
          w.setBuildingBlock(t, true);
        }
      }
    }

    // Arrive raid party at north edge
    const result = arriveParty(
      w.game.world,
      w.game.registry,
      w.game.world.rngFor('18'),
      'raid',
      'gloam',
      2,
      'n',
      w.tick,
      0,
      2,
      false,
    );
    partyId = result.partyId;
  },
  run: (w: TestWorld) => {
    // 1. Leader approaches nearest reachable tile outside the sealed perimeter
    // and transitions to 'loiter'
    w.until((world) => {
      const p = world.game.world.entities.get(partyId, C.Party);
      return p?.state === 'loiter';
    }, 1000);

    const party = w.game.world.entities.get(partyId, C.Party);
    expect(party?.state).toBe('loiter');

    // 2. Party loiters for 2 days (2400 ticks), then retreats to edge and despawns
    w.until((world) => world.events('RaidEnded').some((e) => e['partyId'] === partyId), 3500);

    const raidEnded = w.events('RaidEnded').find((e) => e['partyId'] === partyId);
    expect(raidEnded).toBeDefined();
    expect(raidEnded?.['outcome']).toBe('withdrew');

    // All members have despawned
    expect(party?.state).toBe('gone');
  },
};

export default scenario;
