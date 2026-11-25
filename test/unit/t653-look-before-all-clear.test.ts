import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { contentRegistry } from '@content/loader';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { CombatReader } from '@systems/combat/reader';
import type { ThreatScheduleEntry } from '@systems/threats';
import { TestWorld } from '../scenarios/test-world';
import { checkDefenceRaid, type DefenceYearState } from '../scenarios/defence_year_fortress';
import { scriptRecord } from '../scenarios/script-commands';
import { HALL_Z, LOOK_MAX_TICKS, LOOK_TICKS, Z, checkFortressDefense, innerLineBuilt, innerRingTiles, type FortressState } from '../scenarios/three_years_fortress';

/**
 * T-653: an ambush that arrives while the fortress shelters from a raid waits, hidden, by the locked
 * gate, and springs on the first dwarves out once the alert comes down. Where ambushes come, the
 * three-year script now lowers an alert raised for a raid, a siege, an ambush or a threat warning
 * only once the watch has looked: the gate's doors are set open with the alert still up, the
 * watchmen take their posts outside them, and the alert comes down once each post has been held
 * LOOK_TICKS. Anything spotted in the look ends it, and the doors lock on the alert again.
 */
const cx = 40;
const cy = 40;
const sx = cx + 6;
const sy = cy + 6;

/** T-575's gatehouse with the second line built, three armed soldiers and four civilians in the hearth hall (two of them join the squad); ambushes possible from day 0. */
function gatehouse(seed: string, northWatch = true): { w: TestWorld; state: FortressState; civilians: EntityId[] } {
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
    const sword = w.spawnItem('short_sword', 'iron', at, 1, 1);
    w.items.attachToCarrier(sword, id);
    w.items.setOwner(sword, id);
    ent.add(id, C.Equipment, {
      weapon: sword, shield: 0, armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 }, quiver: 0,
    });
    return id;
  });
  const civilians = [0, 1, 2, 3].map((i) => w.spawnDwarf({ at: w.index(sx + 3 + i, sy - 1, HALL_Z) }));
  expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Gate Guard' }).ok).toBe(true);
  const squadId = w.readers.of<CombatReader>('16').squads()[0]!.id;
  expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: soldiers }).ok).toBe(true);
  // 18 § Schedule: ambushes possible from the first day (the schedule preview the script reads), none rolled.
  const schedule = (w.game.world.scheduler.byId('18') as unknown as { schedule: Map<string, ThreatScheduleEntry> }).schedule;
  schedule.set('ambush', { kind: 'ambush', peril: 4, earliestTick: 0, nextTick: 1e9, intervalMin: 1e9, intervalMax: 1e9, base: 0, perRenown: 0, max: 0, warningDays: 0, pendingSpawnTick: -1 });
  w.step(1);
  const state = {
    cx, cy, z: Z, hallZ: HALL_Z, placedIds: {}, economy: { phases: new Set(['gate walls']), specialists: {} },
    gateDoorId: south, gateDoorPlaced: true, gateDoorId2: north, gateDoorPlaced2: true, gateWallLostTick: 0,
    squadId, answered: '', lastDangerTick: -1, shutOut: false, eventsRead: 0, warnedUntil: -1, alertSince: -1, wildQuietUntil: -1,
  } as unknown as FortressState;
  if (!northWatch) state.northWatch = false;
  for (const t of innerRingTiles(w, state)) w.carve(t, TileKind.Floor);
  checkFortressDefense(w, state);
  const system = w.game.world.scheduler.byId('14') as BuildingsSystem;
  for (const id of state.innerDoorIds ?? []) if (id !== 0 && w.readers.of<BuildingsReader>('14').get(id)?.state !== 'built') system.completeNow(id, 0, 0);
  checkFortressDefense(w, state);
  expect(innerLineBuilt(w, state)).toBe(true);
  expect(state.watch?.length, 'a watch post outside each gate door').toBe(northWatch ? 2 : 1);
  return { w, state, civilians };
}

/** A raid of one at the map's corner; it comes to the gate. */
function raid(w: TestWorld): EntityId {
  const ent = w.game.world.entities;
  const raider = w.spawnCreature('gloam_warrior', w.index(5, 5, Z), 'hostile:gloam');
  const party = ent.create('party');
  ent.add(party, C.Party, { civ: 'gloam', purpose: 'raid', members: [raider], leaderId: raider, state: 'approach', goalTile: -1, goalEntity: 0, arrivedTick: w.tick, stateSince: w.tick, loot: [], edge: 'n' } as never);
  return party;
}

function doorModes(w: TestWorld, state: FortressState): string[] {
  const buildings = w.readers.of<BuildingsReader>('14');
  return [state.gateDoorId, state.gateDoorId2, ...(state.innerDoorIds ?? [])].map((id) => buildings.get(id)?.mode ?? '');
}

function watchmen(w: TestWorld, state: FortressState): number[] {
  const combat = w.readers.of<CombatReader>('16');
  return (state.watch ?? []).flatMap((wt) => combat.squad(wt.squadId)?.members ?? []);
}

/** The raid comes and goes: the alert is up for it, and it has been gone past the all-clear. */
function raidGone(w: TestWorld, state: FortressState): void {
  const party = raid(w);
  checkFortressDefense(w, state);
  expect(w.game.world.fortress.alert).toBe('hearth');
  checkFortressDefense(w, state);
  expect(watchmen(w, state), 'the watchmen go in under the alert').toEqual([]);
  const ent = w.game.world.entities;
  ent.add(party, C.Party, { ...ent.get(party, C.Party)!, state: 'gone' });
  state.lastDangerTick = w.tick - 1000;
}

/** Plays on with the script looking every 20 ticks, as `playThreeYears` does, until `done` or `ticks` have passed. */
function play(w: TestWorld, state: FortressState, ticks: number, done: () => boolean): void {
  const end = w.tick + ticks;
  while (w.tick < end && !done()) {
    w.step(20);
    checkFortressDefense(w, state);
  }
}

describe('T-653 the three-year script looks before an alert comes down', () => {
  it('after a raid, opens the gate to the watch with the alert still up, and lowers it once each post has been held', () => {
    const { w, state, civilians } = gatehouse('t653-look');
    raidGone(w, state);
    checkFortressDefense(w, state);
    expect(w.game.world.fortress.alert, 'the alert stays up for the look').toBe('hearth');
    expect(state.looking).toBeDefined();
    expect(doorModes(w, state).every((m) => m === 'open'), 'the gate and the second line open for the watch').toBe(true);
    const since = state.looking!.since;
    checkFortressDefense(w, state);
    const squad = w.readers.of<CombatReader>('16').squad(state.squadId)!.members;
    expect(watchmen(w, state).sort(), 'the civilians not in the squad take the posts').toEqual(civilians.filter((id) => !squad.includes(id)).sort());
    expect(watchmen(w, state)).toHaveLength(2);
    play(w, state, LOOK_MAX_TICKS + 100, () => w.game.world.fortress.alert === 'calm');
    expect(w.game.world.fortress.alert).toBe('calm');
    expect(w.tick - since, 'each post is held LOOK_TICKS').toBeGreaterThanOrEqual(LOOK_TICKS);
    expect(w.tick - since, 'the watchmen reached their posts').toBeLessThan(LOOK_MAX_TICKS);
    expect(state.looking).toBeUndefined();
    expect(doorModes(w, state).every((m) => m === 'lock_on_alert'), 'the doors lock on the alert again').toBe(true);
    const ent = w.game.world.entities;
    const stations = (state.watch ?? []).map((wt) => w.readers.of<CombatReader>('16').squad(wt.squadId)!.station!);
    for (const id of watchmen(w, state)) {
      const p = ent.get(id, C.Position)!;
      expect(stations.some((s) => w.map.zOf(s) === p.z && Math.max(Math.abs(w.map.xOf(s) - p.x), Math.abs(w.map.yOf(s) - p.y)) <= 1), 'at its post').toBe(true);
    }
  });

  it('keeps the alert up and locks the gate again when the look finds an ambush', () => {
    const { w, state } = gatehouse('t653-found');
    raidGone(w, state);
    checkFortressDefense(w, state);
    expect(state.looking).toBeDefined();
    // An ambush by the gate, spotted by the watch: it has sprung.
    const ent = w.game.world.entities;
    const members = [0, 1, 2, 3].map((i) => {
      const id = w.spawnCreature('gloam_warrior', w.index(sx - 2 + i, sy - 4, Z), 'hostile:gloam');
      ent.add(id, C.Hostile, { partyId: 0, role: 'warrior', behaviorState: 'engage', stealthed: false, spotted: true, breakingDoorId: 0, breakingSince: 0 } as never);
      return id;
    });
    const party = ent.create('party');
    ent.add(party, C.Party, { civ: 'gloam', purpose: 'ambush', members, leaderId: members[0]!, state: 'engage', goalTile: -1, goalEntity: 0,
      arrivedTick: w.tick, stateSince: w.tick, loot: [], edge: 'n', size: 4, ambushSprung: true } as never);
    checkFortressDefense(w, state);
    expect(w.game.world.fortress.alert).toBe('hearth');
    expect(state.looking).toBeUndefined();
    expect(doorModes(w, state).every((m) => m === 'lock_on_alert')).toBe(true);
    checkFortressDefense(w, state);
    expect(watchmen(w, state), 'the watchmen go in').toEqual([]);
  });

  it('does not look after an alert for wild animals alone', () => {
    const { w, state } = gatehouse('t653-wild');
    w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' });
    state.lastDangerTick = w.tick - 1000;
    checkFortressDefense(w, state);
    expect(w.game.world.fortress.alert).toBe('calm');
    expect(state.looking).toBeUndefined();
  });

  it('does not order a watchman onto a post a tree has grown on, has the tree felled, and lowers the alert on the other post', () => {
    const { w, state } = gatehouse('t653-tree');
    const combat = w.readers.of<CombatReader>('16');
    const north = combat.squad(state.watch![0]!.squadId)!.station!;
    w.carve(north, TileKind.Tree);
    w.map.markChunkDirty(north, true, true);
    w.step(1);
    expect(w.readers.pathing.passable(north, 'walker')).toBe(false);
    raidGone(w, state);
    checkFortressDefense(w, state);
    expect(state.looking).toBeDefined();
    play(w, state, LOOK_MAX_TICKS + 100, () => w.game.world.fortress.alert === 'calm');
    expect(w.game.world.fortress.alert).toBe('calm');
    expect(w.map.designationAt(north), 'the tree on the post is to be felled').not.toBe(0);
    expect(combat.squad(state.watch![0]!.squadId)!.orders.some((o) => o.kind === 'station' && o.tile === north)).toBe(false);
  });
});

describe('T-732 the defence script locks its north door only after its own sally', () => {
  it('leaves the look the north door it opens, and locks it again after a sally', () => {
    const { w, state } = gatehouse('t732-north', false);
    const buildings = w.readers.of<BuildingsReader>('14');
    const north = state.gateDoorId2;
    const defence = { fortress: state, corridor: [], notes: [] } as unknown as DefenceYearState;
    const sets = (): number => scriptRecord(w).accepted.get('SetDoorMode') ?? 0;
    raidGone(w, state);
    checkFortressDefense(w, state);
    checkDefenceRaid(w, defence);
    expect(state.looking).toBeDefined();
    expect(doorModes(w, state).every((m) => m === 'open'), 'the look opens every gate door').toBe(true);
    // Through the look the two scripts send no door mode: the look holds the doors open.
    const before = sets();
    const end = w.tick + LOOK_MAX_TICKS + 100;
    while (w.tick < end && w.game.world.fortress.alert !== 'calm') {
      w.step(20);
      checkFortressDefense(w, state);
      if (state.looking !== undefined) {
        checkDefenceRaid(w, defence);
        expect(buildings.get(north)?.mode, 'the north door stays open for the look').toBe('open');
      }
    }
    expect(w.game.world.fortress.alert).toBe('calm');
    expect(sets() - before, "only the look's end locks the doors").toBe(doorModes(w, state).length);
    expect(defence.notes).toEqual([]);
    // A sally's end locks it on the alert again, with a note.
    w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' });
    expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: north, mode: 'open' }).ok).toBe(true);
    (defence as { sallying?: boolean }).sallying = true;
    checkDefenceRaid(w, defence);
    expect(buildings.get(north)?.mode).toBe('lock_on_alert');
    expect(defence.notes).toHaveLength(1);
    expect(defence.notes[0]).toContain('north door locks on the alert again');
  });
});
