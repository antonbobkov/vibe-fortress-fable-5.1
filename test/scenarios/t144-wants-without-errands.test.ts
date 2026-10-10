import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId, TileIndex } from '@core/types';
import { NEED_DEFER_PRIORITY } from '@systems/dwarves/constants';
import type { BuildingsReader } from '@systems/buildings';
import { WANT } from '@systems/dwarves/needs';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from './test-world';

/** One level of the flat test world, dug out below the surface. */
const Z = FLAT_TEST_SURFACE_Z - 7;
const DAYS = 10;
/** Eight hauls a day across the chamber keep the seven on a job for about 28% of their time. */
const LOGS_PER_DAY = 8;
const WANTS = ['social', 'comfort', 'joy'] as const;
type Want = typeof WANTS[number];

function rect(w: TestWorld, x: number, y: number, width: number, height: number): TileIndex[] {
  const out: TileIndex[] = [];
  for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) out.push(w.index(x + dx, y + dy, Z));
  return out;
}

/**
 * Seven dwarves in one dug chamber: a 7×7 hearth hall with four tables and eight chairs, meals and
 * barrels of ale beside it, and `LOGS_PER_DAY` logs each morning to haul to a wood pile at the
 * default priority, which is work for part of each day and none for the rest.
 */
function fortress(): { w: TestWorld; dwarves: EntityId[]; hall: EntityId } {
  const w = new TestWorld({ seed: 't144-wants', world: 'flat-test', embark: 'none' });
  w.digRoom(16, 16, Z, 40, 22);
  for (const tile of rect(w, 16, 16, 40, 22)) w.discover(tile);
  w.build('hearth', w.index(20, 20, Z), 'granite');
  for (const [tx, ty, chairs] of [
    [19, 19, [[18, 19], [19, 18]]], [21, 19, [[22, 19], [21, 18]]],
    [19, 21, [[18, 21], [19, 22]]], [21, 21, [[22, 21], [21, 22]]],
  ] as [number, number, [number, number][]][]) {
    w.build('table', w.index(tx, ty, Z), 'oak');
    for (const [cx, cy] of chairs) w.build('chair', w.index(cx, cy, Z), 'oak');
  }
  const hall = w.zone('hearth_hall', rect(w, 17, 17, 7, 7));
  const food = w.zone('stockpile', rect(w, 25, 19, 2, 2));
  w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: food, filter: 'food' });
  const drink = w.zone('stockpile', rect(w, 25, 22, 2, 2));
  w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: drink, filter: 'drink' });
  const wood = w.zone('stockpile', rect(w, 30, 26, 12, 10));
  w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: wood, filter: 'wood' });
  for (const tile of rect(w, 25, 19, 2, 2)) w.spawnItem('easy_meal', 'dimcap', tile, 15);
  for (const tile of rect(w, 25, 22, 2, 2)) {
    const barrel = w.spawnItem('barrel', 'pine', tile);
    w.spawnItem('drink', 'ale', { containerId: barrel }, 20);
  }
  const dwarves: EntityId[] = [];
  for (let i = 0; i < 7; i += 1) dwarves.push(w.spawnDwarf({ at: w.index(28 + i, 17, Z) }));
  return { w, dwarves, hall };
}

describe('T-144 wants without errands', () => {
  it('seven dwarves with a hall keep social, comfort and joy served and take no errand for them while work is open', () => {
    const { w, dwarves, hall } = fortress();
    const jobs = w.readers.of<JobsReader>('11');
    const activities = w.dwarves.activities;

    // Every start of a social, comfort or joy errand, with whether a job was open for the dwarf then.
    const errands: { id: EntityId; need: string; tick: number; workOpen: boolean }[] = [];
    const start = activities.start.bind(activities);
    activities.start = (ctx, id, need, ...rest) => {
      const workOpen = jobs.hasWork(id);
      const started = start(ctx, id, need, ...rest);
      if (started && (WANTS as readonly string[]).includes(need)) errands.push({ id, need, tick: ctx.tick, workOpen });
      return started;
    };

    const under = new Map<EntityId, Record<Want, number>>(dwarves.map((id) => [id, { social: 0, comfort: 0, joy: 0 }]));
    let samples = 0;
    let urgent = 0;
    let working = 0;
    for (let day = 0; day < DAYS; day += 1) {
      for (let k = 0; k < LOGS_PER_DAY; k += 1) w.spawnItem('log', 'oak', w.index(50 + (k % 4), 20 + day, Z));
      for (let tick = 0; tick < TICKS_PER_DAY; tick += 10) {
        w.step(10);
        samples += 1;
        for (const id of dwarves) {
          const n = w.game.world.entities.get(id, C.Needs);
          expect(n, `dwarf ${id} lives`).toBeDefined();
          if (n === undefined) continue;
          const row = under.get(id) as Record<Want, number>;
          for (const want of WANTS) if (n[want] < WANT[want]) row[want] += 1;
          if (jobs.hasUrgent(id, NEED_DEFER_PRIORITY)) urgent += 1;
          if ((w.game.world.entities.get(id, C.Worker)?.jobId ?? 0) !== 0) working += 1;
        }
      }
    }

    // The scenario's own premises: no urgent job, real work done, and wants served both ways.
    expect(urgent).toBe(0);
    expect(w.readers.of<BuildingsReader>('14').room(hall)).toMatchObject({ requirementsMet: true, tier: 2 });
    expect(w.events('JobCompleted').filter((e) => e['jobType'] === 'haul_to_stockpile').length).toBe(DAYS * LOGS_PER_DAY);
    expect(working / (samples * dwarves.length)).toBeGreaterThan(0.25);
    expect(errands.length).toBeGreaterThan(0);
    expect(w.events('MealEaten').some((e) => e['atTable'] === true)).toBe(true);

    expect(errands.filter((e) => e.workOpen)).toEqual([]);
    for (const id of dwarves) {
      const row = under.get(id) as Record<Want, number>;
      for (const want of WANTS) {
        expect(row[want] / samples, `dwarf ${id}: share of time with ${want} under its want threshold`).toBeGreaterThanOrEqual(0.7);
      }
    }
  });
});
