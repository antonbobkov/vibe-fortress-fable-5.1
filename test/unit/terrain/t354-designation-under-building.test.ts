/** T-354: a building that blocks walking, built on a tile worked from itself, ends that tile's designation. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { Designation } from '@core/map3d';
import type { BuildingsSystem } from '@systems/buildings';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

describe('T-354 a chest built on a floor designated for smoothing', () => {
  const setup = (seed: string): { w: TestWorld; tile: number; system: BuildingsSystem } => {
    const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    w.digRoom(20, 20, Z - 3, 5, 5);
    for (let dy = -1; dy <= 5; dy += 1) for (let dx = -1; dx <= 5; dx += 1) w.discover(w.index(20 + dx, 20 + dy, Z - 3));
    const tile = w.index(22, 22, Z - 3);
    return { w, tile, system: w.game.world.scheduler.byId('14') as BuildingsSystem };
  };

  it('drops the smoothing designation and its job when the chest is built', () => {
    const { w, tile, system } = setup('t354-smooth');
    const world = w.game.world;
    expect(world.applyCommand({ type: 'Designate', tiles: [tile], kind: 'smooth', priority: 5 })).toEqual({ ok: true });
    w.step(2);
    const jobs = w.readers.of<JobsReader>('11');
    expect(jobs.byKey(`smooth:${tile}`)).toBeDefined();
    expect(world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chest', origin: tile, orientation: 0, materialChoice: 0 })).toEqual({ ok: true });
    const chest = system.lastPlacedBuilding;
    w.step(1);
    // A planned chest is passable: the designation stays until the chest is built.
    expect(w.map.designationAt(tile)).toBe(Designation.Smooth);
    system.completeNow(chest, w.game.registry.table('materials').index('oak'), 0);
    w.step(2);
    expect(w.map.designationAt(tile)).toBe(Designation.None);
    expect(jobs.byKey(`smooth:${tile}`)).toBeUndefined();
  });

  it('keeps a smoothing designation under a bed, which can be stood on', () => {
    const { w, tile, system } = setup('t354-bed');
    const world = w.game.world;
    expect(world.applyCommand({ type: 'Designate', tiles: [tile], kind: 'smooth', priority: 5 })).toEqual({ ok: true });
    expect(world.applyCommand({ type: 'PlaceBuilding', buildingType: 'bed', origin: tile, orientation: 0, materialChoice: 0 }).ok).toBe(true);
    system.completeNow(system.lastPlacedBuilding, w.game.registry.table('materials').index('oak'), 0);
    w.step(2);
    expect(w.map.designationAt(tile)).toBe(Designation.Smooth);
    expect(w.readers.of<JobsReader>('11').byKey(`smooth:${tile}`)).toBeDefined();
  });

  it('drops a smoothing designation made after the chest was built, with no job', () => {
    const { w, tile, system } = setup('t354-after');
    const world = w.game.world;
    expect(world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chest', origin: tile, orientation: 0, materialChoice: 0 })).toEqual({ ok: true });
    system.completeNow(system.lastPlacedBuilding, w.game.registry.table('materials').index('oak'), 0);
    const open = w.index(21, 21, Z - 3);
    expect(world.applyCommand({ type: 'Designate', tiles: [tile, open], kind: 'smooth', priority: 5 })).toEqual({ ok: true });
    w.step(2);
    const jobs = w.readers.of<JobsReader>('11');
    expect(w.map.designationAt(tile)).toBe(Designation.None);
    expect(jobs.byKey(`smooth:${tile}`)).toBeUndefined();
    expect(jobs.byKey(`smooth:${open}`)).toBeDefined();
  });
});
