/** T-352: a thief that has not reached its quarry THIEF_APPROACH_DAYS after arrival withdraws. */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { Registrations, type TickContext } from '@core/system';
import { partyThink } from '@systems/threats/ai';
import { spawnHostileMember } from '@systems/threats/parties';
import { THIEF_APPROACH_DAYS } from '@systems/threats/constants';
import { TestWorld } from '../../scenarios/test-world';

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const ctxAt = (tick: number): TickContext => ({ world: w.game.world, registry: w.game.registry, readers: w.readers, tick,
    rng: w.game.world.rngFor('18'), register: new Registrations(),
    jobs: w.game.world.services.jobs, terrain: w.game.world.services.terrain, spawn: w.game.world.services.spawn,
    emit: (event) => w.game.world.emit(event) });
  const partyId = w.game.world.entities.create('party');
  w.game.world.entities.add(partyId, C.Party, { civ: 'gloam', purpose: 'thief', members: [], leaderId: 0,
    state: 'approach', goalTile: 0, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: 1 });
  spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'), partyId, 'gloam_snatcher', 'thief', w.index(12, 2, 32), 1, false);
  const loot = w.spawnItem('ring', 'gold', w.index(30, 30, 32));
  return { w, ctxAt, partyId, loot };
}

describe('T-352 a thief approaching its quarry for too long withdraws', () => {
  it('keeps approaching a live quarry before the bound and withdraws empty-handed at it', () => {
    const { w, ctxAt, partyId, loot } = setup('t352-bound');
    const party = () => w.game.world.entities.get(partyId, C.Party)!;
    partyThink(partyId, party(), ctxAt(THIEF_APPROACH_DAYS * TICKS_PER_DAY - 50));
    expect(party().state).toBe('approach');
    expect(party().goalEntity).toBe(loot);
    partyThink(partyId, party(), ctxAt(THIEF_APPROACH_DAYS * TICKS_PER_DAY));
    expect(party().state).toBe('retreat');
    expect(party().outcome).toBe('withdrew');
    expect(party().loot).toEqual([]);
  });
});
