/** T-802 probe (not merged): the three-year script for six years; threats met, deaths and living by year. */
import { describe, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { TICKS_PER_DAY, DAYS_PER_YEAR } from '@core/constants';
import { C } from '@core/components';
import type { ThreatsReader } from '@systems/threats/reader';
import { playThreeYears, setupThreeYearsFortress, threeYearsWorld, checkFortressWorkOrders, checkFortressRooms,
  checkFortressCaveFarm, checkFortressDefense } from './three_years_fortress';

const OUT = 'out/t802';
const YEARS = 6;
const DAYS = Number(process.env['T802_DAYS'] ?? YEARS * DAYS_PER_YEAR);

interface YearRow {
  year: number; raids: number; raidSizes: number[]; sieges: number; siegeSizes: number[]; ambushes: number;
  bandits: number; thieves: number; dwarfDeaths: number; living: number; renownEnd: number; renownMax: number;
  schedulePeril: number | null; loot: number;
}

function drive(seed: string, peril: number): void {
  mkdirSync(OUT, { recursive: true });
  const w = threeYearsWorld(seed, peril);
  const state = setupThreeYearsFortress(w);
  const rows: YearRow[] = [];
  const blank = (): Omit<YearRow, 'year' | 'living' | 'renownEnd' | 'schedulePeril'> => ({
    raids: 0, raidSizes: [], sieges: 0, siegeSizes: [], ambushes: 0, bandits: 0, thieves: 0, dwarfDeaths: 0, renownMax: 0, loot: 0,
  });
  let acc = blank();
  const ent = w.game.world.entities;
  w.game.world.onEvents((events) => {
    for (const e of events) {
      const r = e as unknown as Record<string, unknown>;
      if (e.type === 'CreatureDied' && ent.has(Number(r['id']), C.Labors)) acc.dwarfDeaths += 1;
      if (e.type === 'RaidArrived') {
        const kind = String(r['kind']);
        const size = Number(r['size']);
        if (kind === 'raid') { acc.raids += 1; acc.raidSizes.push(size); }
        else if (kind === 'siege') { acc.sieges += 1; acc.siegeSizes.push(size); }
        else if (kind === 'bandits') acc.bandits += 1;
        else if (kind === 'thief') acc.thieves += 1;
      }
      if (e.type === 'AmbushSprung') acc.ambushes += 1;
      if (e.type === 'RaidEnded' && r['outcome'] === 'looted') acc.loot += 1;
    }
  });
  const threats = (): ThreatsReader => w.readers.of<ThreatsReader>('18');
  const t0 = Date.now();
  for (let day = 1; day <= DAYS; day++) {
    const end = day * TICKS_PER_DAY;
    while (w.tick < end) {
      playThreeYears(w, state, Math.min(day <= 20 ? 100 : 300, end - w.tick));
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
    }
    acc.renownMax = Math.max(acc.renownMax, threats().renown());
    if (day % DAYS_PER_YEAR === 0 || day === DAYS) {
      const sp = (threats() as unknown as { schedulePeril?: () => number }).schedulePeril;
      rows.push({
        year: Math.ceil(day / DAYS_PER_YEAR), ...acc,
        living: ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress').length,
        renownEnd: +threats().renown().toFixed(1), renownMax: +acc.renownMax.toFixed(1),
        schedulePeril: sp ? sp() : null,
      });
      acc = blank();
      console.log(`${seed} p${peril} ${JSON.stringify(rows[rows.length - 1])} (${Math.round((Date.now() - t0) / 1000)} s)`);
      writeFileSync(`${OUT}/${seed}-p${peril}.json`, JSON.stringify({ seed, peril, rows }, null, 1));
    }
  }
}

describe('t802a (M probe)', () => {
  it('six years, playtest-1126-p2 at peril 2', () => drive('playtest-1126-p2', 2), 18_000_000);
});
describe('t802b (M probe)', () => {
  it('six years, three-years-p2-3 at peril 2', () => drive('three-years-p2-3', 2), 18_000_000);
});
describe('t802c (M probe)', () => {
  it('six years, playtest-1126-p2 at peril 3', () => drive('playtest-1126-p2', 3), 18_000_000);
});
describe('t802d (M probe)', () => {
  it('six years, three-years-p2-3 at peril 3', () => drive('three-years-p2-3', 3), 18_000_000);
});
