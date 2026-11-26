/**
 * T-777: with no hearth a `lock_on_alert` door read its outside as its outdoor neighbours only, so a
 * dwarf walking to it from a few tiles out did not hold it, and it locked on the alert's 20th tick in
 * front of the dwarf. With no hearth the outside of a corridor door is the whole side of its `outdoor`
 * neighbour, as the side away from the hearth is with one (19 § Hearth alert retreat).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_HOUR } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { ALERT_LOCK_GRACE_TICKS, ALERT_OUTSIDE_CLEAR_TICKS } from '@systems/defense/constants';
import type { DwarvesReader } from '@systems/dwarves';
import { TestWorld } from '../../scenarios/test-world';

const z = FLAT_TEST_SURFACE_Z;

/** A wall across the map at y = 20 with a `lock_on_alert` door at (40, 20), indoor tiles north of it, no hearth. */
function gate(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  const terrain = w.game.world.services.terrain;
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) terrain.setKind(w.index(x, 20, z), TileKind.Wall, granite);
  for (let y = 14; y < 20; y += 1) for (let x = 34; x < 47; x += 1) terrain.setFlag(w.index(x, y, z), TileFlag.Outdoor, false);
  const door = w.build('door', w.index(40, 20, z), 'oak');
  expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' }).ok).toBe(true);
  return { w, door };
}

const y = (w: TestWorld, id: EntityId): number => w.game.world.entities.get(id, C.Position)?.y ?? -1;

describe('T-777 with no hearth a door holds for a civilian walking in from a few tiles out', () => {
  it('a dwarf six tiles south of the door reaches its shelter before the door locks', () => {
    const { w, door } = gate('t777-walk');
    const walker = w.spawnDwarf({ at: w.index(40, 26, z), name: 'Liv Walking' });
    for (const need of ['thirst', 'hunger', 'rest'] as const) w.setNeed(walker, need, 0);
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    const locked = (): boolean => w.readers.of<BuildingsReader>('14').mechanismState(door) === 'locked';
    w.step(ALERT_OUTSIDE_CLEAR_TICKS + 10);
    expect(locked(), 'still open while the dwarf walks in').toBe(false);
    w.until(locked, ALERT_LOCK_GRACE_TICKS + TICKS_PER_HOUR);
    expect(locked()).toBe(true);
    expect(y(w, walker), 'inside, north of the wall').toBeLessThan(20);
    w.step(TICKS_PER_HOUR);
    expect(y(w, walker)).toBeLessThan(20);
    expect(w.readers.of<DwarvesReader>('10').unsheltered()).toEqual([]);
  });

  it('with no dwarf on the outer side the door still locks once its outside has been clear for 20 ticks', () => {
    const { w, door } = gate('t777-clear');
    const inside = w.spawnDwarf({ at: w.index(40, 16, z), name: 'Asa Inside' });
    for (const need of ['thirst', 'hunger', 'rest'] as const) w.setNeed(inside, need, 0);
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    const locked = (): boolean => w.readers.of<BuildingsReader>('14').mechanismState(door) === 'locked';
    w.until(locked, ALERT_OUTSIDE_CLEAR_TICKS + 3 * 10);
    expect(locked()).toBe(true);
  });
});
