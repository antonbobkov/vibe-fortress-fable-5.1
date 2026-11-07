/**
 * T-523: a party ends on the tick its last member dies. A retreating party skipped the casualty
 * check, so it ended only at its next think (every THREATS_CADENCE ticks), and the invariant
 * `party.active-with-no-living-member` could sample it in that gap (sweep p2-6, a gloam ambush).
 */
import { describe, it, expect } from 'vitest';
import { C } from '@core/components';
import { FLAT_TEST_SPEC } from '@app/headless';
import { Registrations, type TickContext } from '@core/system';
import { ThreatsSystem } from '@systems/threats';
import { TestWorld } from '../scenarios/test-world';

function context(w: TestWorld): TickContext {
  return { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick,
    rng: w.game.world.rngFor('18'), register: new Registrations(),
    jobs: w.game.world.services.jobs, terrain: w.game.world.services.terrain, spawn: w.game.world.services.spawn,
    emit: (event) => w.game.world.emit(event) };
}

/** An ambush party that 18's schedule sends now, on a flat map with no fortress. */
function raid(seed: string): { w: TestWorld; partyId: number } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', spec: { ...FLAT_TEST_SPEC, peril: 2, traits: [] } });
  const threats = w.game.world.scheduler.byId('18') as ThreatsSystem;
  const state = threats.serialize();
  const entry = state.schedule.find(([kind]) => kind === 'ambush')!;
  entry[1].earliestTick = 0; entry[1].nextTick = 0;
  threats.deserialize(state, context(w));
  threats.handle({ type: 'DayPassed' }, context(w));
  const partyId = w.game.world.entities.with(C.Party).find((id) => w.game.world.entities.get(id, C.Party)?.purpose === 'ambush')!;
  return { w, partyId };
}

function kill(w: TestWorld, id: number): void {
  const torso = w.game.world.entities.get(id, C.Body)!.parts[1]!;
  w.game.world.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0, part: 'torso', damageType: 'blunt', amount: torso.maxHp * 4 });
}

describe('T-523 a party ends when its last member dies', () => {
  for (const state of ['retreat', 'engage'] as const) {
    it(`a party in ${state} is gone on the tick its last living member is gone, not at its next think`, () => {
      const { w, partyId } = raid(`t523-${state}`);
      const entities = w.game.world.entities;
      const party = () => entities.get(partyId, C.Party)!;
      w.until(() => party().members.length === party().size && party().size >= 2 && party().members.every((m) => entities.has(m, C.Position)), 2_000);
      party().state = state;
      party().stateSince = w.tick;
      for (const m of party().members) kill(w, m);
      let gap = 0;
      w.until(() => {
        const living = party().members.some((m) => entities.alive(m));
        if (!living && party().state !== 'gone') gap += 1;
        return !living && party().state === 'gone';
      }, 500);
      expect(gap).toBe(0);
      w.step(1);
      expect(w.events('RaidEnded').filter((e) => e['partyId'] === partyId)).toHaveLength(1);
    });
  }
});
