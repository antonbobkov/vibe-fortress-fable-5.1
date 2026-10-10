import { describe, expect, it } from 'vitest';
import { C, type Squad } from '@core/components';
import { TICKS_PER_HOUR } from '@core/constants';
import { Registrations, type TickContext } from '@core/system';
import { TRAIN_SHIFT_HOURS } from '@systems/combat/constants';
import { isOnStationShift } from '@systems/combat/training';
import { memberThink } from '@systems/threats/ai';
import { calculatePartyComposition, spawnHostileMember } from '@systems/threats/parties';
import { TestWorld } from '../scenarios/test-world';

describe('T-187 loiter loot, twilight pairs and calendar shifts', () => {
  it('loots an unattended item in loiter, but never during engage', () => {
    const w = new TestWorld({ seed: 't187-engage-loot', world: 'flat-test', embark: 'none' });
    const entities = w.game.world.entities;
    const partyId = entities.create('party');
    entities.add(partyId, C.Party, { civ: 'gloam', purpose: 'raid', members: [], leaderId: 0,
      state: 'engage', goalTile: w.index(12, 12, 32), goalEntity: 0,
      arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: 1 });
    const member = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'),
      partyId, 'gloam_warrior', 'warriors', w.index(12, 12, 32), 1, false);
    const party = entities.get(partyId, C.Party)!;
    const ring = w.spawnItem('ring', 'gold', w.index(12, 12, 32));
    const ctx: TickContext = { world: w.game.world, registry: w.game.registry, readers: w.readers,
      tick: w.tick, rng: w.game.world.rngFor('18'), register: new Registrations(),
      jobs: w.game.world.services.jobs, terrain: w.game.world.services.terrain,
      spawn: w.game.world.services.spawn, emit: (e) => w.game.world.emit(e) };
    memberThink(member, entities.get(member, C.Hostile)!, party, ctx);
    expect(party.loot).toEqual([]);
    party.state = 'loiter';
    memberThink(member, entities.get(member, C.Hostile)!, party, ctx);
    expect(party.loot).toEqual([ring]);
  });

  it('twilight_pass sends a pair instead of a single thief', () => {
    expect(calculatePartyComposition('thief', 1, 0, 1, false)).toHaveLength(1);
    expect(calculatePartyComposition('thief', 1, 0, 1, true)).toHaveLength(2);
  });

  it('station halves swap at six actual calendar hours', () => {
    const squad = { members: [1, 2], station: 100 } as Squad;
    const boundary = TRAIN_SHIFT_HOURS * TICKS_PER_HOUR;
    expect(isOnStationShift(squad, 1, boundary - 1)).toBe(false);
    expect(isOnStationShift(squad, 2, boundary - 1)).toBe(true);
    expect(isOnStationShift(squad, 1, boundary)).toBe(true);
    expect(isOnStationShift(squad, 2, boundary)).toBe(false);
    expect(isOnStationShift(squad, 1, boundary * 2)).toBe(false);
  });
});
