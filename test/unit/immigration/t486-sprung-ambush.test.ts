import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SPEC } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { Registrations, type TickContext } from '@core/system';
import type { ImmigrationSystem } from '@systems/immigration';
import type { ImmigrationReader } from '@systems/immigration/reader';
import type { ThreatsSystem } from '@systems/threats';
import { TestWorld } from '../../scenarios/test-world';

function context(w: TestWorld): TickContext {
  return { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick,
    rng: w.game.world.rngFor('18'), register: new Registrations(),
    jobs: w.game.world.services.jobs, terrain: w.game.world.services.terrain, spawn: w.game.world.services.spawn,
    emit: (event) => w.game.world.emit(event) };
}

/** Year 1's first guaranteed wave is evaluated at the change to summer, two ticks after the start. */
function fortress(seed: string): TestWorld {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', startTick: 28 * TICKS_PER_DAY - 2,
    spec: { ...FLAT_TEST_SPEC, peril: 2, traits: [] } });
  for (let n = 0; n < 7; n += 1) w.spawnDwarf();
  return w;
}

/** An ambush made due at once by its schedule, and sprung by a trap on its first member (18 § Stealth). */
function sprungAmbush(w: TestWorld): number {
  const threats = w.game.world.scheduler.byId('18') as ThreatsSystem;
  const state = threats.serialize();
  const entry = state.schedule.find(([kind]) => kind === 'ambush')!;
  entry[1].earliestTick = 0; entry[1].nextTick = 0;
  threats.deserialize(state, context(w));
  threats.handle({ type: 'DayPassed' }, context(w));
  const partyId = w.game.world.entities.with(C.Party).find((id) => w.game.world.entities.get(id, C.Party)?.purpose === 'ambush')!;
  const party = w.game.world.entities.get(partyId, C.Party)!;
  threats.handle({ type: 'TrapTriggered', creatureId: party.members[0]! }, context(w));
  return partyId;
}

/** Members of the wave on the map so far: those of the wave still arriving, or of the wave that came. */
function arrived(w: TestWorld): number {
  const pending = (w.game.world.scheduler.byId('21') as ImmigrationSystem).serialize().pending;
  return pending?.ids.length ?? Number(w.events('ImmigrantsArrived')[0]?.['count'] ?? 0);
}

/** The ambush leaves: every member gone from the map, and its ending announced. */
function ends(w: TestWorld, partyId: number): void {
  const party = w.game.world.entities.get(partyId, C.Party)!;
  for (const m of party.members) if (w.game.world.entities.alive(m)) w.game.world.entities.destroy(m);
  party.state = 'gone';
  party.outcome = 'withdrew';
  w.game.world.emit({ type: 'RaidEnded', partyId, outcome: 'withdrew' });
}

describe('T-486 immigrants do not walk into a sprung ambush', () => {
  it('a wave still arriving stops while a sprung ambush is on the map, and comes on when it ends', () => {
    const w = fortress('t486-wave');
    w.until(() => arrived(w) >= 1, 20);
    const before = arrived(w);
    expect(before).toBe(1);
    const partyId = sprungAmbush(w);
    w.step(1);
    expect(w.events('AmbushSprung')).toHaveLength(1);
    w.step(300);
    expect(arrived(w)).toBe(before);
    expect(w.events('ImmigrantsArrived')).toHaveLength(0);
    ends(w, partyId);
    w.until((world) => world.events('ImmigrantsArrived').length > 0, 300);
    expect(w.events('ImmigrantsArrived')).toHaveLength(1);
  });

  it('a season evaluated while a sprung ambush is on the map waits a day at a time, as for a raid', () => {
    const w = fortress('t486-season');
    const partyId = sprungAmbush(w);
    w.step(1);
    expect(w.readers.of<ImmigrationReader>('21').eligibility().reasons).toContain('raid');
    w.step(TICKS_PER_DAY);
    expect(arrived(w)).toBe(0);
    expect(w.events('ImmigrantsArrived')).toHaveLength(0);
    ends(w, partyId);
    w.until((world) => world.events('ImmigrantsArrived').length > 0, TICKS_PER_DAY + 300);
    expect(w.events('ImmigrantsArrived')).toHaveLength(1);
  });

  it('a hidden ambush defers nothing: nobody knows it is there', () => {
    const w = fortress('t486-hidden');
    const threats = w.game.world.scheduler.byId('18') as ThreatsSystem;
    const state = threats.serialize();
    const entry = state.schedule.find(([kind]) => kind === 'ambush')!;
    entry[1].earliestTick = 0; entry[1].nextTick = 0;
    threats.deserialize(state, context(w));
    threats.handle({ type: 'DayPassed' }, context(w));
    w.step(1);
    expect(w.readers.of<ImmigrationReader>('21').eligibility().reasons).not.toContain('raid');
  });
});
