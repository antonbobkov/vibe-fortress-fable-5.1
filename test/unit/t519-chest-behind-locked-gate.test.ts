import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import { contentRegistry } from '@content/loader';
import { ALERT_LOCK_GRACE_TICKS } from '@systems/defense/constants';
import { TestWorld } from '../scenarios/test-world';
import { checkInvariants } from '../scenarios/invariants';
import { HALL_Z, Z, checkFortressDefense, type FortressState } from '../scenarios/three_years_fortress';

/**
 * T-519: in `three-years-p4-4` (shift 400) the hearth alert locked the three-year script's gate with
 * the fortress's last dwarf at a surface workshop, and the daily T-176 check met that moment: a chest
 * in the halls with nobody able to reach it (container.no-work-tile). The script lifted the alert on
 * the same tick (T-363) and the dwarf went back in. A container is lost only when it stays out of
 * every dwarf's reach for more than a day.
 */
function lockedOut(seed: string) {
  const w = new TestWorld({ seed, registry: contentRegistry() });
  const sx = 46;
  const sy = 46;
  // The script's gatehouse, as in T-363: a stairwell from the surface to the halls, walled on both
  // sides, a lock_on_alert door north and south of the stair, a room below with a chest of goods.
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
  const chestAt = w.index(sx, sy + 3, HALL_Z);
  w.discover(chestAt);
  const chest = w.build('chest', chestAt, 'oak');
  const goods = w.spawnItem('plant_food', 'barley', w.index(sx + 1, sy + 3, HALL_Z));
  expect(w.items.putIn(goods, w.game.world.entities.get(chest, C.Building)!.itemId)).toBe(true);
  w.step(1);
  return { w, sx, sy, south, north, chestAt };
}

describe('T-519 a chest cut off by a gate locked on an alert', () => {
  it('is not lost while the alert that shut the last dwarf out is lifted', () => {
    const { w, sx, sy, south, north } = lockedOut('t519-lifted');
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(ALERT_LOCK_GRACE_TICKS + 30);
    w.spawnDwarf({ at: w.index(sx, sy + 6, Z) });
    w.step(1);
    const names = (): string[] => checkInvariants(w.game).map((f) => f.inv);
    expect(names(), 'the moment the daily check met').not.toContain('container.no-work-tile');
    const state = {
      cx: 40, cy: 40, z: Z, hallZ: HALL_Z, placedIds: {}, economy: { phases: new Set(['gate walls']), specialists: {} },
      gateDoorId: south, gateDoorPlaced: true, gateDoorId2: north, gateDoorPlaced2: true,
      squadId: 0, answered: '', lastDangerTick: w.tick, shutOut: false,
    } as unknown as FortressState;
    checkFortressDefense(w, state);
    expect(w.game.world.fortress.alert, 'T-363 lifts the alert').toBe('calm');
    w.step(TICKS_PER_DAY + 1);
    expect(names()).not.toContain('container.no-work-tile');
  });

  it('is lost when the gate stays locked with every dwarf outside for more than a day', () => {
    const { w, sx, sy } = lockedOut('t519-kept');
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(ALERT_LOCK_GRACE_TICKS + 30);
    w.spawnDwarf({ at: w.index(sx, sy + 6, Z) });
    w.step(1);
    const names = (): string[] => checkInvariants(w.game).map((f) => f.inv);
    expect(names()).not.toContain('container.no-work-tile');
    w.step(TICKS_PER_DAY + 1);
    expect(names()).toContain('container.no-work-tile');
  });
});
