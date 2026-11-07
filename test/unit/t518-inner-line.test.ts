import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { Designation, TileKind } from '@core/map3d';
import { contentRegistry } from '@content/loader';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { CombatReader } from '@systems/combat/reader';
import { ALERT_LOCK_GRACE_TICKS } from '@systems/defense/constants';
import { TestWorld } from '../scenarios/test-world';
import { HALL_Z, Z, checkFortressDefense, innerDoorTiles, innerLineBuilt, innerRingTiles, type FortressState } from '../scenarios/three_years_fortress';

/**
 * T-518: in `three-years-p4-3` a siege's trollkin broke the south gate door and the siege walked
 * down the stair into the halls: one locked door stood between the gate and the halls. The
 * three-year script now builds a second line at the stair's foot, as a player who has seen a siege
 * does: a door on each way out of it, locked on the alert, with a short way round so that the halls
 * behind it stay one place; it places a broken gate door again; and it waits for a siege behind the line.
 */
const cx = 40;
const cy = 40;
const sx = cx + 6;
const sy = cy + 6;

function gatehouse(seed: string, soldiersAt = { x: sx + 3, y: sy + 1, z: HALL_Z }): { w: TestWorld; state: FortressState; squadId: number } {
  const w = new TestWorld({ seed, registry: contentRegistry() });
  // The script's gatehouse: a stairwell walled east and west, a lock_on_alert door north and south.
  w.carve(w.index(sx, sy, Z), TileKind.StairsDown);
  for (let z = HALL_Z + 1; z < Z; z += 1) w.carve(w.index(sx, sy, z), TileKind.StairsUpDown);
  w.carve(w.index(sx, sy, HALL_Z), TileKind.StairsUp);
  // The halls: the dining hall west of the stair's foot, the hearth hall east, a corridor north and south.
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
  const soldiers = [0, 1, 2].map((i) => w.spawnDwarf({ at: w.index(soldiersAt.x + i, soldiersAt.y, soldiersAt.z) }));
  expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Gate Guard' }).ok).toBe(true);
  const squadId = w.readers.of<CombatReader>('16').squads()[0]!.id;
  expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: soldiers }).ok).toBe(true);
  w.step(1);
  const state = {
    cx, cy, z: Z, hallZ: HALL_Z, placedIds: {}, economy: { phases: new Set(['gate walls']), specialists: {} },
    gateDoorId: south, gateDoorPlaced: true, gateDoorId2: north, gateDoorPlaced2: true, gateWallLostTick: 0,
    squadId, answered: '', lastDangerTick: -1, shutOut: false,
  } as unknown as FortressState;
  return { w, state, squadId };
}

/** Each door the script placed is finished at once, as its builder would. */
function finishDoors(w: TestWorld, state: FortressState): void {
  const system = w.game.world.scheduler.byId('14') as BuildingsSystem;
  for (const id of state.innerDoorIds ?? []) if (id !== 0 && w.readers.of<BuildingsReader>('14').get(id)?.state !== 'built') system.completeNow(id, 0, 0);
}

describe('T-518 the three-year gatehouse has a second line at the stair\'s foot', () => {
  it('digs the way round first, then puts a door on each way out of the foot, locked on the alert', () => {
    const { w, state } = gatehouse('t518-line');
    const ring = innerRingTiles(w, state);
    checkFortressDefense(w, state);
    expect(ring.every((t) => w.map.designationAt(t) === Designation.Dig), 'the way round is designated').toBe(true);
    expect((state.innerDoorIds ?? []).every((id) => id === 0), 'no door before the way round is dug: it would cut the halls in four').toBe(true);

    for (const t of ring) w.carve(t, TileKind.Floor);
    checkFortressDefense(w, state);
    const buildings = w.readers.of<BuildingsReader>('14');
    expect(innerDoorTiles(w, state).map((t) => buildings.get(buildings.at(t))?.typeId)).toEqual(['door', 'door', 'door', 'door']);
    finishDoors(w, state);
    checkFortressDefense(w, state);
    expect(innerLineBuilt(w, state)).toBe(true);
    expect((state.innerDoorIds ?? []).map((id) => buildings.get(id)?.mode)).toEqual(['lock_on_alert', 'lock_on_alert', 'lock_on_alert', 'lock_on_alert']);

    // On the alert the foot is shut off from the halls, and the halls are still one place.
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(ALERT_LOCK_GRACE_TICKS + 30);
    const foot = w.index(sx, sy, HALL_Z);
    expect(w.reachable(foot, w.index(sx + 3, sy, HALL_Z)), 'the stair cannot reach the hearth hall').toBe(false);
    expect(w.reachable(w.index(sx - 4, sy, HALL_Z), w.index(sx + 3, sy, HALL_Z)), 'the dining hall reaches the hearth hall').toBe(true);
    expect(w.reachable(w.index(sx, sy + 6, HALL_Z), w.index(sx, sy - 5, HALL_Z)), 'the south corridor reaches the north one').toBe(true);
    // The dwarves behind the line are not shut out, though none is at the stair's foot: the alert stands.
    state.lastDangerTick = w.tick;
    checkFortressDefense(w, state);
    expect(state.shutOut).toBe(false);
    expect(w.game.world.fortress.alert).toBe('hearth');
  });

  it('lifts an alert that has left every dwarf outside the halls, one of them in the vestibule', () => {
    // The squad is out on the surface beyond the gate; a civilian is at the stair's foot.
    const { w, state } = gatehouse('t518-vestibule', { x: sx - 1, y: sy + 4, z: Z });
    for (const t of innerRingTiles(w, state)) w.carve(t, TileKind.Floor);
    checkFortressDefense(w, state);
    finishDoors(w, state);
    checkFortressDefense(w, state);
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(ALERT_LOCK_GRACE_TICKS + 30);
    w.spawnDwarf({ at: w.index(sx, sy, HALL_Z) });
    w.step(1);
    expect(w.reachable(w.index(sx, sy, HALL_Z), w.index(sx + 3, sy, HALL_Z)), 'the vestibule is shut').toBe(false);
    state.lastDangerTick = w.tick;
    checkFortressDefense(w, state);
    expect(state.shutOut, 'nobody is behind the second line').toBe(true);
    expect(w.game.world.fortress.alert).toBe('calm');
  });

  it('places a broken gate door and a broken inner door again', () => {
    const { w, state } = gatehouse('t518-rebuild');
    for (const t of innerRingTiles(w, state)) w.carve(t, TileKind.Floor);
    checkFortressDefense(w, state);
    finishDoors(w, state);
    const buildings = w.readers.of<BuildingsReader>('14');
    const system = w.game.world.scheduler.byId('14') as BuildingsSystem;
    const southGate = state.gateDoorId;
    const eastInner = state.innerDoorIds![1]!;
    system.buildings.remove(southGate);
    system.buildings.remove(eastInner);
    checkFortressDefense(w, state);
    expect(state.gateDoorId).not.toBe(southGate);
    expect(buildings.get(buildings.at(w.index(sx, sy + 1, Z)))?.typeId, 'the gate door is placed again').toBe('door');
    expect(state.innerDoorIds![1]).not.toBe(eastInner);
    expect(buildings.get(buildings.at(w.index(sx + 1, sy, HALL_Z)))?.typeId, 'the inner door is placed again').toBe('door');
  });

  it('meets a raid at the gate, and waits for a siege behind the line', () => {
    for (const purpose of ['raid', 'siege'] as const) {
      const { w, state, squadId } = gatehouse(`t518-${purpose}`);
      for (const t of innerRingTiles(w, state)) w.carve(t, TileKind.Floor);
      checkFortressDefense(w, state);
      finishDoors(w, state);
      const ent = w.game.world.entities;
      const raider = w.spawnCreature('gloam_warrior', w.index(5, 5, Z), 'hostile:gloam');
      const party = ent.create('party');
      ent.add(party, C.Party, { civ: 'gloam', purpose, members: [raider], leaderId: raider, state: 'approach', goalTile: -1, goalEntity: 0, arrivedTick: w.tick, stateSince: w.tick, loot: [], edge: 'n' } as never);
      checkFortressDefense(w, state);
      expect(w.game.world.fortress.alert).toBe('hearth');
      const station = w.readers.of<CombatReader>('16').squad(squadId)!.orders.find((o) => o.kind === 'station');
      const post = station?.kind === 'station' ? station.tile : -1;
      expect(post, purpose).toBe(purpose === 'raid' ? w.index(sx, sy, Z) : w.index(sx, sy + 2, HALL_Z));
    }
  });
});
