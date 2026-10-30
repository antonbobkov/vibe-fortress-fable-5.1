import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import { contentRegistry } from '@content/loader';
import { ALERT_LOCK_GRACE_TICKS } from '@systems/defense/constants';
import { TestWorld } from '../scenarios/test-world';
import { HALL_Z, Z, checkFortressDefense, type FortressState } from '../scenarios/three_years_fortress';

/**
 * T-363: in `three-years-p2-5` (before T-356) wolves kept the three-year script's hearth alert up
 * for good, its gate locked with all seven dwarves outside, and the hospital chest below was out
 * of every dwarf's reach (container.no-work-tile) for the rest of the run. The script now lifts an
 * alert that has locked every dwarf out, and raises one again only once a dwarf is below ground.
 */
describe('T-363 the three-year script lifts an alert that locks every dwarf out', () => {
  it('lifts it, keeps it lifted while all are outside, and raises it again once a dwarf is below', () => {
    const w = new TestWorld({ seed: 't363', registry: contentRegistry() });
    const cx = 40;
    const cy = 40;
    const sx = cx + 6;
    const sy = cy + 6;
    // The script's gatehouse: a stairwell from the surface to the halls, walled on both sides,
    // a lock_on_alert door north and south of the stair.
    w.carve(w.index(sx, sy, Z), TileKind.StairsDown);
    for (let z = HALL_Z + 1; z < Z; z += 1) w.carve(w.index(sx, sy, z), TileKind.StairsUpDown);
    w.carve(w.index(sx, sy, HALL_Z), TileKind.StairsUp);
    w.digRoom(sx - 2, sy + 1, HALL_Z, 5, 4);
    for (const [x, y] of [[sx - 1, sy - 1], [sx + 1, sy - 1], [sx - 1, sy], [sx + 1, sy], [sx - 1, sy + 1], [sx + 1, sy + 1]] as const) {
      w.build('wall', w.index(x, y, Z));
    }
    const south = w.build('door', w.index(sx, sy + 1, Z));
    const north = w.build('door', w.index(sx, sy - 1, Z));
    for (const id of [south, north]) expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: id, mode: 'lock_on_alert' }).ok).toBe(true);
    w.step(1);

    // The alert is up with nobody inside: the doors lock once the grace is over.
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(ALERT_LOCK_GRACE_TICKS + 30);
    const doorTile = w.index(sx, sy + 1, Z);
    expect(w.readers.pathing.passable(doorTile, 'walker', { faction: 'fortress' }), 'the gate is locked').toBe(false);

    // Every dwarf is outside the locked gate, and a wolf is near one of them.
    const outside = w.spawnDwarf({ at: w.index(sx, sy + 6, Z) });
    w.spawnCreature('wolf', w.index(sx, sy + 14, Z), 'wild');
    w.step(1);
    const state = {
      cx, cy, z: Z, hallZ: HALL_Z, placedIds: {}, economy: { phases: new Set(['gate walls']), specialists: {} },
      gateDoorId: south, gateDoorPlaced: true, gateDoorId2: north, gateDoorPlaced2: true,
      squadId: 0, answered: '', lastDangerTick: w.tick, shutOut: false,
    } as unknown as FortressState;

    checkFortressDefense(w, state);
    expect(w.game.world.fortress.alert, 'the alert that shut everybody out is lifted').toBe('calm');
    w.step(1);
    expect(w.readers.pathing.passable(doorTile, 'walker', { faction: 'fortress' }), 'the gate opens').toBe(true);

    // The wolf is still near, but nobody is below ground: the alert stays down.
    w.step(20);
    checkFortressDefense(w, state);
    expect(w.game.world.fortress.alert).toBe('calm');

    // A dwarf below ground: the danger raises the alert again.
    w.spawnDwarf({ at: w.index(sx, sy + 2, HALL_Z) });
    w.step(1);
    checkFortressDefense(w, state);
    expect(w.game.world.fortress.alert, 'the alert is raised again with a dwarf below').toBe('hearth');
    expect(w.game.world.entities.get(outside, C.Creature)?.faction).toBe('fortress');
  });
});
