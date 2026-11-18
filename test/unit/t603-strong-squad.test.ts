import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { contentRegistry } from '@content/loader';
import type { CombatReader } from '@systems/combat/reader';
import { TestWorld } from '../scenarios/test-world';
import {
  AMBUSH_MARKS, AMBUSH_SKILL, AMBUSH_SOLDIERS, HALL_Z, Z, strongPlan, ambushKit, ambushSquad, checkFortressDefense, pickSquad, squadTrains,
  type FortressState,
} from '../scenarios/three_years_fortress';

/**
 * T-603: where ambushes come the three-year script builds toward the squad T-601's bars ask for:
 * five soldiers who train in a barracks until Proficient, then work; two marksdwarves in a ranged
 * squad of their own, who go out with a squad that fights an ambush; and the alert comes down as
 * soon as such an ambush has broken, so that the medics can reach the wounded outside the gate.
 */
const cx = 40;
const cy = 40;
const sx = cx + 6;
const sy = cy + 6;

describe('T-603 the strong squad\'s roster and training', () => {
  it('keeps its living members who are still free, then takes the most skilled, the lowest id first', () => {
    const score = (id: number): number => ({ 11: 4, 12: 9, 13: 9, 14: 1 } as Record<number, number>)[id] ?? 0;
    expect(pickSquad([14, 99], [11, 12, 13, 14, 15], 3, score, new Set())).toEqual([14, 12, 13]);
    expect(pickSquad([], [11, 12, 13, 14, 15], AMBUSH_SOLDIERS, score, new Set([12]))).toEqual([13, 11, 14, 15]);
    expect(pickSquad([11, 12, 13], [11, 12, 13], 2, score, new Set())).toEqual([11, 12]);
  });

  it('trains while one of it is short of Proficient, with a barracks and enough adults', () => {
    const plan = strongPlan(4);
    expect(squadTrains([AMBUSH_SKILL, 3], 30, true, plan)).toBe(true);
    expect(squadTrains([AMBUSH_SKILL, AMBUSH_SKILL + 2], 30, true, plan), 'all Proficient: back to work').toBe(false);
    expect(squadTrains([0], 30, false, plan), 'no barracks').toBe(false);
    expect(squadTrains([0], plan.floor - 1, true, plan), 'too few adults').toBe(false);
    expect(squadTrains([0], plan.floor, true, plan)).toBe(true);
    expect(strongPlan(2).adults, 'peril 2 starts smaller').toBeLessThan(plan.adults);
  });
});

type Kit = { weapon: [string, string]; shield?: [string, string]; head?: [string, string]; body?: [string, string]; legs?: [string, string] };

function equip(w: TestWorld, id: EntityId, at: number, kit: Kit): void {
  const make = (k?: [string, string]): EntityId => {
    if (!k) return 0;
    const item = w.spawnItem(k[0], k[1], at, 1, 1);
    w.items.attachToCarrier(item, id);
    w.items.setOwner(item, id);
    return item;
  };
  w.game.world.entities.add(id, C.Equipment, {
    weapon: make(kit.weapon), shield: make(kit.shield),
    armor: { head: make(kit.head), body: make(kit.body), arms: 0, legs: make(kit.legs), feet: 0 },
    clothing: { body: 0, legs: 0, feet: 0, over: 0 }, quiver: 0,
  });
}

const steelKit: Kit = { weapon: ['short_sword', 'steel'], shield: ['shield', 'steel'], head: ['helm', 'steel'], body: ['mail_shirt', 'steel'], legs: ['greaves', 'steel'] };

/** A marksdwarf at Proficient with a crossbow, a quiver in its slot and `bolts` bolts carried beside it, as 16 equips one. */
function marksdwarf(w: TestWorld, at: number, bolts: number): EntityId {
  const id = w.spawnDwarf({ at, skills: { crossbow: AMBUSH_SKILL, dodge: AMBUSH_SKILL } });
  equip(w, id, at, { weapon: ['crossbow', 'iron'] });
  const quiver = w.spawnItem('quiver', 'leather', at, 1, 1);
  w.items.attachToCarrier(quiver, id);
  w.items.setOwner(quiver, id);
  w.game.world.entities.add(id, C.Equipment, { ...w.game.world.entities.get(id, C.Equipment)!, quiver });
  if (bolts > 0) {
    const stack = w.spawnItem('bolt', 'iron', at, bolts, 1);
    w.items.attachToCarrier(stack, id);
    w.items.setOwner(stack, id);
  }
  return id;
}

/** T-601's gatehouse, with five soldiers in steel at Proficient by the gate, two marksdwarves in a squad of their own, and cloth in the hall. */
function gatehouse(seed: string): { w: TestWorld; state: FortressState; squadId: number; marksId: number; marks: EntityId[] } {
  const w = new TestWorld({ seed, registry: contentRegistry() });
  w.carve(w.index(sx, sy, Z), TileKind.StairsDown);
  for (let z = HALL_Z + 1; z < Z; z += 1) w.carve(w.index(sx, sy, z), TileKind.StairsUpDown);
  w.carve(w.index(sx, sy, HALL_Z), TileKind.StairsUp);
  w.digRoom(sx + 1, sy - 2, HALL_Z, 7, 5);
  for (const [x, y] of [[sx - 1, sy - 1], [sx + 1, sy - 1], [sx - 1, sy], [sx + 1, sy], [sx - 1, sy + 1], [sx + 1, sy + 1]] as const) {
    w.build('wall', w.index(x, y, Z));
  }
  const south = w.build('door', w.index(sx, sy + 1, Z));
  const north = w.build('door', w.index(sx, sy - 1, Z));
  w.spawnItem('cloth', 'wool_cloth', w.index(sx + 6, sy + 2, HALL_Z), 20);
  const soldiers = Array.from({ length: AMBUSH_SOLDIERS }, (_, i) => {
    const at = w.index(sx - 2 + i, sy + 3, Z);
    const id = w.spawnDwarf({ at, skills: { sword: AMBUSH_SKILL, shield: AMBUSH_SKILL, dodge: AMBUSH_SKILL, armor_use: AMBUSH_SKILL } });
    equip(w, id, at, steelKit);
    return id;
  });
  const marks = Array.from({ length: AMBUSH_MARKS }, (_, i) => marksdwarf(w, w.index(sx - 1 + i, sy + 4, Z), 25));
  for (const name of ['Gate Guard', 'Bolts']) expect(w.game.world.applyCommand({ type: 'CreateSquad', name }).ok).toBe(true);
  const squads = w.readers.of<CombatReader>('16').squads();
  const squadId = squads.find((sq) => sq.name === 'Gate Guard')!.id;
  const marksId = squads.find((sq) => sq.name === 'Bolts')!.id;
  expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: soldiers }).ok).toBe(true);
  expect(w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId: marksId, equipment: { ranged: true, weaponClass: 'crossbow' } }).ok).toBe(true);
  expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: marksId, members: marks }).ok).toBe(true);
  w.step(1);
  const state = {
    cx, cy, z: Z, hallZ: HALL_Z, placedIds: {}, economy: { phases: new Set(['gate walls']), specialists: {} },
    gateDoorId: south, gateDoorPlaced: true, gateDoorId2: north, gateDoorPlaced2: true, gateWallLostTick: 0,
    squadId, answered: '', lastDangerTick: -1, shutOut: false, eventsRead: 0, warnedUntil: -1, alertSince: -1, wildQuietUntil: -1,
    strong: { marksSquadId: marksId, trained: [...soldiers, ...marks], day: -1 },
  } as unknown as FortressState;
  return { w, state, squadId, marksId, marks };
}

/** A sprung ambush of `size` Gloam warriors strung out north of the gate, in the journal's census; returns the party and its members. */
function ambush(w: TestWorld, state: FortressState, size: number): { party: EntityId; members: EntityId[] } {
  const ent = w.game.world.entities;
  const party = ent.create('party');
  const members = Array.from({ length: size }, (_, i) => {
    const id = w.spawnCreature('gloam_warrior', w.index(sx - 3 + (i % 2) * 6, sy - 8 - 2 * i, Z), 'hostile:gloam');
    ent.add(id, C.Hostile, { partyId: party, role: 'warrior', behaviorState: 'engage', stealthed: false, spotted: true, breakingDoorId: 0, breakingSince: 0 } as never);
    return id;
  });
  ent.add(party, C.Party, { civ: 'gloam', purpose: 'ambush', members, leaderId: members[0]!, state: 'engage', goalTile: -1, goalEntity: 0,
    arrivedTick: w.tick, stateSince: w.tick, loot: [], edge: 'n', size, ambushSprung: true } as never);
  state.ambushes = [{ party, day: 1, size, outdoors: 0, armed: 0, deaths: 0, soldiers: 0, fell: 0, outsideAtLock: -1, squad: [] }];
  return { party, members };
}

function orders(w: TestWorld, squadId: number): readonly { kind: string; targetId?: number; tile?: number }[] {
  return w.readers.of<CombatReader>('16').squad(squadId)!.orders as readonly { kind: string; targetId?: number; tile?: number }[];
}

describe('T-603 the marksdwarves against a sprung ambush', () => {
  it('counts a marksdwarf whose bolts are carried beside its quiver, and none without bolts', () => {
    const w = new TestWorld({ seed: 't603-bolts', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    expect(ambushKit(w, marksdwarf(w, w.index(20, 20, Z), 25))).toBe('marks');
    expect(ambushKit(w, marksdwarf(w, w.index(22, 20, Z), 0)), 'a quiver and no bolts').toBe('');
  }, 60_000);

  it('weighs the marksdwarves of their own squad with the soldiers: the full squad', () => {
    const { w, state } = gatehouse('t603-weigh');
    expect(ambushSquad(w, state)).toEqual({ steel: AMBUSH_SOLDIERS, marks: AMBUSH_MARKS, cloth: 20 });
  });

  it('sends the marksdwarves with the soldiers after every member of an ambush of eight', () => {
    const { w, state, squadId, marksId } = gatehouse('t603-fight');
    const { members } = ambush(w, state, 8);
    checkFortressDefense(w, state);
    expect(state.ambushAnswers).toEqual({ 'fought (full squad)': 1 });
    expect(orders(w, squadId).filter((o) => o.kind === 'kill').map((o) => o.targetId)).toEqual(members);
    expect(orders(w, marksId).filter((o) => o.kind === 'kill').map((o) => o.targetId), 'the same members').toEqual(members);
    expect(orders(w, marksId).find((o) => o.kind === 'station')?.tile, 'from the gatehouse stair').toBe(w.index(sx, sy, Z));
  });
});

describe('T-603 the alert after a fought ambush', () => {
  it('comes down as soon as the ambush the squad went out to fight has broken', () => {
    const { w, state, squadId, marksId } = gatehouse('t603-broken');
    const { party } = ambush(w, state, 8);
    checkFortressDefense(w, state);
    expect(w.game.world.fortress.alert).toBe('hearth');
    w.game.world.entities.add(party, C.Party, { ...w.game.world.entities.get(party, C.Party)!, state: 'retreat' });
    w.step(1);
    checkFortressDefense(w, state);
    expect(w.game.world.fortress.alert, 'at once, not ALL_CLEAR_TICKS later').toBe('calm');
    expect(orders(w, squadId), 'the soldiers called back').toEqual([]);
    expect(orders(w, marksId), 'the marksdwarves called back').toEqual([]);
  });

  it('waits as before after an ambush it stood down from', () => {
    const { w, state } = gatehouse('t603-hid');
    state.strong!.marksSquadId = 0;
    const { party } = ambush(w, state, 8);
    // Without its marksdwarves the squad clears only the soldiers' bar (up to six): it stands down for eight.
    checkFortressDefense(w, state);
    expect(state.ambushAnswers).toEqual({ 'stood down': 1 });
    w.game.world.entities.add(party, C.Party, { ...w.game.world.entities.get(party, C.Party)!, state: 'retreat' });
    w.step(1);
    checkFortressDefense(w, state);
    expect(w.game.world.fortress.alert).toBe('hearth');
  });
});

describe('T-603 a marksdwarf shoots its last bolt at the range', () => {
  it('clears the quiver slot that names the stack, as a shot does (16 § Equipment)', () => {
    // An immigrant hunter arrives with its bolts in its quiver slot (21); trained as a marksdwarf, its
    // practice dropped the last bolt at the target while the slot still named it.
    const w = new TestWorld({ seed: 't603-last-bolt', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const ent = w.game.world.entities;
    // Five marksdwarves with one bolt each in the quiver slot: a practice shot breaks one bolt in five and drops the others at the target.
    const tiles = Array.from({ length: 6 }, (_, i) => w.index(10 + i, 10, Z));
    expect(w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'barracks', tiles }).ok).toBe(true);
    w.build('archery_target', tiles[5]!);
    const marks = tiles.slice(0, 5).map((at) => {
      const id = w.spawnDwarf({ at, skills: { crossbow: 2 } });
      equip(w, id, at, { weapon: ['crossbow', 'iron'] });
      const bolt = w.spawnItem('bolt', 'iron', at, 1, 1);
      w.items.attachToCarrier(bolt, id);
      w.items.setOwner(bolt, id);
      ent.add(id, C.Equipment, { ...ent.get(id, C.Equipment)!, quiver: bolt });
      return id;
    });
    expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Bolts' }).ok).toBe(true);
    const squadId = w.readers.of<CombatReader>('16').squads()[0]!.id;
    expect(w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId, equipment: { ranged: true, weaponClass: 'crossbow' } }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: marks }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'SetSquadMode', squadId, mode: 'train' }).ok).toBe(true);
    w.until(() => w.events('TrainingSession').length >= marks.length, 2000);
    // Each slot is empty or names a bolt its marksdwarf carries: not one dropped at the target, nor one
    // another marksdwarf has since picked up there.
    for (const id of marks) {
      const slot = ent.get(id, C.Equipment)!.quiver;
      expect(slot === 0 || (ent.get(slot, C.Item)?.carriedBy === id && ent.get(slot, C.Position) === undefined), `marksdwarf ${id}'s quiver slot`).toBe(true);
    }
  }, 60_000);
});
