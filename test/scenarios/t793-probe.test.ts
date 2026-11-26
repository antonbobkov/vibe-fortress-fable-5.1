/** T-793 probe (not merged): the three-year script at peril 2 for six years; idle share, `restless` mean and deaths by year. */
import { describe, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { TICKS_PER_DAY, DAYS_PER_YEAR } from '@core/constants';
import { C } from '@core/components';
import type { MoraleReader } from '@systems/morale/reader';
import { playThreeYears, setupThreeYearsFortress, threeYearsWorld, checkFortressWorkOrders, checkFortressRooms,
  checkFortressCaveFarm, checkFortressDefense } from './three_years_fortress';

const OUT = 'out/t793';
const YEARS = 6;
const DAYS = Number(process.env['T793_DAYS'] ?? YEARS * DAYS_PER_YEAR);

interface YearRow {
  year: number; samples: number; popMean: number; idleShare: number; leisureShare: number;
  restlessMean: number; restlessHolders: number; moodMean: number; dwarfDeaths: number; endPop: number;
}

function drive(seed: string, peril: number): void {
  mkdirSync(OUT, { recursive: true });
  const w = threeYearsWorld(seed, peril);
  const state = setupThreeYearsFortress(w);
  const rows: YearRow[] = [];
  let deaths = 0;
  w.game.world.onEvents((events) => {
    for (const e of events) {
      if (e.type === 'CreatureDied' && (e as unknown as { faction?: string }).faction === 'fortress') deaths += 1;
    }
  });
  const morale = (): MoraleReader => w.readers.of<MoraleReader>('15');
  const acc = { samples: 0, pop: 0, idle: 0, leisure: 0, restless: 0, holders: 0, mood: 0, dwarfSamples: 0 };
  const sample = (): void => {
    const ent = w.game.world.entities;
    const dwarves = ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress');
    acc.samples += 1;
    acc.pop += dwarves.length;
    for (const id of dwarves) {
      const activity = ent.get(id, C.Brain)?.activity ?? '';
      if (activity === '' || activity === 'No job') acc.idle += 1;
      if (activity === 'social' || activity === 'comfort' || activity === 'joy') acc.leisure += 1;
      const r = morale().thoughts(id).find((t) => t.id === 'restless');
      if (r !== undefined) { acc.restless += r.value; acc.holders += 1; }
      acc.mood += morale().mood(id);
      acc.dwarfSamples += 1;
    }
  };
  const t0 = Date.now();
  for (let day = 1; day <= DAYS; day++) {
    const end = day * TICKS_PER_DAY;
    while (w.tick < end) {
      playThreeYears(w, state, Math.min(day <= 20 ? 100 : 300, end - w.tick));
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
      sample();
    }
    if (day % DAYS_PER_YEAR === 0 || day === DAYS) {
      const ent = w.game.world.entities;
      const n = Math.max(1, acc.dwarfSamples);
      rows.push({
        year: Math.ceil(day / DAYS_PER_YEAR), samples: acc.samples, popMean: +(acc.pop / Math.max(1, acc.samples)).toFixed(1),
        idleShare: +(acc.idle / n).toFixed(3), leisureShare: +(acc.leisure / n).toFixed(3),
        restlessMean: +(acc.restless / n).toFixed(3), restlessHolders: +(acc.holders / n).toFixed(3),
        moodMean: +(acc.mood / n).toFixed(1), dwarfDeaths: deaths,
        endPop: ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress').length,
      });
      deaths = 0;
      Object.assign(acc, { samples: 0, pop: 0, idle: 0, leisure: 0, restless: 0, holders: 0, mood: 0, dwarfSamples: 0 });
      console.log(`${seed} ${JSON.stringify(rows[rows.length - 1])} (${Math.round((Date.now() - t0) / 1000)} s)`);
      writeFileSync(`${OUT}/${seed}.json`, JSON.stringify({ seed, peril, rows }, null, 1));
    }
  }
}

describe('t793a (M probe)', () => {
  it('six years, playtest-1126-p2 at peril 2', () => drive('playtest-1126-p2', 2), 18_000_000);
});
describe('t793b (M probe)', () => {
  it('six years, three-years-p2-3 at peril 2', () => drive('three-years-p2-3', 2), 18_000_000);
});
