import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind, TileFlag } from '@core/map3d';
import type { DwarvesReader } from '@systems/dwarves';
import { TestWorld } from '../../scenarios/test-world';
import type { JobsReader, JobSink } from '@systems/jobs';

const Z = 32;

describe('T-M4-06 activities', () => {
  it('passes out at the current tile when rest reaches 100', () => {
    const w = new TestWorld({ seed: 'm4-pass-out', world: 'flat-test', embark: 'none' });
    const at = w.index(12, 12, Z);
    const id = w.spawnDwarf({ at });
    w.setNeed(id, 'rest', 100);
    w.step(1);
    expect(w.dwarves.activities.plans.get(id)?.target).toBe(at);
    expect(w.dwarves.activities.plans.get(id)?.itemId).toBe(0);
  });

  it('chooses a reachable meal before nearer raw food and consumes one unit', () => {
    const w = new TestWorld({ seed: 'm4-meal', world: 'flat-test', embark: 'none' });
    const id = w.spawnDwarf({ at: w.index(12, 12, Z) });
    w.spawnItem('plant_food', 'dimcap', w.index(12, 12, Z), 2);
    const meal = w.spawnItem('easy_meal', 'dimcap', w.index(13, 12, Z));
    w.setNeed(id, 'hunger', 55);
    w.step(1);
    expect(w.dwarves.activities.plans.get(id)?.itemId).toBe(meal);
    w.step(100);
    expect(w.events('MealEaten')).toMatchObject([{ type: 'MealEaten', id, kind: 'meal' }]);
    expect(w.dwarves.reader().need(id, 'hunger')).toBeLessThan(20);
  });

  it('uses alcohol, then a working well, then adjacent surface water', () => {
    const w = new TestWorld({ seed: 'm4-drink', world: 'flat-test', embark: 'none' });
    const at = w.index(60, 59, Z);
    const id = w.spawnDwarf({ at });
    const site = w.index(60, 60, Z);
    const water = w.index(60, 60, 29);
    for (const z of [30, 31, Z]) {
      w.carve(w.index(60, 60, z), TileKind.Open);
      w.map.setFlag(w.index(60, 60, z), TileFlag.Outdoor, true);
    }
    w.carve(water, TileKind.Floor);
    w.discover(site);
    w.setFluid(water, 5);
    w.build('well', site, 'granite');
    w.zone('stockpile', [at]);
    const barrel = w.spawnItem('barrel', 'oak', at);
    const drink = w.spawnItem('drink', 'ale', at, 2);
    expect(w.game.world.services.items?.putIn(drink, barrel)).toBe(true);
    w.setNeed(id, 'thirst', 55);
    w.step(1);
    expect(w.dwarves.activities.plans.get(id)?.itemId).toBeGreaterThan(0);
    w.step(80);
    expect(w.events('DrankAlcohol').some((e) => e['id'] === id)).toBe(true);
    w.setNeed(id, 'thirst', 55);
    w.step(2);
    expect(w.dwarves.activities.plans.get(id)?.itemId).toBeGreaterThan(0);
    // Consume the remaining drink, then the well is selected.
    w.step(80);
    w.setNeed(id, 'thirst', 55);
    w.step(2);
    expect(w.dwarves.activities.plans.get(id)?.itemId).toBe(0);
    expect(w.dwarves.activities.plans.get(id)?.target).toBe(at);
    w.step(100);
    expect(w.events('DrankWater').some((e) => e['id'] === id)).toBe(true);

    const bare = new TestWorld({ seed: 'm4-water', world: 'flat-test', embark: 'none' });
    const start = bare.index(12, 12, Z);
    const b = bare.spawnDwarf({ at: start });
    bare.setFluid(bare.index(13, 12, Z), 1, 'water', true);
    bare.setNeed(b, 'thirst', 55);
    bare.step(1);
    expect(bare.dwarves.activities.plans.get(b)?.target).toBe(start);
    bare.step(50);
    expect(bare.events('DrankWater').some((e) => e['id'] === b && e['outdoors'] === true)).toBe(true);
  });

  it('talks five times to make a friend and relieves both dwarves', () => {
    const w = new TestWorld({ seed: 'm4-friends', world: 'flat-test', embark: 'none' });
    const aa = w.index(12, 12, Z);
    const bb = w.index(13, 12, Z);
    w.zone('meeting_area', [aa, bb]);
    const a = w.spawnDwarf({ at: aa });
    const b = w.spawnDwarf({ at: bb });
    for (let k = 0; k < 6; k += 1) {
      w.setNeed(a, 'social', 55);
      w.setNeed(b, 'social', 55);
      w.step(105);
    }
    expect(w.events('Talked').length).toBeGreaterThanOrEqual(5);
    expect(w.readers.of<DwarvesReader>('10').isFriend(a, b)).toBe(true);
    expect(w.readers.of<DwarvesReader>('10').isFriend(b, a)).toBe(true);
  });

  it('a want level need waits behind a priority 1 job', () => {
    const w = new TestWorld({ seed: 'm4-priority', world: 'flat-test', embark: 'none' });
    const at = w.index(12, 12, Z);
    const id = w.spawnDwarf({ at });
    w.game.world.applyCommand({ type: 'SetLabor', dwarfId: id, labor: 'mining', on: true });
    w.spawnItem('pick', 'copper', at);
    w.spawnItem('plant_food', 'dimcap', at);
    const target = w.index(14, 12, Z);
    w.game.world.services.terrain.setKind(target, TileKind.Wall, w.game.registry.table('materials').index('granite'));
    const producer = { id: 'urgent-dig-test', done: false, produce(_ctx: unknown, sink: JobSink): void {
      if (this.done) return;
      this.done = true;
      sink.create('urgent-dig', { type: 'dig', target: { kind: 'tile', ref: target }, workTile: 'adjacent', priority: 1 });
    } };
    w.game.world.registrations.jobProducer(producer);
    w.step(2);
    expect(w.readers.of<JobsReader>('11').byKey('urgent-dig')).toBeDefined();
    w.setNeed(id, 'hunger', 55);
    w.step(2);
    expect(w.game.world.entities.get(id, C.Worker)?.jobId).toBeGreaterThan(0);
    expect(w.dwarves.activities.plans.has(id)).toBe(false);
  });
});
