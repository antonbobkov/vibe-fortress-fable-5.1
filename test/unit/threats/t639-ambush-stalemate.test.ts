/**
 * The sweep's seed p4-6 at shift 150 (on the T-639 branch): an eight-strong gloam ambush stayed on
 * the map past ten days. One archer walked into the fortress before its doors shut and the other
 * seven were left outside, cut off; the archer stood in the barracks trading blows with soldiers
 * at drill, whose training weapons do 0 damage and whose wounds from its bow-bash healed. A blow
 * every few ticks kept the party's stall count (ENGAGE_STALL_TICKS) at zero, so the party stayed
 * in engage for good. 18 § Engage: a fight in which no one on either side falls for
 * ENGAGE_STALEMATE_TICKS is a stalemate, counted through its returns to approach, and the party
 * stalls, loiters and goes home.
 */
import { describe, expect, it, vi } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Party } from '@core/components';
import { Registrations, type TickContext } from '@core/system';
import type { CombatReader } from '@systems/combat';
import { partyThink } from '@systems/threats/ai';
import { ENGAGE_STALEMATE_TICKS, THREATS_CADENCE } from '@systems/threats/constants';
import { countCasualty } from '@systems/threats/morale';
import { spawnHostileMember } from '@systems/threats/parties';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

/** A sprung ambush of one gloam archer two tiles from a dwarf, engaged, whose every think finds a fresh blow. */
function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  w.spawnDwarf({ at: w.index(14, 12, Z), name: 'Palnir Wolfaxe', ageYears: 30 });
  const partyId = w.game.world.entities.create('party');
  w.game.world.entities.add(partyId, C.Party, { civ: 'gloam', purpose: 'ambush', members: [], leaderId: 0, state: 'engage', goalTile: w.index(14, 12, Z),
    goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: 1, ambushSprung: true, morale: 75 });
  const member = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'), partyId, 'gloam_archer', 'archers', w.index(12, 12, Z), 1, false);
  const hostile = w.game.world.entities.get(member, C.Hostile)!;
  hostile.stealthed = false;
  const party = w.game.world.entities.get(partyId, C.Party)!;
  let now = 0;
  // The blows: one at every think, as the archer's bow-bash and the soldiers' wooden swords were.
  vi.spyOn(w.readers.of<CombatReader>('16'), 'lastEngagementTick').mockImplementation(() => now);
  const think = (tick: number): void => {
    now = tick;
    const ctx: TickContext = { world: w.game.world, registry: w.game.registry, readers: w.readers, tick, rng: w.game.world.rngFor('18'),
      register: new Registrations(), jobs: w.game.world.services.jobs, terrain: w.game.world.services.terrain, spawn: w.game.world.services.spawn,
      emit: (event) => w.game.world.emit(event) };
    partyThink(partyId, party, ctx);
  };
  return { w, partyId, party, member, hostile, think };
}

/** Think every THREATS_CADENCE ticks from `from` to `to`; the tick the party left engage for loiter, or -1. */
function run(think: (tick: number) => void, party: Party, from: number, to: number, onTick?: (tick: number) => void): number {
  for (let tick = from; tick <= to; tick += THREATS_CADENCE) {
    onTick?.(tick);
    think(tick);
    if (party.state === 'loiter') return tick;
  }
  return -1;
}

describe('T-639 an ambush in a fight where no one falls goes home', () => {
  it('stalls after ENGAGE_STALEMATE_TICKS of blows that fell no one, and stays out of the fight', () => {
    const { party, think } = setup('t639-stalemate');
    const stalled = run(think, party, 0, 3 * ENGAGE_STALEMATE_TICKS);
    expect(stalled).toBe(ENGAGE_STALEMATE_TICKS);
    expect(party.stalled).toBe(true);
    // Sight no longer draws it back: it loiters, and its loiter time sends it home.
    think(stalled + THREATS_CADENCE);
    expect(party.state).toBe('loiter');
  });

  it('counts the stalemate through its returns to approach', () => {
    const { party, think } = setup('t639-cycle');
    // Twice the party drops back to approach and comes on again at once, as a party that loses sight does.
    const stalled = run(think, party, 0, 3 * ENGAGE_STALEMATE_TICKS, (tick) => {
      if (tick === 400 || tick === 800) {
        party.state = 'approach';
        party.stateSince = tick;
      }
    });
    expect(stalled).toBe(ENGAGE_STALEMATE_TICKS);
  });

  it('counts again from a casualty on either side', () => {
    const { party, hostile, think } = setup('t639-casualty');
    const fell = 900;
    const stalled = run(think, party, 0, 3 * ENGAGE_STALEMATE_TICKS, (tick) => {
      if (tick === fell) countCasualty(party, { ...hostile }, 'fled', tick);
    });
    expect(stalled).toBe(fell + ENGAGE_STALEMATE_TICKS);
  });
});
