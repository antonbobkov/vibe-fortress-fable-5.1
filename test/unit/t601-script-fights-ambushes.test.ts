import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { contentRegistry } from '@content/loader';
import type { CombatReader } from '@systems/combat/reader';
import { TestWorld } from '../scenarios/test-world';
import {
  AMBUSH_FULL_SIZE, AMBUSH_SOLDIERS_SIZE, HALL_Z, Z, ambushBar, ambushKit, ambushSquad, checkFortressDefense, fightsAmbush,
  type AmbushSquad, type FortressState,
} from '../scenarios/three_years_fortress';

/**
 * T-601: the three-year script fights a sprung ambush outside when its squad clears one of the bars
 * the ambush arena set (reports/audits/2026-11-18-t600-ambush-arena.md): five soldiers in steel at
 * Proficient with two Proficient marksdwarves fight one of up to ten, the five alone one of up to
 * six, both with cloth in stock for the medics. Anything weaker stands down as before (T-575).
 */
const cx = 40;
const cy = 40;
const sx = cx + 6;
const sy = cy + 6;

describe('T-601 the ambush bars', () => {
  const full: AmbushSquad = { steel: 5, marks: 2, cloth: 20 };
  const alone: AmbushSquad = { steel: 5, marks: 0, cloth: 20 };
  const cases: [string, AmbushSquad, Record<number, boolean>][] = [
    ['the full squad', full, { 6: true, 8: true, 10: true, 11: false }],
    ['the soldiers alone', alone, { 6: true, 8: false, 10: false }],
    ['the full squad with no cloth', { ...full, cloth: 1 }, { 6: false, 8: false, 10: false }],
    ['four soldiers in steel and two marksdwarves', { ...full, steel: 4 }, { 6: false, 8: false, 10: false }],
    ['the script\'s squad, Novices in iron', { steel: 0, marks: 0, cloth: 20 }, { 6: false, 8: false, 10: false }],
  ];
  for (const [name, squad, sizes] of cases) {
    it(`${name} fights a sprung ambush of ${Object.entries(sizes).filter(([, f]) => f).map(([n]) => n).join(', ') || 'no size'}`, () => {
      for (const [size, fights] of Object.entries(sizes)) expect(fightsAmbush(squad, Number(size)), `${name} against ${size}`).toBe(fights);
    });
  }

  it('names the bar and its size', () => {
    expect(ambushBar(full)).toEqual({ bar: 'full squad', size: AMBUSH_FULL_SIZE });
    expect(ambushBar(alone)).toEqual({ bar: 'soldiers alone', size: AMBUSH_SOLDIERS_SIZE });
    expect(ambushBar({ steel: 3, marks: 2, cloth: 20 })).toEqual({ bar: 'none', size: 0 });
  });
});

type Kit = { weapon: [string, string]; shield?: [string, string]; head?: [string, string]; body?: [string, string]; legs?: [string, string]; bolts?: number };

function equip(w: TestWorld, id: EntityId, at: number, kit: Kit): void {
  const make = (k?: [string, string]): EntityId => {
    if (!k) return 0;
    const item = w.spawnItem(k[0], k[1], at, 1, 1);
    w.items.attachToCarrier(item, id);
    w.items.setOwner(item, id);
    return item;
  };
  const quiver = kit.bolts ? make(['bolt', 'iron']) : 0;
  if (quiver !== 0) w.game.world.entities.add(quiver, C.Item, { ...w.game.world.entities.get(quiver, C.Item)!, count: kit.bolts! });
  w.game.world.entities.add(id, C.Equipment, {
    weapon: make(kit.weapon), shield: make(kit.shield),
    armor: { head: make(kit.head), body: make(kit.body), arms: 0, legs: make(kit.legs), feet: 0 },
    clothing: { body: 0, legs: 0, feet: 0, over: 0 }, quiver,
  });
}

const steelKit = (metal = 'steel'): Kit => ({ weapon: ['axe', metal], shield: ['shield', metal], head: ['helm', metal], body: ['mail_shirt', metal], legs: ['greaves', metal] });

function soldier(w: TestWorld, at: number, level: number, kit: Kit, skill = 'axe'): EntityId {
  const id = w.spawnDwarf({ at, skills: { [skill]: level, shield: level, dodge: level, armor_use: level } });
  equip(w, id, at, kit);
  return id;
}

describe('T-601 the squad weighed against the ambush bars', () => {
  it('counts a soldier in steel at Proficient and a marksdwarf with bolts, and nothing short of them', () => {
    const w = new TestWorld({ seed: 't601-kits', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const at = (i: number): number => w.index(20 + i, 20, Z);
    expect(ambushKit(w, soldier(w, at(0), 10, steelKit()))).toBe('steel');
    expect(ambushKit(w, soldier(w, at(1), 8, steelKit())), 'Skilled, not Proficient').toBe('');
    expect(ambushKit(w, soldier(w, at(2), 10, steelKit('iron'))), 'in iron').toBe('');
    expect(ambushKit(w, soldier(w, at(3), 10, (({ shield: _s, ...k }) => k)(steelKit()))), 'no shield').toBe('');
    expect(ambushKit(w, soldier(w, at(4), 10, { ...steelKit(), head: ['helm', 'iron'] })), 'an iron helm').toBe('');
    expect(ambushKit(w, soldier(w, at(5), 10, { weapon: ['crossbow', 'oak'], bolts: 25 }, 'crossbow'))).toBe('marks');
    expect(ambushKit(w, soldier(w, at(6), 10, { weapon: ['crossbow', 'oak'] }, 'crossbow')), 'no bolts').toBe('');
    expect(ambushKit(w, soldier(w, at(7), 8, { weapon: ['crossbow', 'oak'], bolts: 25 }, 'crossbow')), 'Skilled').toBe('');
  }, 60_000);
});

/** T-575's gatehouse (no second line), with a squad of `count` soldiers in steel at Proficient standing at `where`, and cloth in the hall. */
function gatehouse(seed: string, count: number, where: 'hall' | 'gate'): { w: TestWorld; state: FortressState; squadId: number; soldiers: EntityId[] } {
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
  const soldiers = Array.from({ length: count }, (_, i) => {
    const at = where === 'hall' ? w.index(sx + 2 + i, sy + 1, HALL_Z) : w.index(sx - 2 + i, sy + 3, Z);
    return soldier(w, at, 10, steelKit());
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
  return { w, state, squadId, soldiers };
}

/** A sprung ambush of `size` Gloam warriors strung out north of the gate, the nearest first, in the journal's census. */
function ambush(w: TestWorld, state: FortressState, size: number): EntityId[] {
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
  return members;
}

function orders(w: TestWorld, squadId: number): readonly { kind: string; targetId?: number; tile?: number }[] {
  return w.readers.of<CombatReader>('16').squad(squadId)!.orders as readonly { kind: string; targetId?: number; tile?: number }[];
}

describe('T-601 the three-year script fights a sprung ambush with a strong squad', () => {
  it('five soldiers in steel at Proficient, with cloth, are counted against the bars', () => {
    const { w, state } = gatehouse('t601-weigh', 5, 'hall');
    expect(ambushSquad(w, state)).toEqual({ steel: 5, marks: 0, cloth: 20 });
  });

  it('sends the mustered soldiers after every member of an ambush of six, the nearest first', () => {
    const { w, state, squadId, soldiers } = gatehouse('t601-fight', 5, 'gate');
    const gloam = ambush(w, state, 6);
    checkFortressDefense(w, state);
    expect(w.game.world.fortress.alert).toBe('hearth');
    expect([...w.readers.of<CombatReader>('16').squad(squadId)!.members].sort(), 'not stood down').toEqual([...soldiers].sort());
    expect(state.stoodDown ?? []).toEqual([]);
    expect(orders(w, squadId).filter((o) => o.kind === 'kill').map((o) => o.targetId)).toEqual(gloam);
    expect(orders(w, squadId).find((o) => o.kind === 'station')?.tile, 'from the gatehouse stair').toBe(w.index(sx, sy, Z));
    expect(state.ambushAnswers).toEqual({ 'fought (soldiers alone)': 1 });
  });

  it('musters at the gatehouse stair before it sets out', () => {
    const { w, state, squadId } = gatehouse('t601-muster', 5, 'hall');
    ambush(w, state, 6);
    checkFortressDefense(w, state);
    expect(orders(w, squadId).map((o) => o.kind), 'a station and no kill').toEqual(['station']);
    expect(orders(w, squadId)[0]!.tile).toBe(w.index(sx, sy, Z));
    expect(state.mustered).not.toBe(true);
  });

  it('stands down for an ambush beyond its bar, as before', () => {
    const { w, state, squadId, soldiers } = gatehouse('t601-beyond', 5, 'gate');
    ambush(w, state, 8);
    checkFortressDefense(w, state);
    expect(w.readers.of<CombatReader>('16').squad(squadId)!.members).toEqual([]);
    expect(state.stoodDown).toEqual(soldiers);
    expect(state.ambushAnswers).toEqual({ 'stood down': 1 });
  });

  it('stands down for an ambush of six with four soldiers in steel', () => {
    const { w, state, squadId } = gatehouse('t601-short', 4, 'gate');
    ambush(w, state, 6);
    checkFortressDefense(w, state);
    expect(w.readers.of<CombatReader>('16').squad(squadId)!.members).toEqual([]);
  });
});
