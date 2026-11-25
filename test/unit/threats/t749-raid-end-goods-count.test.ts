/**
 * T-749: a raid's end line counts the goods that escaped as its theft line does, in units: a
 * stack of 9 arrows is 9 goods, so "fled with 14 goods" stands beside "escaped with 14 goods".
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Party } from '@core/components';
import type { GameEvent } from '@core/events';
import { Registrations, type TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import { despawnMember, pickUpLoot } from '@systems/threats/ai';
import { spawnHostileMember } from '@systems/threats/parties';
import { AnnouncementLog } from '@ui/announcements';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from '../ui/ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function setup(seed: string, purpose: Party['purpose'], loads: readonly (readonly [string, string, number])[]) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const ctx: TickContext = { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick,
    rng: w.game.world.rngFor('18'), register: new Registrations(),
    terrain: w.game.world.services.terrain, jobs: w.game.world.services.jobs, spawn: w.game.world.services.spawn,
    emit: (event) => w.game.world.emit(event) };
  const partyId = w.game.world.entities.create('party');
  const party: Party = { civ: 'gloam', purpose, members: [], leaderId: 0, state: 'retreat',
    goalTile: 0, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: loads.length };
  w.game.world.entities.add(partyId, C.Party, party);
  const members: EntityId[] = [];
  loads.forEach(([type, material, count], k) => {
    const at = w.index(20 + k, 0, z);
    const member = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'), partyId,
      purpose === 'thief' ? 'gloam_snatcher' : 'gloam_warrior', purpose === 'thief' ? 'thief' : 'warriors', at, 3, false);
    pickUpLoot(member, w.spawnItem(type, material, at, count), party, ctx);
    members.push(member);
  });
  return { w, ctx, partyId, party, members };
}

function announcer(w: TestWorld): AnnouncementLog {
  const log = new AnnouncementLog(strings, w.game.registry);
  log.register(w.game.world.registrations.announcements);
  return log;
}

describe('T-749 a raid\'s end counts the escaped goods as its theft line does', () => {
  it('9 iron arrows, 4 iron bars and a sword: "fled with 14 goods" beside "escaped with 14 goods: …"', () => {
    const { w, ctx, partyId, party, members } = setup('t749-units', 'raid', [['arrow', 'iron', 9], ['bar', 'iron', 4], ['short_sword', 'iron', 1]]);
    for (const m of members) despawnMember(m, partyId, party, ctx);
    w.step(1);
    expect(party.escapedLootCount).toBe(14);
    const log = announcer(w);
    for (const e of w.events('ThiefEscaped')) log.announce(e as GameEvent, w.readers, w.tick);
    const ended = w.events('RaidEnded').find((e) => e['partyId'] === partyId);
    expect(ended?.['outcome']).toBe('looted');
    log.announce(ended as GameEvent, w.readers, w.tick);
    const texts = log.lines.map((l) => l.text);
    expect(texts).toContain('Raiders have escaped with 14 goods: iron arrows ×9, iron bars ×4 and an iron short sword!');
    expect(texts).toContain('The Gloam raid is over: 3 raiders fled with 14 goods.');
  });

  it('one member with one item reads "fled with a stolen item", as before', () => {
    const { w, ctx, partyId, party, members } = setup('t749-one', 'raid', [['short_sword', 'iron', 1]]);
    despawnMember(members[0] as EntityId, partyId, party, ctx);
    w.step(1);
    expect(party.escapedLootCount).toBe(1);
    const ended = w.events('RaidEnded').find((e) => e['partyId'] === partyId);
    expect(announcer(w).announce(ended as GameEvent, w.readers, w.tick)?.line.text).toBe('The Gloam raid is over: 1 raider fled with a stolen item.');
  });
});
