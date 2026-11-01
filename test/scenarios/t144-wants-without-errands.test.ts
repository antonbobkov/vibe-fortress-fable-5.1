import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId, TileIndex } from '@core/types';
import { LEISURE_MARK, NEED_DEFER_PRIORITY } from '@systems/dwarves/constants';
import type { BuildingsReader } from '@systems/buildings';
import { WANT } from '@systems/dwarves/needs';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from './test-world';

/** One level of the flat test world, dug out below the surface. */
const Z = FLAT_TEST_SURFACE_Z - 7;
const DAYS = 10;
const WANTS = ['social', 'comfort', 'joy'] as const;
type Want = typeof WANTS[number];

function rect(w: TestWorld, x: number, y: number, width: number, height: number): TileIndex[] {
  const out: TileIndex[] = [];
  for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) out.push(w.index(x + dx, y + dy, Z));
  return out;
}

/**
 * Seven dwarves in one dug chamber: a 7×7 hearth hall with four tables and eight chairs, meals and
 * barrels of ale beside it, and a number of logs each morning to haul to a wood pile at the
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

interface Played {
  w: TestWorld; dwarves: EntityId[]; hall: EntityId; samples: number; urgent: number; working: number;
  under: Map<EntityId, Record<Want, number>>; atMark: Map<EntityId, Record<Want, number>>;
  errands: { id: EntityId; need: string; tick: number; workOpen: boolean }[];
  hallErrands: { id: EntityId; tick: number; workOpen: boolean; highest: number }[];
}

/** Ten days with `logsPerDay` hauls each morning, sampled every 10 ticks. */
function play(logsPerDay: number): Played {
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

    // Every hall errand taken before work, with the dwarf's highest of the three wants then.
    const hallErrands: { id: EntityId; tick: number; workOpen: boolean; highest: number }[] = [];
    const startHall = activities.startHallErrand.bind(activities);
    activities.startHallErrand = (ctx, id, ...rest) => {
      const workOpen = jobs.hasWork(id);
      const n = w.game.world.entities.get(id, C.Needs);
      const started = startHall(ctx, id, ...rest);
      if (started) hallErrands.push({ id, tick: ctx.tick, workOpen, highest: Math.max(n?.social ?? 0, n?.comfort ?? 0, n?.joy ?? 0) });
      return started;
    };

    const under = new Map<EntityId, Record<Want, number>>(dwarves.map((id) => [id, { social: 0, comfort: 0, joy: 0 }]));
    const atMark = new Map<EntityId, Record<Want, number>>(dwarves.map((id) => [id, { social: 0, comfort: 0, joy: 0 }]));
    let samples = 0;
    let urgent = 0;
    let working = 0;
    for (let day = 0; day < DAYS; day += 1) {
      for (let k = 0; k < logsPerDay; k += 1) w.spawnItem('log', 'oak', w.index(50 + (k % 4), 20 + day, Z));
      for (let tick = 0; tick < TICKS_PER_DAY; tick += 10) {
        w.step(10);
        samples += 1;
        for (const id of dwarves) {
          const n = w.game.world.entities.get(id, C.Needs);
          expect(n, `dwarf ${id} lives`).toBeDefined();
          if (n === undefined) continue;
          const row = under.get(id) as Record<Want, number>;
          for (const want of WANTS) if (n[want] < WANT[want]) row[want] += 1;
          for (const want of WANTS) if (n[want] >= LEISURE_MARK) (atMark.get(id) as Record<Want, number>)[want] += 1;
          if (jobs.hasUrgent(id, NEED_DEFER_PRIORITY)) urgent += 1;
          if ((w.game.world.entities.get(id, C.Worker)?.jobId ?? 0) !== 0) working += 1;
        }
      }
    }

    return { w, dwarves, hall, samples, urgent, working, under, atMark, errands, hallErrands };
}

/** The scenario's own premises: no urgent job, a decent hall, every haul done, meals at the tables. */
function premises(p: Played, logsPerDay: number): void {
  expect(p.urgent).toBe(0);
  expect(p.w.readers.of<BuildingsReader>('14').room(p.hall)).toMatchObject({ requirementsMet: true, tier: 2 });
  expect(p.w.events('JobCompleted').filter((e) => e['jobType'] === 'haul_to_stockpile').length).toBe(DAYS * logsPerDay);
  expect(p.w.events('MealEaten').some((e) => e['atTable'] === true)).toBe(true);
}

describe('T-144 wants without errands', () => {
  it('eight hauls a day: each want is under its threshold at least 70% of the time and no errand for it starts while work is open', () => {
    const p = play(8);
    premises(p, 8);
    // About 28% of the seven's time is on a job.
    expect(p.working / (p.samples * p.dwarves.length)).toBeGreaterThan(0.25);
    expect(p.errands.length).toBeGreaterThan(0);
    expect(p.errands.filter((e) => e.workOpen)).toEqual([]);
    // Whoever reaches the high mark at this workload takes the hall errand only with no work open.
    expect(p.hallErrands.filter((e) => e.workOpen)).toEqual([]);
    for (const id of p.dwarves) {
      const row = p.under.get(id) as Record<Want, number>;
      for (const want of WANTS) {
        expect(row[want] / p.samples, `dwarf ${id}: share of time with ${want} under its want threshold`).toBeGreaterThanOrEqual(0.7);
      }
    }
  });
});

describe('T-197 at a high mark one sit in the hearth hall comes before ordinary work', () => {
  it('twelve hauls a day: below the high mark the wants wait for work, at the mark one sit in the hall comes first', () => {
    const p = play(12);
    premises(p, 12);
    // About 41% of the seven's time is on a job.
    expect(p.working / (p.samples * p.dwarves.length)).toBeGreaterThan(0.35);
    // Below the mark no errand for the three starts while a job is open for the dwarf.
    expect(p.errands.filter((e) => e.workOpen)).toEqual([]);
    // At the mark one sit in the hall does start, work open or not, and never below it.
    expect(p.hallErrands.filter((e) => e.highest < LEISURE_MARK)).toEqual([]);
    expect(p.hallErrands.filter((e) => e.workOpen).length).toBeGreaterThan(0);
    // So no want stays at the mark: under 15% of the time for every dwarf and want.
    for (const id of p.dwarves) {
      const row = p.atMark.get(id) as Record<Want, number>;
      for (const want of WANTS) {
        expect(row[want] / p.samples, `dwarf ${id}: share of time with ${want} at the high mark`).toBeLessThan(0.15);
      }
    }
  });
});
