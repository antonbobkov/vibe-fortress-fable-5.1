/**
 * T-666: a thirsty patient is brought a drink, or, when no drink is to be had, water in a bucket
 * filled at a working well or at water a dwarf could drink from (17 § Patients and hospitals).
 * `water_patient` took only a drink, so in a fortress with no drink its patients went thirsty in
 * their beds while their fellows drank at the brook.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

/** A patient with a broken bone at (10, 10), thirsty. */
function thirstyPatient(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  const patient = w.spawnDwarf({ at: w.index(10, 10, Z) });
  for (const l of w.game.registry.table<{ id: string }>('labors').ids()) w.setLabor(patient, l, false);
  for (const need of NEEDS) w.setNeed(patient, need, 0);
  world.emit({ type: 'DamageDealt', defenderId: patient, attackerId: 0, part: 'torso', damageType: 'blunt', amount: 20 });
  w.step(2);
  expect(world.entities.has(patient, C.Patient)).toBe(true);
  w.setNeed(patient, 'thirst', 80);
  /** A hauler, the labor that waters a patient, on hauling alone. */
  const hauler = (): EntityId => {
    const id = w.spawnDwarf({ at: w.index(30, 12, Z) });
    for (const l of w.game.registry.table<{ id: string }>('labors').ids()) w.setLabor(id, l, l === 'hauling');
    for (const need of NEEDS) w.setNeed(id, need, 0);
    return id;
  };
  /** A working well at (20, 20) over water two levels down. */
  const well = (): void => {
    const site = w.index(20, 20, Z);
    for (const z of [Z - 2, Z - 1, Z]) {
      w.carve(w.index(20, 20, z), TileKind.Open);
      w.map.setFlag(w.index(20, 20, z), TileFlag.Outdoor, true);
    }
    w.carve(w.index(20, 20, Z - 3), TileKind.Floor);
    w.setFluid(w.index(20, 20, Z - 3), 5);
    w.discover(site);
    w.build('well', site, 'granite');
  };
  const jobs = w.readers.of<JobsReader>('11');
  const items = w.readers.of<ItemsReader>('13');
  const water = () => jobs.byKey(`water_patient:${patient}`);
  const watered = () => (world.entities.get(patient, C.Needs)?.thirst ?? 100) < 10;
  return { w, world, patient, hauler, well, jobs, items, water, watered };
}

describe('T-666 a patient is brought water when no drink is to be had', () => {
  it('a hauler brings a bucket of water from the well when the fortress has no drink', () => {
    const a = thirstyPatient('t666-well');
    a.well();
    a.w.spawnItem('bucket', 'oak', a.w.index(30, 10, Z));
    a.hauler();
    a.w.until(() => a.water() !== undefined, 200);
    expect(a.water()!.inputs).toEqual([]);
    expect(a.water()!.tool).toBe('bucket');
    a.w.until(a.watered, 1200);
    expect(a.watered()).toBe(true);
    expect(a.items.count('bucket'), 'the bucket is kept').toBe(1);
  });

  it('a drink is brought before water', () => {
    const a = thirstyPatient('t666-drink');
    a.well();
    a.w.spawnItem('bucket', 'oak', a.w.index(30, 10, Z));
    a.w.spawnItem('drink', 'ale', a.w.index(32, 10, Z), 2);
    a.hauler();
    a.w.until(() => a.water() !== undefined, 200);
    expect(a.water()!.inputs[0]!.filter).toEqual({ category: 'drink' });
    a.w.until(a.watered, 1200);
    expect(a.items.count('drink')).toBe(1);
  });

  it('with no water to fill it the bucket is not taken, and the job waits for a drink', () => {
    const a = thirstyPatient('t666-dry');
    a.w.spawnItem('bucket', 'oak', a.w.index(30, 10, Z));
    a.hauler();
    a.w.until(() => a.water() !== undefined, 200);
    expect(a.water()!.inputs[0]!.filter).toEqual({ category: 'drink' });
    a.w.step(300);
    expect(a.watered()).toBe(false);
  });

  it('a job waiting for a drink that is gone is made again for a bucket of water', () => {
    const a = thirstyPatient('t666-gone');
    a.well();
    const drink = a.w.spawnItem('drink', 'ale', a.w.index(32, 10, Z), 1);
    a.w.spawnItem('bucket', 'oak', a.w.index(30, 10, Z));
    a.w.until(() => a.water() !== undefined, 200);
    const first = a.water()!.id;
    a.world.services.items!.destroy(drink, 'consumed');
    a.hauler();
    a.w.until(() => a.water() !== undefined && a.water()!.id !== first, 600);
    expect(a.water()!.tool).toBe('bucket');
    a.w.until(a.watered, 1200);
    expect(a.watered()).toBe(true);
  });
});
