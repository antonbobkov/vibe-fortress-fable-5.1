/**
 * `th_retreat` of `04-implementation/acceptance-tests.md` § 18 Threats:
 * "raid loses half its members | RaidEnded { repelled }; raid_repelled thought"
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { spawnHostileMember } from '@systems/threats';
import type { MoraleReader } from '@systems/morale/reader';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';

let dwarfId = 0;
let partyId = 0;

const scenario: Scenario = {
  id: 'th_retreat',
  milestone: 6,
  seed: 'th-retreat',
  world: 'flat-test',
  embark: 'none',
  setup: (w: TestWorld) => {
    const z = FLAT_TEST_SURFACE_Z;
    dwarfId = w.spawnDwarf({ at: w.index(24, 24, z) });

    // Create raid party entity
    partyId = w.game.world.entities.create('party');
    w.game.world.entities.add(partyId, C.Party, {
      civ: 'gloam',
      purpose: 'raid',
      members: [],
      leaderId: 0,
      state: 'approach',
      goalTile: w.index(24, 24, z),
      goalEntity: dwarfId,
      arrivedTick: w.tick,
      stateSince: w.tick,
      loot: [],
      edge: 'n',
      size: 4,
    });

    // Spawn 4 members in the party: 1 captain, 1 archer, 2 warriors
    spawnHostileMember(
      w.game.world,
      w.game.registry,
      w.game.world.rngFor('18'),
      partyId,
      'gloam_captain',
      'captain',
      w.index(24, 0, z),
      1,
      true,
    );
    spawnHostileMember(
      w.game.world,
      w.game.registry,
      w.game.world.rngFor('18'),
      partyId,
      'gloam_warrior',
      'warriors',
      w.index(22, 0, z),
      1,
      false,
    );
    spawnHostileMember(
      w.game.world,
      w.game.registry,
      w.game.world.rngFor('18'),
      partyId,
      'gloam_warrior',
      'warriors',
      w.index(26, 0, z),
      1,
      false,
    );
    spawnHostileMember(
      w.game.world,
      w.game.registry,
      w.game.world.rngFor('18'),
      partyId,
      'gloam_archer',
      'archers',
      w.index(28, 0, z),
      1,
      false,
    );
  },
  run: (w: TestWorld) => {
    const party = w.game.world.entities.get(partyId, C.Party);
    expect(party).toBeDefined();
    const members = party!.members;
    expect(members.length).toBe(4);

    // Kill half of the members (2 members out of 4)
    const toKill = 2;
    for (let i = 0; i < toKill; i++) {
      const m = members[i]!;
      const pos = w.game.world.entities.get(m, C.Position);
      const tile = pos ? w.index(pos.x, pos.y, pos.z) : w.index(24, 24, FLAT_TEST_SURFACE_Z);
      const cr = w.game.world.entities.get(m, C.Creature);
      // Emit CreatureDied
      w.game.world.emit({
        type: 'CreatureDied',
        id: m,
        tile,
        species: cr?.species ?? 0,
        cause: 'combat',
      });
      w.game.world.entities.destroy(m);
    }

    // Step once to let threats handle CreatureDied and trigger retreat
    w.step(1);
    expect(party!.state).toBe('retreat');

    // Wait until RaidEnded is emitted as surviving members reach the edge and despawn
    w.until((world) => world.events('RaidEnded').some((e) => e['partyId'] === partyId), 1500);

    const raidEnded = w.events('RaidEnded').find((e) => e['partyId'] === partyId);
    expect(raidEnded).toBeDefined();
    expect(raidEnded?.['outcome']).toBe('repelled');

    // Living dwarf receives the raid_repelled thought
    const morale = w.readers.of<MoraleReader>('15');
    expect(morale.thoughts(dwarfId).some((t) => t.id === 'raid_repelled')).toBe(true);
  },
};

export default scenario;
