import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SPEC } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { C, type Party } from '@core/components';
import { Registrations, type TickContext } from '@core/system';
import { Compositor } from '@render/compositor';
import { Palette } from '@render/palette';
import { ThreatsSystem, arriveParty } from '@systems/threats';
import { partyThink } from '@systems/threats/ai';
import { SPOT_RADIUS } from '@systems/threats/constants';
import { focusOf } from '@ui/announcements';
import { TestWorld } from '../scenarios/test-world';

function context(w: TestWorld): TickContext {
  return { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick,
    rng: w.game.world.rngFor('18'), register: new Registrations(),
    jobs: w.game.world.services.jobs, terrain: w.game.world.services.terrain, spawn: w.game.world.services.spawn,
    emit: (event) => w.game.world.emit(event) };
}
function scheduled() {
  const w = new TestWorld({ seed: 't170-ambush', world: 'flat-test', embark: 'none',
    spec: { ...FLAT_TEST_SPEC, peril: 2, traits: [] } });
  const threats = w.game.world.scheduler.byId('18') as ThreatsSystem;
  const state = threats.serialize();
  const entry = state.schedule.find(([kind]) => kind === 'ambush')!;
  entry[1].earliestTick = 0; entry[1].nextTick = 0;
  threats.deserialize(state, context(w));
  threats.handle({ type: 'DayPassed' }, context(w));
  const partyId = w.game.world.entities.with(C.Party).find((id) => w.game.world.entities.get(id, C.Party)?.purpose === 'ambush')!;
  const party = w.game.world.entities.get(partyId, C.Party)!;
  return { w, threats, partyId, party };
}
function drawn(w: TestWorld, x: number, y: number) {
  const compositor = new Compositor({ registry: w.game.registry, palette: new Palette(w.game.registry) });
  compositor.compose(w.readers, { camX: x, camY: y, z: 32, sidebarOpen: false, cursor: null }, 4, 9);
  return compositor.topCreature(w.index(x, y, 32));
}
function visible(w: TestWorld, party: Party) {
  return party.members.map((id) => w.game.world.entities.get(id, C.Hostile)?.stealthed);
}

describe('T-170 a scheduled ambush hides and springs once for the whole party', () => {
  it('hides warriors and archers without an edge announcement', () => {
    const { w, party } = scheduled();
    w.step(110);
    expect(party.members.length).toBeGreaterThan(1);
    expect(new Set(party.members.map((id) => w.game.world.entities.get(id, C.Hostile)?.role))).toEqual(new Set(['warriors', 'archers']));
    expect(visible(w, party)).toEqual(party.members.map(() => true));
    expect(w.events('RaidArrived')).toHaveLength(0);
    expect(w.events('AmbushSprung')).toHaveLength(0);
  });
  it('is not drawn or acquired by a soldier outside spotting radius, then reveals in engage once', () => {
    const { w, party, partyId } = scheduled();
    w.step(110);
    for (const m of party.members) w.movement.teleport(m, w.index(20, 20, 32));
    const dwarf = w.spawnDwarf({ at: w.index(20 + SPOT_RADIUS + 1, 20, 32), ageYears: 30 });
    w.submit({ type: 'CreateSquad', name: 'Watch', leaderId: dwarf });
    w.game.world.commandPhase(true);
    const squadId = w.game.world.entities.with(C.Squad)[0]!;
    w.submit({ type: 'SetSquadMembers', squadId, members: [dwarf] });
    w.submit({ type: 'SetAlert', level: 'watchful' });
    w.game.world.commandPhase(true);
    w.step(1);
    expect(drawn(w, 20, 20)).toBeNull();
    expect(w.game.world.services.combat?.targetOf(dwarf)).toBe(0);
    expect(w.events('AmbushSprung')).toHaveLength(0);
    w.movement.teleport(dwarf, w.index(20 + SPOT_RADIUS, 20, 32));
    w.step(1);
    expect(w.events('AmbushSprung')).toHaveLength(1);
    const event = w.events('AmbushSprung')[0]!;
    expect(event['partyId']).toBe(partyId);
    expect(focusOf(event, w.readers)).toBe(w.movement.tileOf(party.leaderId));
    expect(party.state).toBe('engage');
    expect(visible(w, party)).toEqual(party.members.map(() => false));
    expect(drawn(w, 20, 20)).not.toBeNull();
    w.step(2);
    expect(w.game.world.services.combat?.targetOf(dwarf)).not.toBe(0);
    expect(w.events('AmbushSprung')).toHaveLength(1);
    expect(w.events('RaidArrived')).toHaveLength(0);
  });
  it('does not enter engage at perception range before a hidden member is spotted', () => {
    const { w, party, partyId } = scheduled();
    w.step(110);
    for (const m of party.members) w.movement.teleport(m, w.index(20, 20, 32));
    party.goalTile = w.index(30, 20, 32);
    w.spawnDwarf({ at: w.index(20 + SPOT_RADIUS + 1, 20, 32), ageYears: 30 });
    partyThink(partyId, party, context(w));
    expect(party.state).toBe('approach');
  });
  it('springs when the real trap clears stealth before its queued event is delivered', () => {
    const { w, party } = scheduled();
    const first = party.members[0]!;
    const tile = w.index(12, 12, 32);
    w.build('weapon_trap', tile, 'iron');
    w.step(2);
    w.movement.stopWalking(first);
    party.goalTile = tile;
    party.goalUnreachable = false;
    w.movement.teleport(first, tile);
    w.step(1);
    expect(w.game.world.entities.get(first, C.Hostile)?.stealthed).toBe(false);
    // Trap dispatch queues its reveal for the following tick.
    w.step(2);
    expect(w.events('TrapTriggered')).toHaveLength(1);
    expect(w.events('AmbushSprung')).toHaveLength(1);
    expect(party.state).toBe('engage');
  });
  it('a trap reveals the whole party once and late arrivals stay revealed', () => {
    const { w, threats, party } = scheduled();
    const first = party.members[0]!;
    threats.handle({ type: 'TrapTriggered', creatureId: first }, context(w));
    w.step(110);
    expect(party.members.length).toBeGreaterThan(1);
    expect(visible(w, party)).toEqual(party.members.map(() => false));
    expect(party.members.every((id) => w.game.world.entities.get(id, C.Hostile)?.spotted === true)).toBe(true);
    expect(w.events('AmbushSprung')).toHaveLength(1);
    threats.handle({ type: 'TrapTriggered', creatureId: party.members[1]! }, context(w));
    w.step(1);
    expect(w.events('AmbushSprung')).toHaveLength(1);
  });
  it('restores a hidden ambush and its pending arrivals without announcing it', () => {
    const { w, party, partyId } = scheduled();
    w.step(1);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());
    w.step(110); loaded.step(110);
    expect(loaded.hash()).toBe(w.hash());
    expect(visible(w, party)).toEqual(party.members.map(() => true));
    const restored = loaded.world.entities.get(partyId, C.Party)!;
    expect(restored.members.every((id) => loaded.world.entities.get(id, C.Hostile)?.stealthed === true)).toBe(true);
    expect(w.events('AmbushSprung')).toHaveLength(0);
  });
  it('restores an already sprung ambush without a second event or hidden late member', () => {
    const { w, threats, party, partyId } = scheduled();
    threats.handle({ type: 'TrapTriggered', creatureId: party.members[0]! }, context(w));
    w.step(1);
    const loaded = roundTrip(w.game).game;
    const events: string[] = [];
    loaded.world.onEvents((batch) => { for (const event of batch) if (event.type === 'AmbushSprung') events.push(event.type); });
    w.step(110); loaded.step(110);
    expect(loaded.hash()).toBe(w.hash());
    expect(visible(w, party)).toEqual(party.members.map(() => false));
    expect(loaded.world.entities.get(partyId, C.Party)?.members.every((id) => loaded.world.entities.get(id, C.Hostile)?.stealthed === false)).toBe(true);
    expect(events).toHaveLength(0);
    expect(w.events('AmbushSprung')).toHaveLength(1);
  });
  it('ordinary raids still announce their arrival and retain ordinary species stealth', () => {
    const w = new TestWorld({ seed: 't170-raid-control', world: 'flat-test', embark: 'none' });
    const { partyId } = arriveParty(w.game.world, w.game.registry, w.game.world.rngFor('18'), 'raid', 'gloam', 1, 'n', w.tick, 0, 2, false);
    w.step(1);
    const party = w.game.world.entities.get(partyId, C.Party)!;
    expect(w.events('RaidArrived')).toHaveLength(1);
    expect(visible(w, party)).toEqual(party.members.map(() => false));
  });
});
