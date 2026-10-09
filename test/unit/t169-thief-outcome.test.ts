import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C, type Party } from '@core/components';
import { Registrations, type TickContext } from '@core/system';
import { memberThink, pickUpLoot, partyThink, checkPartyCasualties } from '@systems/threats/ai';
import { spawnHostileMember } from '@systems/threats/parties';
import { TestWorld } from '../scenarios/test-world';

function setup() {
  const w = new TestWorld({ seed: 't169-thief', world: 'flat-test', embark: 'none' });
  const ctx: TickContext = { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick,
    rng: w.game.world.rngFor('18'), register: new Registrations(),
    jobs: w.game.world.services.jobs, terrain: w.game.world.services.terrain, spawn: w.game.world.services.spawn,
    emit: (event) => w.game.world.emit(event) };
  const partyId = w.game.world.entities.create('party');
  w.game.world.entities.add(partyId, C.Party, { civ: 'gloam', purpose: 'thief', members: [], leaderId: 0,
    state: 'approach', goalTile: 0, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: 1 });
  const member = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'),
    partyId, 'gloam_snatcher', 'thief', w.index(12, 12, 32), 1, false);
  const party = w.game.world.entities.get(partyId, C.Party)!;
  const loot = w.spawnItem('ring', 'gold', w.index(12, 12, 32));
  party.goalTile = w.index(12, 12, 32);
  party.goalEntity = loot;
  return { w, ctx, partyId, party, member, loot };
}
function leave(w: TestWorld, ctx: TickContext, party: Party, member: number): void {
  party.state = 'retreat';
  w.game.world.entities.add(member, C.Position, w.map.unpack(w.index(12, 0, 32)));
  memberThink(member, w.game.world.entities.get(member, C.Hostile)!, party, { ...ctx, tick: w.tick });
  expect(w.game.world.entities.alive(member)).toBe(false);
}
function outcome(w: TestWorld) {
  w.step(1);
  const ends = w.events('RaidEnded');
  expect(ends).toHaveLength(1);
  return ends[0]!['outcome'];
}

describe('T-169 raid outcomes follow actual escaped loot', () => {
  it('a thief spotted by a creature after stealing leaves as looted', () => {
    const { w, ctx, party, member, loot } = setup();
    memberThink(member, w.game.world.entities.get(member, C.Hostile)!, party, ctx);
    expect(party.loot).toContain(loot);
    w.spawnDwarf({ at: w.index(13, 12, 32), ageYears: 30 });
    memberThink(member, w.game.world.entities.get(member, C.Hostile)!, party, ctx);
    expect(w.game.world.entities.get(member, C.Hostile)?.spotted).toBe(true);
    leave(w, ctx, party, member);
    expect(outcome(w)).toBe('looted');
    expect(w.events('ThiefEscaped').filter((e) => e['itemId'] === loot)).toHaveLength(1);
  });
  it('a trap-spotted thief after stealing keeps the looted result', () => {
    const { w, ctx, party, member, loot } = setup();
    pickUpLoot(member, loot, party, ctx);
    w.game.world.emit({ type: 'TrapTriggered', creatureId: member, trapId: 0 });
    w.step(1);
    leave(w, ctx, party, member);
    expect(outcome(w)).toBe('looted');
  });
  it('a thief spotted before stealing withdraws empty-handed', () => {
    const { w, ctx, party, member } = setup();
    w.spawnDwarf({ at: w.index(13, 12, 32), ageYears: 30 });
    memberThink(member, w.game.world.entities.get(member, C.Hostile)!, party, ctx);
    expect(party.loot).toEqual([]);
    leave(w, ctx, party, member);
    expect(outcome(w)).toBe('withdrew');
    expect(w.events('ThiefEscaped')).toHaveLength(0);
  });
  it('stolen loot that never escapes does not turn a wiped party into looted', () => {
    const { w, ctx, partyId, party, member } = setup();
    memberThink(member, w.game.world.entities.get(member, C.Hostile)!, party, ctx);
    expect(party.loot.length).toBeGreaterThan(0);
    const torso = w.game.world.entities.get(member, C.Body)!.parts[1]!;
    w.game.world.emit({ type: 'DamageDealt', defenderId: member, attackerId: 0, part: 'torso', damageType: 'blunt', amount: torso.maxHp * 2 });
    w.until(() => !w.game.world.entities.alive(member), 10);
    partyThink(partyId, party, { ...ctx, tick: w.tick });
    expect(outcome(w)).toBe('wiped');
  });
  it("an empty departing member cannot report another member's carried item as escaped", () => {
    const { w, ctx, partyId, party, member, loot } = setup();
    const other = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'),
      partyId, 'gloam_snatcher', 'thief', w.index(20, 12, 32), 1, false);
    pickUpLoot(other, loot, party, ctx);
    leave(w, ctx, party, member);
    w.step(1);
    expect(w.events('ThiefEscaped')).toHaveLength(0);
    expect(w.game.world.entities.get(loot, C.Item)?.carriedBy).toBe(other);
    expect(party.loot).toContain(loot);
    leave(w, ctx, party, other);
    expect(outcome(w)).toBe('looted');
    expect(w.events('ThiefEscaped').filter((e) => e['itemId'] === loot)).toHaveLength(1);
  });
  it('an unconscious surviving member causes retreat rather than a wiped ending', () => {
    const { w, ctx, partyId, party, member } = setup();
    w.game.world.entities.get(member, C.Body)!.conscious = false;
    const ends: unknown[] = [];
    const checking = { ...ctx, emit: (event: Parameters<TickContext['emit']>[0]) => {
      if (event.type === 'RaidEnded') ends.push(event['outcome']);
    } };
    checkPartyCasualties(partyId, party, checking);
    expect(party.state).toBe('retreat');
    expect(party.outcome).toBe('repelled');
    partyThink(partyId, party, checking);
    expect(ends).toEqual([]);
    expect(w.game.world.entities.alive(member)).toBe(true);
  });
  it('an earlier escaped member makes the final result looted even when remaining members die', () => {
    const { w, ctx, partyId, party, member, loot } = setup();
    const other = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'),
      partyId, 'gloam_snatcher', 'thief', w.index(20, 12, 32), 1, false);
    pickUpLoot(member, loot, party, ctx);
    party.outcome = 'withdrew';
    leave(w, ctx, party, member);
    w.step(1);
    expect(w.events('RaidEnded')).toHaveLength(0);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.game.hash());
    const p = loaded.world.entities.get(partyId, C.Party)!;
    const ends: unknown[] = [];
    loaded.world.onEvents((events) => { ends.push(...events.filter((e) => e.type === 'RaidEnded').map((e) => e['outcome'])); });
    const torso = loaded.world.entities.get(other, C.Body)!.parts[1]!;
    loaded.world.emit({ type: 'DamageDealt', defenderId: other, attackerId: 0, part: 'torso', damageType: 'blunt', amount: torso.maxHp * 2 });
    for (let tick = 0; tick < 10 && loaded.world.entities.alive(other); tick += 1) loaded.step(1);
    expect(loaded.world.entities.alive(other)).toBe(false);
    partyThink(partyId, p, { ...ctx, world: loaded.world, readers: loaded.world.readers, tick: loaded.tick,
      rng: loaded.world.rngFor('18'), jobs: loaded.world.services.jobs, terrain: loaded.world.services.terrain,
      spawn: loaded.world.services.spawn, emit: (event) => loaded.world.emit(event) });
    loaded.step(1);
    expect(ends).toEqual(['looted']);
  });
});
