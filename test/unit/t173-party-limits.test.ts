import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import { Registrations, type TickContext } from '@core/system';
import { memberThink, partyThink, pickUpLoot } from '@systems/threats/ai';
import { spawnHostileMember } from '@systems/threats/parties';
import { TestWorld } from '../scenarios/test-world';

function setup(purpose: 'raid' | 'thief' = 'raid', x = 12, y = 12) {
  const w = new TestWorld({ seed: 't173-party', world: 'flat-test', embark: 'none' });
  const partyId = w.game.world.entities.create('party');
  w.game.world.entities.add(partyId, C.Party, { civ: 'gloam', purpose, members: [], leaderId: 0,
    state: 'approach', goalTile: 0, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: 1 });
  const member = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'), partyId,
    purpose === 'thief' ? 'gloam_snatcher' : 'gloam_warrior', purpose === 'thief' ? 'thief' : 'warriors', w.index(x, y, 32), 1, false);
  const party = w.game.world.entities.get(partyId, C.Party)!;
  const ctx: TickContext = { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick,
    rng: w.game.world.rngFor('18'), register: new Registrations(),
    jobs: w.game.world.services.jobs, terrain: w.game.world.services.terrain, spawn: w.game.world.services.spawn,
    emit: (event) => w.game.world.emit(event) };
  return { w, partyId, member, party, ctx };
}
function enclose(w: TestWorld, x: number, y: number) {
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    if (dx !== 0 || dy !== 0) w.carve(w.index(x + dx, y + dy, 32), TileKind.Wall);
  }
  w.pathing.connectivity.rebuildDirty();
}

describe('T-173 hostile parties leave empty goals and bound a stalled retreat', () => {
  it.each([false, true])('ends a raid at an empty fortress hearth within three days (loot %s)', (loot) => {
    const { w, partyId, party, member } = setup('raid', 12, 0);
    w.build('hearth', w.index(12, 12, 32), 'granite');
    w.step(2);
    // The report's party has already reached its accessible goal beside the hearth.
    const goal = w.index(12, 11, 32);
    w.movement.teleport(member, goal);
    party.goalTile = goal;
    party.goalUnreachable = false;
    party.state = 'approach';
    party.stateSince = w.tick;
    if (loot) w.spawnItem('ring', 'gold', goal);
    w.step(3 * TICKS_PER_DAY);
    expect(w.events('RaidEnded').filter((e) => e['partyId'] === partyId)).toHaveLength(1);
    expect(party.state).toBe('gone');
    expect(w.game.world.entities.alive(member)).toBe(false);
    expect(party.outcome).toBe(loot ? 'looted' : 'withdrew');
  });
  it('preserves the reachable-goal loiter deadline across unrelated terrain changes', () => {
    const { w, party, ctx } = setup();
    w.build('hearth', w.index(12, 12, 32), 'granite');
    party.state = 'loiter';
    party.stateSince = 0;
    party.goalTile = w.index(12, 12, 32);
    party.goalUnreachable = false;
    const threats = w.game.world.scheduler.byId('18')!;
    threats.handle({ type: 'TilesChanged', tiles: [w.index(40, 40, 32)] }, { ...ctx, tick: TICKS_PER_DAY });
    expect(party.state).toBe('loiter');
    expect(party.stateSince).toBe(0);
  });
  it('keeps its selected edge destination after a step changes the nearest-edge tie', () => {
    const { w, party, member, ctx } = setup('thief', 9, 7);
    party.state = 'retreat';
    for (let x = 0; x < w.map.w; x++) {
      if (x !== 1 && x !== 2) w.carve(w.index(x, 0, 32), TileKind.Wall);
    }
    w.pathing.connectivity.rebuildDirty();
    const hostile = w.game.world.entities.get(member, C.Hostile)!;
    memberThink(member, hostile, party, ctx);
    const selected = w.movement.walkTarget(member);
    expect(selected).toBe(w.index(2, 0, 32));
    // The measured first step on the reported seed changes the geometric tie.
    w.movement.teleport(member, w.index(8, 7, 32));
    memberThink(member, hostile, party, { ...ctx, tick: 1 });
    expect(w.movement.walkTarget(member)).toBe(selected);
  });
  it('counts empty-goal idle time from arrival, not from the start of approach', () => {
    const { w, party, partyId, member, ctx } = setup();
    party.goalTile = w.index(12, 12, 32);
    partyThink(partyId, party, { ...ctx, tick: 1000 });
    expect(party.state).toBe('approach');
    partyThink(partyId, party, { ...ctx, tick: 1149 });
    expect(party.state).toBe('approach');
    partyThink(partyId, party, { ...ctx, tick: 1150 });
    expect(party.state).toBe('loiter');
    expect(w.game.world.entities.alive(member)).toBe(true);
  });
  it('pins tile-index ties when a stalled retreat selects any reachable edge', () => {
    const { w, party, member, ctx } = setup('thief');
    party.state = 'retreat';
    const hostile = w.game.world.entities.get(member, C.Hostile)!;
    memberThink(member, hostile, party, ctx);
    memberThink(member, hostile, party, { ...ctx, tick: 600 });
    expect(w.movement.walkTarget(member)).toBe(w.index(0, 0, 32));
  });
  it('saves an arrived-goal idle clock without restarting it', () => {
    const { w, party } = setup();
    party.goalTile = w.index(12, 12, 32);
    w.step(80);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());
    for (let tick = 0; tick < 200; tick++) {
      w.step(1); loaded.step(1);
      expect(loaded.hash()).toBe(w.hash());
    }
    expect(party.state).toBe('loiter');
  });
  it('reroutes to another reachable edge after 600 ticks without progress', () => {
    const { w, party, member } = setup('thief', 29, 13);
    party.state = 'retreat';
    party.outcome = 'withdrew';
    for (let x = 0; x < w.map.w; x++) w.carve(w.index(x, 5, 32), TileKind.Wall);
    w.pathing.connectivity.rebuildDirty();
    w.step(800);
    const pos = w.game.world.entities.get(member, C.Position);
    expect(!w.game.world.entities.alive(member) || (pos !== undefined && pos.x < 29)).toBe(true);
  });
  it('removes a thief enclosed after theft within two days and reports one ending', () => {
    const { w, party, partyId, member, ctx } = setup('thief', 29, 13);
    const loot = w.spawnItem('ring', 'gold', w.index(29, 13, 32));
    pickUpLoot(member, loot, party, ctx);
    party.state = 'retreat';
    party.outcome = 'looted';
    enclose(w, 29, 13);
    w.step(2 * TICKS_PER_DAY + 50);
    expect(w.game.world.entities.alive(member)).toBe(false);
    expect(party.state).toBe('gone');
    expect(w.events('RaidEnded').filter((e) => e['partyId'] === partyId)).toHaveLength(1);
    expect(w.events('ThiefEscaped').filter((e) => e['itemId'] === loot)).toHaveLength(1);
    expect(party.outcome).toBe('looted');
  });
  it('spotting a retreating thief does not restart its two-day deadline', () => {
    const { w, party, partyId, member, ctx } = setup('thief');
    party.state = 'retreat';
    party.outcome = 'withdrew';
    w.game.world.scheduler.byId('18')!.handle({ type: 'TrapTriggered', creatureId: member }, { ...ctx, tick: 2300 });
    expect(party.stateSince).toBe(0);
    partyThink(partyId, party, { ...ctx, tick: 2400 });
    expect(party.state).toBe('gone');
  });
  it('includes unconscious surviving members in the retreat deadline', () => {
    const { w, party, partyId, member, ctx } = setup();
    party.state = 'retreat';
    party.outcome = 'repelled';
    w.game.world.entities.get(member, C.Body)!.conscious = false;
    partyThink(partyId, party, { ...ctx, tick: 2 * TICKS_PER_DAY });
    expect(w.game.world.entities.alive(member)).toBe(false);
    expect(party.state).toBe('gone');
    expect(party.outcome).toBe('repelled');
  });
  it('carrying a stolen animal alone does not stall an otherwise reachable retreat', () => {
    const { w, party, member, ctx } = setup('thief');
    const animal = w.spawnCreature('cat', w.index(12, 12, 32), 'fortress');
    pickUpLoot(member, animal, party, ctx);
    party.state = 'retreat';
    party.outcome = 'looted';
    w.step(TICKS_PER_DAY);
    expect(w.game.world.entities.alive(member)).toBe(false);
    expect(w.events('ThiefEscaped').some((e) => e['animalId'] === animal)).toBe(true);
  });
  it('removes a stolen adjacent animal from spatial occupancy so it cannot block its thief', () => {
    const { w, party, member, ctx } = setup('thief');
    const animalTile = w.index(12, 11, 32);
    const animal = w.spawnCreature('cat', animalTile, 'fortress');
    pickUpLoot(member, animal, party, ctx);
    const occupied = w.spatial.at(animalTile).includes(animal);
    party.state = 'retreat';
    party.outcome = 'looted';
    w.step(TICKS_PER_DAY);
    expect({ occupied, thiefAlive: w.game.world.entities.alive(member) }).toEqual({ occupied: false, thiefAlive: false });
    expect(w.events('ThiefEscaped').some((e) => e['animalId'] === animal)).toBe(true);
  });
  it('keeps a retreat and its deadline identical across save/load', () => {
    const { w, party, member } = setup('thief');
    party.state = 'retreat';
    party.outcome = 'withdrew';
    enclose(w, 12, 12);
    w.step(650);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());
    for (let tick = 0; tick < 50; tick++) {
      w.step(1); loaded.step(1);
      expect(loaded.hash()).toBe(w.hash());
    }
    w.step(1800); loaded.step(1800);
    expect(loaded.hash()).toBe(w.hash());
    expect(w.game.world.entities.alive(member)).toBe(false);
  });
});
