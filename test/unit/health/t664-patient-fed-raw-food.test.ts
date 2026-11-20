/**
 * T-664: a hungry patient is brought a meal, or, when no meal is to be had, any food a dwarf on its
 * feet would eat (17 § Patients and hospitals). `feed_patient` took only a meal, and in
 * `three-years-p4-1` at shift 50 three patients starved in their beds with seventy plants in stock.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

/** A patient with a broken bone at (10, 10), hungry, and the food lying at (30, 10). */
function hungryPatient(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  const patient = w.spawnDwarf({ at: w.index(10, 10, Z) });
  for (const l of w.game.registry.table<{ id: string }>('labors').ids()) w.setLabor(patient, l, false);
  for (const need of NEEDS) w.setNeed(patient, need, 0);
  world.emit({ type: 'DamageDealt', defenderId: patient, attackerId: 0, part: 'torso', damageType: 'blunt', amount: 20 });
  w.step(2);
  expect(world.entities.has(patient, C.Patient)).toBe(true);
  w.setNeed(patient, 'hunger', 80);
  /** A hauler, the labor that feeds a patient, on hauling alone. */
  const hauler = (): EntityId => {
    const id = w.spawnDwarf({ at: w.index(30, 12, Z) });
    for (const l of w.game.registry.table<{ id: string }>('labors').ids()) w.setLabor(id, l, l === 'hauling');
    for (const need of NEEDS) w.setNeed(id, need, 0);
    return id;
  };
  const jobs = w.readers.of<JobsReader>('11');
  const items = w.readers.of<ItemsReader>('13');
  const feed = () => jobs.byKey(`feed_patient:${patient}`);
  const fed = () => (world.entities.get(patient, C.Needs)?.hunger ?? 100) < 10;
  return { w, world, patient, hauler, jobs, items, feed, fed };
}

describe('T-664 a patient is fed raw food when no meal is to be had', () => {
  it('takes a plant when the fortress has no meal', () => {
    const a = hungryPatient('t664-raw');
    a.w.spawnItem('plant_food', 'turnip', a.w.index(30, 10, Z), 3);
    a.hauler();
    a.w.until(() => a.feed() !== undefined, 200);
    expect(a.feed()!.inputs[0]!.filter).toEqual({ edible: true });
    a.w.until(a.fed, 1200);
    expect(a.items.count('plant_food')).toBe(2);
  });

  it('takes a meal before a plant', () => {
    const a = hungryPatient('t664-meal');
    a.w.spawnItem('plant_food', 'turnip', a.w.index(30, 10, Z), 3);
    a.w.spawnItem('easy_meal', 'turnip', a.w.index(32, 10, Z), 1);
    a.hauler();
    a.w.until(() => a.feed() !== undefined, 200);
    expect(a.feed()!.inputs[0]!.filter).toEqual({ category: 'food/meal', edible: true });
    a.w.until(a.fed, 1200);
    expect(a.items.count('easy_meal')).toBe(0);
    expect(a.items.count('plant_food')).toBe(3);
  });

  it('a job waiting for a meal that is gone is made again for the plants', () => {
    const a = hungryPatient('t664-gone');
    const meal = a.w.spawnItem('easy_meal', 'turnip', a.w.index(32, 10, Z), 1);
    a.w.spawnItem('plant_food', 'turnip', a.w.index(30, 10, Z), 3);
    a.w.until(() => a.feed() !== undefined, 200);
    const first = a.feed()!.id;
    a.world.services.items!.destroy(meal, 'consumed');
    a.hauler();
    a.w.until(() => a.feed() !== undefined && a.feed()!.id !== first, 600);
    expect(a.feed()!.inputs[0]!.filter).toEqual({ edible: true });
    a.w.until(a.fed, 1200);
    expect(a.items.count('plant_food')).toBe(2);
  });
});
