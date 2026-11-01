import { checkInvariants, watchInvariants } from '../scenarios/invariants';
import { threeYearsMeasurements } from '../scenarios/three_years_measurements';
/**
 * 20-seed sweep across three regions (peril 0, 2, 4) for T-M8-06 (DECISIONS D-204).
 *
 * Runs the full 3-year fortress simulation across 20 seeds:
 * - 7 seeds at Peril 0 (serene_vale peaceful baseline)
 * - 7 seeds at Peril 2 (moderate danger: ambushes in Y1, raids in Y2-Y3)
 * - 6 seeds at Peril 4 (high danger: early thieves/raids, sieges in Y2)
 *
 * Placed in the performance tier (test:perf) as year_one_seeds is, keeping the standard
 * scenario suite runtime reasonable while verifying balance and deterministic guarantees.
 */

import { describe, it, expect } from 'vitest';
import { DAYS_PER_YEAR, TICKS_PER_DAY, POPULATION_CAP_DEFAULT, MOOD_MIN } from '@core/constants';
import { C } from '@core/components';
import { NEED_PRESSURE_CAP, MOOD_NEEDS_MET_FLOOR } from '@systems/morale/mood';
import { WAVE_MAX } from '@systems/immigration/constants';
import type { ItemsReader } from '@systems/items';
import type { MoraleReader } from '@systems/morale/reader';
import type { ThreatsReader } from '@systems/threats/reader';
import { deathCounts } from '../scenarios/death-counts';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  playThreeYears,
  setupThreeYearsFortress,
  checkFortressWorkOrders,
  checkFortressRooms,
  checkFortressCaveFarm,
  checkFortressDefense,
  threeYearsWorld,
  fortressWitnesses,
} from '../scenarios/three_years_fortress';
import { scriptRecord } from '../scenarios/script-commands';
import { CrowdWatch, type CrowdFigures } from '../scenarios/crowd-watch';

export interface SeedConfig {
  readonly seed: string;
  readonly peril: number;
}

export const THREE_YEARS_20_SEEDS: readonly SeedConfig[] = [
  // 7 seeds at Peril 0
  { seed: 'three-years-p0-1', peril: 0 },
  { seed: 'three-years-p0-2', peril: 0 },
  { seed: 'three-years-p0-3', peril: 0 },
  { seed: 'three-years-p0-4', peril: 0 },
  { seed: 'three-years-p0-5', peril: 0 },
  { seed: 'three-years-p0-6', peril: 0 },
  { seed: 'three-years-p0-7', peril: 0 },
  // 7 seeds at Peril 2
  { seed: 'three-years-p2-1', peril: 2 },
  { seed: 'three-years-p2-2', peril: 2 },
  { seed: 'three-years-p2-3', peril: 2 },
  { seed: 'three-years-p2-4', peril: 2 },
  { seed: 'three-years-p2-5', peril: 2 },
  { seed: 'three-years-p2-6', peril: 2 },
  { seed: 'three-years-p2-7', peril: 2 },
  // 6 seeds at Peril 4
  { seed: 'three-years-p4-1', peril: 4 },
  { seed: 'three-years-p4-2', peril: 4 },
  { seed: 'three-years-p4-3', peril: 4 },
  { seed: 'three-years-p4-4', peril: 4 },
  { seed: 'three-years-p4-5', peril: 4 },
  { seed: 'three-years-p4-6', peril: 4 },
] as const;

/**
 * The set rule (testing-strategy.md § What may be a gate): one seed's survival flips under changes
 * that do not aim at it, so the file asserts survival over the whole set and each seed prints its own.
 */
export const SET_ALIVE_AT_YEAR_ONE = 18;
export const SET_PERIL_ZERO_GROWN = 6;
/** Of the peril-0 seeds, how many may have a dwarf die of hunger or thirst. */
export const SET_PERIL_ZERO_NEED_DEATHS = 1;
/** Founders: a peril-0 fortress has grown when it ends year 3 above this. */
const EMBARK_SIZE = 7;

const survival: { seed: string; peril: number; y1Pop: number; y3Pop: number; needDeaths: number }[] = [];

export interface ThreeYearsSeedResult {
  readonly seed: string;
  readonly peril: number;
  readonly y1Pop: number;
  readonly y2Pop: number;
  readonly y3Pop: number;
  readonly y1Wealth: number;
  readonly y2Wealth: number;
  readonly y3Wealth: number;
  readonly dwarfDeaths: number;
  readonly tameDeaths: number;
  readonly wavesCount: number;
  readonly totalImmigrants: number;
  readonly nonGuaranteedWaves: number;
  readonly raidsCount: number;
  readonly mealsEaten: number;
  readonly drinksDrunk: number;
  readonly drinksAlcohol: number;
  readonly drinksWater: number;
  readonly extinctDay: number | null;
  readonly avgMood: string;
  readonly minMood: number;
  readonly maxMood: number;
  readonly moodBreakdown?: Record<string, number>;
  readonly deathsList: readonly { day: number; cause: string; killerId?: number }[];
  readonly raidsList: readonly { day: number; kind: string; size: number; partyId: number; outcome?: string }[];
  readonly hallSpirit: { y1: number; y2: number; y3: number };
  readonly renown: { y1: number; y2: number; y3: number };
  readonly mealsPerDwarfDay: string;
  readonly drinksPerDwarfDay: string;
  readonly crowds: { readonly doors: CrowdFigures; readonly hall: CrowdFigures };
}

export function runThreeYearsSeed(seed: string, peril: number): ThreeYearsSeedResult {
  const w = threeYearsWorld(seed, peril);
  // Kept (T-334): the T-176 invariants hold in every state of the game, whatever the order of jobs.
  const stopInvariants = peril === 2 || peril === 4
    ? watchInvariants(w.game, (findings) => expect(findings, `T-176 ${seed} tick ${w.tick}`).toEqual([]))
    : () => {};
  const state = setupThreeYearsFortress(w);

  // Advance bootstrap period (20 days)
  const totalTicksBootstrap = 20 * TICKS_PER_DAY;
  while (w.tick < totalTicksBootstrap) {
    playThreeYears(w, state, Math.min(100, totalTicksBootstrap - w.tick));
    checkFortressWorkOrders(w, state);
    checkFortressRooms(w, state);
    checkFortressCaveFarm(w, state);
    checkFortressDefense(w, state);
  }

  // Tracking
  const waves: { day: number; count: number; guaranteed: boolean }[] = [];
  const raids: { day: number; kind: string; size: number; partyId: number; outcome?: string }[] = [];
  const deathsList: { day: number; cause: string; killerId?: number }[] = [];
  let mealsEaten = 0;
  let drinksDrunk = 0;
  let drinksAlcohol = 0;
  let drinksWater = 0;

  const dwarfSpecies = w.game.registry.table('creatures').index('dwarf');

  const unsub = w.game.world.onEvents((events) => {
    const day = Math.floor(w.tick / TICKS_PER_DAY) + 1;
    for (const e of events) {
      if (e.type === 'ImmigrantsArrived') {
        waves.push({ day, count: Number(e['count'] ?? 0), guaranteed: e['guaranteed'] === true });
      } else if (e.type === 'RaidArrived') {
        raids.push({ day, kind: String(e['kind'] ?? 'raid'), size: Number(e['size'] ?? 0), partyId: Number(e['partyId'] ?? 0) });
      } else if (e.type === 'RaidEnded') {
        const r = raids.find((x) => x.partyId === Number(e['partyId']) && !x.outcome);
        if (r) r.outcome = String(e['outcome']);
      } else if (e.type === 'MealEaten') {
        mealsEaten += 1;
      } else if (e.type === 'DrankAlcohol') {
        drinksAlcohol += 1;
        drinksDrunk += 1;
      } else if (e.type === 'DrankWater') {
        drinksWater += 1;
        drinksDrunk += 1;
      } else if (e.type === 'CreatureDied') {
        if (e['species'] === dwarfSpecies || (e['faction'] === 'fortress' && e['species'] === undefined)) {
          deathsList.push({ day, cause: String(e['cause'] ?? 'unknown'), killerId: Number(e['killerId'] ?? 0) });
        }
      }
    }
  });

  const crowdWatch = new CrowdWatch(w);
  const totalTicks = 3 * DAYS_PER_YEAR * TICKS_PER_DAY;
  const year1Tick = DAYS_PER_YEAR * TICKS_PER_DAY;
  const year2Tick = 2 * DAYS_PER_YEAR * TICKS_PER_DAY;

  let y1Wealth = 0;
  let y2Wealth = 0;
  let y3Wealth = 0;
  let y1Pop = 0;
  let y2Pop = 0;
  let y3Pop = 0;
  let y1Spirit = 0;
  let y2Spirit = 0;
  let y3Spirit = 0;
  let y1Renown = 0;
  let y2Renown = 0;
  let y3Renown = 0;
  let extinctDay: number | null = null;

  const items = w.readers.of<ItemsReader>('13');
  const morale = w.readers.of<MoraleReader>('15');
  const threats = w.readers.of<ThreatsReader>('18');

  while (w.tick < totalTicks) {
    const living = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress');
    if (w.tick > totalTicksBootstrap && living.length === 0 && extinctDay === null) {
      extinctDay = Math.floor(w.tick / TICKS_PER_DAY) + 1;
    }

    playThreeYears(w, state, Math.min(300, totalTicks - w.tick), () => crowdWatch.sample());
    checkFortressWorkOrders(w, state);
    checkFortressRooms(w, state);
    checkFortressCaveFarm(w, state);
    checkFortressDefense(w, state);

    if (w.tick === year1Tick) {
      y1Wealth = items.wealth();
      y1Pop = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress').length;
      y1Spirit = Math.round(morale.hallSpirit());
      y1Renown = Math.round(threats.renown());
    } else if (w.tick === year2Tick) {
      y2Wealth = items.wealth();
      y2Pop = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress').length;
      y2Spirit = Math.round(morale.hallSpirit());
      y2Renown = Math.round(threats.renown());
    }
  }

  unsub();
  stopInvariants();
  if (peril === 2 || peril === 4) expect(checkInvariants(w.game), `T-176 ${seed} final invariants`).toEqual([]);
  console.log(`[three_years_hash] ${JSON.stringify({ seed, peril, tick: w.tick, hash: w.hash() })}`);

  y3Wealth = items.wealth();
  const survivingDwarves = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress');
  y3Pop = survivingDwarves.length;
  y3Spirit = Math.round(morale.hallSpirit());
  y3Renown = Math.round(threats.renown());

  const moods: number[] = [];
  const moodBreakdown: Record<string, number> = { Fine: 0, Content: 0, Happy: 0, Unhappy: 0, Miserable: 0, Ecstatic: 0 };
  let minMood = 100;
  let maxMood = 0;
  let sumMood = 0;

  for (const id of survivingDwarves) {
    const m = w.game.world.entities.get(id, C.Mood);
    if (!m) continue;
    const val = m.value;
    moods.push(val);
    if (val < minMood) minMood = val;
    if (val > maxMood) maxMood = val;
    sumMood += val;

    if (val < 20) moodBreakdown['Miserable'] = (moodBreakdown['Miserable'] ?? 0) + 1;
    else if (val < 40) moodBreakdown['Unhappy'] = (moodBreakdown['Unhappy'] ?? 0) + 1;
    else if (val < 60) moodBreakdown['Fine'] = (moodBreakdown['Fine'] ?? 0) + 1;
    else if (val < 75) moodBreakdown['Content'] = (moodBreakdown['Content'] ?? 0) + 1;
    else if (val < 90) moodBreakdown['Happy'] = (moodBreakdown['Happy'] ?? 0) + 1;
    else moodBreakdown['Ecstatic'] = (moodBreakdown['Ecstatic'] ?? 0) + 1;

    // Kept (T-334): the mood floors are the formula of 15 § Mood; no order of jobs goes below them.
    expect(val).toBeGreaterThanOrEqual(MOOD_MIN);
    const needPressure = Math.min(
      NEED_PRESSURE_CAP,
      m.thoughts.reduce((sum, t) => sum + (t.baseValue < 0 ? Math.max(0, -t.baseValue) : 0), 0),
    );
    expect(val).toBeGreaterThanOrEqual(MOOD_NEEDS_MET_FLOOR - needPressure);
  }

  const deaths = deathCounts(w);
  const avgMood = moods.length > 0 ? (sumMood / moods.length).toFixed(1) : 'extinct';

  const economy = threeYearsMeasurements(w);
  console.log(`[three_years_economy] ${JSON.stringify({ seed, peril, years: economy.years, deathsList, raids, minerals: economy.minerals, fixture: economy.fixture, allDeaths: economy.deaths, allRaids: economy.raids, recipes: economy.recipes, immigration: economy.immigration, caravans: economy.caravans, dwarfDays: economy.dwarfTicks / TICKS_PER_DAY, food: economy.meals, alcohol: economy.alcohol, water: economy.water })}`);

  const totalDwarfDays = economy.dwarfTicks / TICKS_PER_DAY;
  mealsEaten = economy.meals;
  drinksAlcohol = economy.alcohol;
  drinksDrunk = economy.alcohol + economy.water;
  const mealsPerDwarfDay = totalDwarfDays > 0 ? (mealsEaten / totalDwarfDays).toFixed(2) : '0';
  const drinksPerDwarfDay = totalDwarfDays > 0 ? (drinksDrunk / totalDwarfDays).toFixed(2) : '0';

  const result = {
    seed,
    peril,
    y1Pop,
    y2Pop,
    y3Pop,
    y1Wealth,
    y2Wealth,
    y3Wealth,
    dwarfDeaths: deaths.dwarf,
    tameDeaths: deaths.tame,
    wavesCount: waves.length,
    totalImmigrants: waves.reduce((sum, w) => sum + w.count, 0),
    nonGuaranteedWaves: waves.filter((w) => !w.guaranteed).length,
    raidsCount: raids.length,
    mealsEaten,
    drinksDrunk,
    drinksAlcohol,
    drinksWater,
    extinctDay,
    avgMood,
    minMood: moods.length > 0 ? minMood : 0,
    maxMood: moods.length > 0 ? maxMood : 0,
    moodBreakdown,
    deathsList,
    raidsList: raids.map(({ day, kind, size, partyId, outcome }) => ({ day, kind, size, partyId, outcome: outcome ?? 'active' })),
    hallSpirit: { y1: y1Spirit, y2: y2Spirit, y3: y3Spirit },
    renown: { y1: y1Renown, y2: y2Renown, y3: y3Renown },
    mealsPerDwarfDay,
    drinksPerDwarfDay,
    crowds: { doors: crowdWatch.doors, hall: crowdWatch.hall },
  };
  // Preserve the measurement even when a deterministic guarantee fails.
  console.log(`[three_years_seeds_detail] ${JSON.stringify(result)}`);

  // T-334: each seed is one chaotic sample (testing-strategy.md § What may be a gate). Its dwarf
  // deaths by cause are printed, to the console and to THREE_YEARS_SEEDS_OUT, and not asserted: at
  // peril 0 a wild animal can kill a dwarf, and which dwarf it meets follows the job timeline (12
  // bleeding deaths after fights in five of the seven seeds of 2026-10-12).
  const figures = { seed, peril, dwarfDeaths: economy.deaths.filter((d) => d.species === 'dwarf').length, byCause: economy.dwarfDeathsByCause(), y3Pop };
  console.log(`[three_years_seeds_deaths] ${JSON.stringify(figures)}`);
  const out = process.env['THREE_YEARS_SEEDS_OUT'] ?? '.vite/three-years-seeds';
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/${seed}.json`, JSON.stringify({ figures, result }, null, 2) + '\n');
  // The file's set rule reads these. They come before the seed's assertions, so a seed that fails one
  // is still counted as what it was.
  const needDeaths = economy.needDeaths();
  survival.push({ seed, peril, y1Pop, y3Pop, needDeaths });
  console.log(`[three_years_seeds_set] ${JSON.stringify({ seed, peril, y1Pop, y3Pop, grew: y3Pop > EMBARK_SIZE, needDeaths })}`);
  // T-156: a living fortress did what the script exists to exercise (the gate, the halls, the
  // bedrooms, the squad; at perils 2 and 4 an alert raised and lowered, and a trade).
  console.log(`[three_years_seeds_script] ${JSON.stringify({ seed, accepted: Object.fromEntries(scriptRecord(w).accepted), rejected: Object.fromEntries(scriptRecord(w).rejected) })}`);
  if (y3Pop > 0) expect(fortressWitnesses(w, state, peril), `${seed} T-156 witnesses`).toEqual([]);
  // Kept: rules of 21 Immigration, whatever the order of jobs.
  expect(y3Pop, `${seed} population within POPULATION_CAP_DEFAULT`).toBeLessThanOrEqual(POPULATION_CAP_DEFAULT);
  for (const wave of waves) {
    expect(wave.count, `${seed} wave size within WAVE_MAX`).toBeLessThanOrEqual(WAVE_MAX);
  }

  return result;
}

describe('T-M8-06 perf: three_years_seeds', () => {
  it.each(THREE_YEARS_20_SEEDS)('runs $seed (peril $peril) across 3 years', ({ seed, peril }) => {
    const res = runThreeYearsSeed(seed, peril);
    const line = `[three_years_seeds] ${res.seed} (peril ${res.peril}): pop=${res.y3Pop} (Y1:${res.y1Pop}, Y2:${res.y2Pop}), wealth=${res.y3Wealth} (Y1:${res.y1Wealth}, Y2:${res.y2Wealth}), deaths(dwarf=${res.dwarfDeaths}, tame=${res.tameDeaths}), waves=${res.wavesCount} (+${res.totalImmigrants} dw), raids=${res.raidsCount}, meals=${res.mealsEaten}, drinks=${res.drinksDrunk}, moodAvg=${res.avgMood}, extinct=${res.extinctDay ?? 'none'}`;
    console.log(line);
  });

  // Runs last, over the seeds that reached their end of the file. A seed stopped early by an invariant
  // fails on its own and counts here as neither alive nor grown.
  it('as a set: nearly every fortress is alive at year 1, and nearly every peril-0 fortress grows and is fed', () => {
    const alive = survival.filter((row) => row.y1Pop > 0);
    const peril0 = survival.filter((row) => row.peril === 0);
    const grown = peril0.filter((row) => row.y3Pop > EMBARK_SIZE);
    const dead = survival.filter((row) => row.y1Pop <= 0).map((row) => row.seed);
    const small = peril0.filter((row) => row.y3Pop <= EMBARK_SIZE).map((row) => row.seed);
    // Kept as a set: the food chain. Hardly anyone dies of hunger or thirst where the farm, the
    // kitchens and the stills follow the population (85 starvation deaths in four seeds on 2026-10-12, before T-145).
    const hungry = peril0.filter((row) => row.needDeaths > 0).map((row) => `${row.seed}: ${row.needDeaths}`);
    console.log(`[three_years_seeds_set] ${JSON.stringify({ seeds: survival.length, alive: alive.length, grown: grown.length, dead, small, hungry })}`);
    expect(alive.length, `alive at the end of year 1; dead: ${dead.join(', ')}`).toBeGreaterThanOrEqual(SET_ALIVE_AT_YEAR_ONE);
    expect(grown.length, `peril 0 past embark size at year 3; not: ${small.join(', ')}`).toBeGreaterThanOrEqual(SET_PERIL_ZERO_GROWN);
    expect(hungry.length, `peril-0 seeds with need deaths: ${hungry.join(', ')}`).toBeLessThanOrEqual(SET_PERIL_ZERO_NEED_DEATHS);
  });
});
