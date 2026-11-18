import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { contentRegistry } from '@content/loader';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { CombatReader } from '@systems/combat/reader';
import { TestWorld } from '../scenarios/test-world';
import { HALL_Z, Z, checkFortressDefense, innerLineBuilt, innerRingTiles, type FortressState } from '../scenarios/three_years_fortress';

/**
 * T-575: the three-year script answered an ambush as it answers a raid: the squad to the gatehouse
 * stair. An ambush does not come to the gate; it springs on the dwarves at work outdoors, and the
 * soldiers, on duty under the alert, fought it a few at a time on their way in while the civilians
 * fled. An ambush larger than the squad's armed soldiers is now sheltered from: the soldiers are
 * stood down for the alert and go in with everybody, and are put back once it is down, or at once
 * when a raid needs them. One the squad's armed soldiers are as many as is met at the gate stair.
 */
const cx = 40;
const cy = 40;
const sx = cx + 6;
const sy = cy + 6;

/** T-518's gatehouse, with the second line built, and three soldiers in the hearth hall, each with a sword when `armed`. */
function gatehouse(seed: string, armed: boolean): { w: TestWorld; state: FortressState; squadId: number } {
  const w = new TestWorld({ seed, registry: contentRegistry() });
  w.carve(w.index(sx, sy, Z), TileKind.StairsDown);
  for (let z = HALL_Z + 1; z < Z; z += 1) w.carve(w.index(sx, sy, z), TileKind.StairsUpDown);
  w.carve(w.index(sx, sy, HALL_Z), TileKind.StairsUp);
  w.digRoom(sx - 6, sy - 2, HALL_Z, 5, 5);
  w.digRoom(sx + 2, sy - 2, HALL_Z, 6, 5);
  w.digRoom(sx - 1, sy, HALL_Z, 1, 1);
  w.digRoom(sx + 1, sy, HALL_Z, 1, 1);
  w.digRoom(sx, sy - 6, HALL_Z, 1, 6);
  w.digRoom(sx, sy + 1, HALL_Z, 1, 8);
  for (let y = sy - 8; y <= sy + 10; y += 1) for (let x = sx - 8; x <= sx + 9; x += 1) w.discover(w.index(x, y, HALL_Z));
  for (const [x, y] of [[sx - 1, sy - 1], [sx + 1, sy - 1], [sx - 1, sy], [sx + 1, sy], [sx - 1, sy + 1], [sx + 1, sy + 1]] as const) {
    w.build('wall', w.index(x, y, Z));
  }
  const south = w.build('door', w.index(sx, sy + 1, Z));
  const north = w.build('door', w.index(sx, sy - 1, Z));
  w.build('hearth', w.index(sx + 4, sy, HALL_Z));
  const ent = w.game.world.entities;
  const soldiers = [0, 1, 2].map((i) => {
    const at = w.index(sx + 3 + i, sy + 1, HALL_Z);
    const id = w.spawnDwarf({ at });
    if (armed) {
      const sword = w.spawnItem('short_sword', 'iron', at, 1, 1);
      w.items.attachToCarrier(sword, id);
      w.items.setOwner(sword, id);
      ent.add(id, C.Equipment, {
        weapon: sword, shield: 0, armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
        clothing: { body: 0, legs: 0, feet: 0, over: 0 }, quiver: 0,
      });
    }
    return id;
  });
  expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Gate Guard' }).ok).toBe(true);
  const squadId = w.readers.of<CombatReader>('16').squads()[0]!.id;
  expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: soldiers }).ok).toBe(true);
  w.step(1);
  const state = {
    cx, cy, z: Z, hallZ: HALL_Z, placedIds: {}, economy: { phases: new Set(['gate walls']), specialists: {} },
    gateDoorId: south, gateDoorPlaced: true, gateDoorId2: north, gateDoorPlaced2: true, gateWallLostTick: 0,
    squadId, answered: '', lastDangerTick: -1, shutOut: false, eventsRead: 0, warnedUntil: -1, alertSince: -1, wildQuietUntil: -1,
  } as unknown as FortressState;
  for (const t of innerRingTiles(w, state)) w.carve(t, TileKind.Floor);
  checkFortressDefense(w, state);
  const system = w.game.world.scheduler.byId('14') as BuildingsSystem;
  for (const id of state.innerDoorIds ?? []) if (id !== 0 && w.readers.of<BuildingsReader>('14').get(id)?.state !== 'built') system.completeNow(id, 0, 0);
  checkFortressDefense(w, state);
  expect(innerLineBuilt(w, state)).toBe(true);
  return { w, state, squadId };
}

/** An ambush of `size` Gloam warriors north of the gate, hidden until `sprung`. */
function ambush(w: TestWorld, size: number, sprung: boolean): { party: EntityId; members: EntityId[] } {
  const ent = w.game.world.entities;
  const members = Array.from({ length: size }, (_, i) => {
    const id = w.spawnCreature('gloam_warrior', w.index(sx - 4 + i, sy - 12, Z), 'hostile:gloam');
    ent.add(id, C.Hostile, { partyId: 0, role: 'warrior', behaviorState: 'approach', stealthed: !sprung, spotted: sprung, breakingDoorId: 0, breakingSince: 0 } as never);
    return id;
  });
  const party = ent.create('party');
  ent.add(party, C.Party, { civ: 'gloam', purpose: 'ambush', members, leaderId: members[0]!, state: sprung ? 'engage' : 'approach', goalTile: -1, goalEntity: 0,
    arrivedTick: w.tick, stateSince: w.tick, loot: [], edge: 'n', size, ambushSprung: sprung } as never);
  return { party, members };
}

function orders(w: TestWorld, squadId: number): readonly { kind: string; targetId?: number; tile?: number }[] {
  return w.readers.of<CombatReader>('16').squad(squadId)!.orders as readonly { kind: string; targetId?: number; tile?: number }[];
}

function post(w: TestWorld, squadId: number): number {
  return orders(w, squadId).find((o) => o.kind === 'station')?.tile ?? -1;
}

function members(w: TestWorld, squadId: number): readonly number[] {
  return w.readers.of<CombatReader>('16').squad(squadId)!.members;
}

describe('T-575 the three-year script answers an ambush', () => {
  it('stands the squad down for an ambush larger than its armed soldiers, and puts it back once the alert is down', () => {
    for (const [seed, size, armed] of [['t575-outnumbered', 4, true], ['t575-unarmed', 2, false]] as const) {
      const { w, state, squadId } = gatehouse(seed, armed);
      const soldiers = [...members(w, squadId)];
      const { party } = ambush(w, size, true);
      checkFortressDefense(w, state);
      expect(w.game.world.fortress.alert, seed).toBe('hearth');
      expect(members(w, squadId), `${seed}: the soldiers go in with the civilians`).toEqual([]);
      expect(state.stoodDown, seed).toEqual(soldiers);
      // The ambush leaves; the alert is lifted after its all-clear, and the soldiers are back.
      const ent = w.game.world.entities;
      ent.add(party, C.Party, { ...ent.get(party, C.Party)!, state: 'gone' });
      state.lastDangerTick = w.tick - 1000;
      checkFortressDefense(w, state);
      expect(w.game.world.fortress.alert, seed).toBe('calm');
      checkFortressDefense(w, state);
      expect([...members(w, squadId)].sort(), seed).toEqual([...soldiers].sort());
    }
  });

  it('meets an ambush no larger than its armed soldiers at the gate stair', () => {
    const { w, state, squadId } = gatehouse('t575-even', true);
    ambush(w, 3, true);
    checkFortressDefense(w, state);
    expect(w.game.world.fortress.alert).toBe('hearth');
    expect(members(w, squadId)).toHaveLength(3);
    expect(post(w, squadId)).toBe(w.index(sx, sy, Z));
  });

  it('counts the members of an ambush still to arrive', () => {
    const { w, state, squadId } = gatehouse('t575-arriving', true);
    const { party } = ambush(w, 2, true);
    const ent = w.game.world.entities;
    ent.add(party, C.Party, { ...ent.get(party, C.Party)!, size: 5 });
    checkFortressDefense(w, state);
    expect(members(w, squadId)).toEqual([]);
  });

  it('puts the soldiers back at once when a raid comes while they are stood down', () => {
    const { w, state, squadId } = gatehouse('t575-raid', true);
    ambush(w, 4, true);
    checkFortressDefense(w, state);
    expect(members(w, squadId)).toEqual([]);
    const ent = w.game.world.entities;
    const raider = w.spawnCreature('gloam_warrior', w.index(5, 5, Z), 'hostile:gloam');
    const party = ent.create('party');
    ent.add(party, C.Party, { civ: 'gloam', purpose: 'raid', members: [raider], leaderId: raider, state: 'approach', goalTile: -1, goalEntity: 0, arrivedTick: w.tick, stateSince: w.tick, loot: [], edge: 'n' } as never);
    checkFortressDefense(w, state);
    expect(members(w, squadId)).toHaveLength(3);
    expect(post(w, squadId)).toBe(w.index(sx, sy, Z));
  });
});

describe('T-576 the three-year script sees an ambush only once it has sprung', () => {
  it('raises no alert and keeps the squad for a hidden ambush, and answers it on the tick it springs', () => {
    const { w, state, squadId } = gatehouse('t576-hidden', true);
    const soldiers = [...members(w, squadId)];
    const { party, members: gloam } = ambush(w, 4, false);
    checkFortressDefense(w, state);
    // Hidden: no announcement, not on the threats panel; the player does not know it is there.
    expect(w.game.world.fortress.alert).toBe('calm');
    expect(members(w, squadId)).toEqual(soldiers);
    expect(state.stoodDown ?? []).toEqual([]);
    // It springs (18 § Stealth: `AmbushSprung`, a danger announcement): the answer of T-575.
    const ent = w.game.world.entities;
    ent.add(party, C.Party, { ...ent.get(party, C.Party)!, ambushSprung: true, state: 'engage' });
    for (const id of gloam) ent.add(id, C.Hostile, { ...ent.get(id, C.Hostile)!, stealthed: false, spotted: true });
    checkFortressDefense(w, state);
    expect(w.game.world.fortress.alert).toBe('hearth');
    expect(members(w, squadId)).toEqual([]);
    expect(state.stoodDown).toEqual(soldiers);
  });
});

/**
 * T-596: an ambush whose leader came down the stair hidden, sprang in the hearth hall, and had its
 * others locked out at the gate by the alert. Stood down for an ambush of six, the squad left the
 * leader to the civilians sheltering in the hall, who came to it one at a time: 28 died.
 */
describe('T-596 the three-year script sends the squad against an ambush in the halls', () => {
  it('keeps the squad up and hunts an ambush member indoors from its post below, however large the ambush', () => {
    const { w, state, squadId } = gatehouse('t596-in-the-halls', true);
    const soldiers = [...members(w, squadId)];
    const ent = w.game.world.entities;
    const { party, members: outside } = ambush(w, 5, true);
    const leader = w.spawnCreature('gloam_warrior', w.index(sx + 4, sy - 1, HALL_Z), 'hostile:gloam');
    ent.add(leader, C.Hostile, { partyId: party, role: 'warrior', behaviorState: 'engage', stealthed: false, spotted: true, breakingDoorId: 0, breakingSince: 0 } as never);
    ent.add(party, C.Party, { ...ent.get(party, C.Party)!, members: [leader, ...outside], leaderId: leader, size: 6 });
    for (const id of outside) ent.add(id, C.Hostile, { ...ent.get(id, C.Hostile)!, partyId: party });
    checkFortressDefense(w, state);
    expect(w.game.world.fortress.alert).toBe('hearth');
    expect([...members(w, squadId)].sort(), 'the soldiers are not stood down').toEqual([...soldiers].sort());
    expect(state.stoodDown ?? []).toEqual([]);
    expect(orders(w, squadId).filter((o) => o.kind === 'kill').map((o) => o.targetId), 'the member in the halls is hunted').toEqual([leader]);
    expect(post(w, squadId), 'from below, not the gate stair').toBe(w.index(sx, sy + 2, HALL_Z));
    // Once it is dead the ambush outside is sheltered from, as before.
    w.game.world.entities.destroy(leader);
    checkFortressDefense(w, state);
    expect(members(w, squadId)).toEqual([]);
    expect(state.stoodDown).toEqual(soldiers);
  });
});
