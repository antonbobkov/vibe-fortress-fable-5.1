/**
 * T-530: the connectivity labels and the pathfinder agree on a door's lock on every tick. A
 * `lock_on_alert` door decided its lock from the tick (`ALERT_OUTSIDE_CLEAR_TICKS` after its outside
 * was clear, or `ALERT_LOCK_GRACE_TICKS` after the alert) and from its doorway, so it locked to the
 * pathfinder on whatever tick that came, while its chunks were dirtied only on 14's next tick, up to
 * nine ticks later: a doctor in the halls walking to a patient outside the gate failed his walk while
 * the labels still joined the two (the sweep's three-year seeds, 35 such health-job walks over 64 runs).
 * A door's lock now changes only where its chunks are dirtied.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import { ALERT_LOCK_GRACE_TICKS } from '@systems/defense/constants';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

function gateWorld(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 20, Z), TileKind.Wall, granite);
  const gate = w.index(40, 20, Z);
  const door = w.build('door', gate, 'oak');
  w.build('hearth', w.index(40, 28, Z), 'granite');
  w.step(1);
  return { w, door, gate, inside: w.index(40, 25, Z), outside: w.index(40, 15, Z) };
}

/** Each tick from now on, the labels join the two sides exactly when a search finds a way. */
function expectAgreement(w: TestWorld, inside: number, outside: number, ticks: number): { locked: number } {
  let locked = -1;
  for (let k = 0; k < ticks; k += 1) {
    w.step(1);
    const found = w.findPath(inside, outside) !== null;
    expect(w.reachable(inside, outside), `tick ${w.tick}: labels join while a search finds ${found ? 'a way' : 'none'}`).toBe(found);
    if (!found && locked < 0) locked = w.tick;
  }
  return { locked };
}

describe('T-530 a door locks to the labels and the pathfinder on the same tick', () => {
  for (const phase of [0, 3, 6]) {
    it(`a lock_on_alert door with a clear outside, alert raised at tick phase ${phase} of 14's cadence`, () => {
      const { w, door, inside, outside } = gateWorld(`t530-alert-${phase}`);
      expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' }).ok).toBe(true);
      while (w.tick % 10 !== phase) w.step(1);
      expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
      const { locked } = expectAgreement(w, inside, outside, 60);
      expect(locked, 'the door locked within the run').toBeGreaterThan(0);
    });
  }

  it('a lock_on_alert door held open by a dwarf in its doorway past the grace locks for both when it steps out', () => {
    const { w, door, gate, inside, outside } = gateWorld('t530-doorway');
    const guard = w.spawnDwarf({ at: gate });
    w.game.world.entities.remove(guard, C.Brain);
    expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(ALERT_LOCK_GRACE_TICKS + 20);
    expect(w.reachable(inside, outside)).toBe(true);
    while (w.tick % 10 !== 2) w.step(1);
    expect(w.game.movement.teleport(guard, w.index(40, 22, Z))).toBe(true);
    const { locked } = expectAgreement(w, inside, outside, 20);
    expect(locked).toBeGreaterThan(0);
  });

  it('a door locked by hand while a dwarf stands in it locks for both when it steps out', () => {
    const { w, door, gate, inside, outside } = gateWorld('t530-by-hand');
    const guard = w.spawnDwarf({ at: gate });
    w.game.world.entities.remove(guard, C.Brain);
    expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'locked' }).ok).toBe(true);
    w.step(20);
    expect(w.reachable(inside, outside)).toBe(true);
    while (w.tick % 10 !== 2) w.step(1);
    expect(w.game.movement.teleport(guard, w.index(40, 22, Z))).toBe(true);
    const { locked } = expectAgreement(w, inside, outside, 20);
    expect(locked).toBeGreaterThan(0);
  });
});
