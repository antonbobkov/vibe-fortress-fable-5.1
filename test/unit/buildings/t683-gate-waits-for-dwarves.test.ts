/**
 * T-683: a `lock_on_alert` door waits for the dwarves outside it, not for tame animals (19 § Hearth alert
 * retreat). With grazers out by the wagon by day, one outside the gate held it open to the grace's end and
 * let raiders in behind the retreating dwarves.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import { ALERT_LOCK_GRACE_TICKS, ALERT_OUTSIDE_CLEAR_TICKS } from '@systems/defense/constants';
import type { BuildingsReader } from '@systems/buildings';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

function gate(seed: string): { w: TestWorld; door: number } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 20, Z), TileKind.Wall, granite);
  const door = w.build('door', w.index(40, 20, Z), 'oak');
  w.build('hearth', w.index(40, 28, Z), 'granite');
  w.step(1);
  expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' }).ok).toBe(true);
  return { w, door };
}

describe('T-683 the gate waits for dwarves, not for animals', () => {
  it('a cow standing outside does not hold the gate open', () => {
    const { w, door } = gate('t683-gate-cow');
    const cow = w.spawnTame('cow', w.index(40, 18, Z));
    w.game.world.entities.remove(cow, C.Brain);
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(ALERT_OUTSIDE_CLEAR_TICKS + 20);
    expect(w.readers.of<BuildingsReader>('14').mechanismState(door)).toBe('locked');
  });

  it('a dwarf standing outside still holds it open until the grace ends', () => {
    const { w, door } = gate('t683-gate-dwarf');
    const dwarf = w.spawnDwarf({ at: w.index(40, 18, Z) });
    w.game.world.entities.remove(dwarf, C.Brain);
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    const b = w.readers.of<BuildingsReader>('14');
    w.step(ALERT_OUTSIDE_CLEAR_TICKS + 20);
    expect(b.mechanismState(door)).not.toBe('locked');
    w.step(ALERT_LOCK_GRACE_TICKS);
    expect(b.mechanismState(door)).toBe('locked');
  });
});
