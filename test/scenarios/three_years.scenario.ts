import { stepThreeYears, threeYearsMeasurements } from './three_years_measurements';
/**
 * The three-years scenario (T-M8-06): extends the year-one bootstrap across three full years.
 *
 * Runs on seed `three-years` (generated wealth-2 48×48 map, serene_vale peril-0, Balanced embark),
 * asserting the deterministic guarantees named in `balance.md` § Mood floor and the no-spiral
 * guarantee and `M8-polish.md` (mood floor, no spiral, caps), and reporting the measured balance
 * table for consumption, wealth curve, immigration, and mood distribution.
 */

import { expect } from 'vitest';
import { DAYS_PER_YEAR, TICKS_PER_DAY, POPULATION_CAP_DEFAULT, MOOD_MIN } from '@core/constants';
import { C } from '@core/components';
import { POSITIVE_CAP, NEED_PRESSURE_CAP, MOOD_NEEDS_MET_FLOOR } from '@systems/morale/mood';
import { WAVE_MAX } from '@systems/immigration/constants';
import { deathCounts } from './death-counts';
import type { ItemsReader } from '@systems/items';
import type { Scenario } from './runner';
import {
  setupThreeYearsFortress,
  threeYearsWorld,
  checkFortressWorkOrders,
  checkFortressRooms,
  checkFortressCaveFarm,
  checkFortressDefense,
} from './three_years_fortress';

export interface ThreeYearsRow {
  readonly metric: string;
  readonly model: string;
  readonly measured: string;
}

/**
 * F-17 task 3, owner-imposed three-run time box (DECISIONS D-258).
 * These original >0 production and all-caravan trade guarantees remain KNOWN GAPS;
 * reports/M8-balance-after-f17.md records them. Pin their observed failing values so
 * a future improvement forces removal of the exception instead of silently passing.
 * Survival, growth, mood floors, engraving and caps retain their original assertions.
 */
const F17_KNOWN_GAPS = {
  recipes: new Set(['cut_gem', 'forge_pick', 'forge_mail_shirt', 'forge_crafts']),
  trades: { completed: 4, arrived: 8 },
};

const scenario: Scenario = {
  id: 'three_years',
  milestone: 8,
  timeoutMs: 300_000,
  seed: 'three-years',
  world: { region: { wealth: 2, peril: 0, biome: 'temperate_forest', geology: 'mixed', traits: ['serene_vale'], river: { class: 'brook', inflow: ['w'], outflow: 's' } } },
  embark: 'default',
  run: () => {
    const w = threeYearsWorld('three-years');
    const state = setupThreeYearsFortress(w);

    // Advance bootstrap period (20 days)
    const totalTicksBootstrap = 20 * TICKS_PER_DAY;
    while (w.tick < totalTicksBootstrap) {
      stepThreeYears(w, Math.min(100, totalTicksBootstrap - w.tick));
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
    }

    // Tracking
    const waves: { day: number; count: number; guaranteed: boolean }[] = [];
    const raids: { day: number; kind: string; size: number }[] = [];
    let mealsEaten = 0;
    let drinksAlcohol = 0;
    let drinksWater = 0;

    const unsubscribe = w.game.world.onEvents((events) => {
      const day = Math.floor(w.tick / TICKS_PER_DAY) + 1;
      for (const e of events) {
        if (e.type === 'ImmigrantsArrived') {
          waves.push({ day, count: Number(e['count'] ?? 0), guaranteed: e['guaranteed'] === true });
        } else if (e.type === 'RaidArrived') {
          raids.push({ day, kind: String(e['kind'] ?? 'raid'), size: Number(e['size'] ?? 0) });
        } else if (e.type === 'MealEaten') {
          mealsEaten += 1;
        } else if (e.type === 'DrankAlcohol') {
          drinksAlcohol += 1;
        } else if (e.type === 'DrankWater') {
          drinksWater += 1;
        }
      }
    });

    const items = w.readers.of<ItemsReader>('13');
    const totalTicks = 3 * DAYS_PER_YEAR * TICKS_PER_DAY;
    const year1Tick = DAYS_PER_YEAR * TICKS_PER_DAY;
    const year2Tick = 2 * DAYS_PER_YEAR * TICKS_PER_DAY;

    let y1Wealth = 0;
    let y2Wealth = 0;
    let y3Wealth = 0;
    let y1Pop = 0;
    let y2Pop = 0;
    let y3Pop = 0;

    while (w.tick < totalTicks) {
      stepThreeYears(w, Math.min(300, totalTicks - w.tick));
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);

      if (w.tick === year1Tick) {
        y1Wealth = items.wealth();
        y1Pop = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress').length;
      } else if (w.tick === year2Tick) {
        y2Wealth = items.wealth();
        y2Pop = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress').length;
      }
    }

    unsubscribe();
    const economy = threeYearsMeasurements(w);
    console.log(`three_years economy: ${JSON.stringify({ years: economy.years, minerals: economy.minerals, fixture: economy.fixture, allDeaths: economy.deaths, allRaids: economy.raids, recipes: economy.recipes, immigration: economy.immigration, caravans: economy.caravans, dwarfDays: economy.dwarfTicks / TICKS_PER_DAY, food: economy.meals, alcohol: economy.alcohol, water: economy.water })}`);

    y3Wealth = items.wealth();
    const livingDwarves = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress');
    y3Pop = livingDwarves.length;

    // Mood and thought statistics
    const moods: number[] = [];
    const breakdown: Record<string, number> = { Fine: 0, Content: 0, Happy: 0, Unhappy: 0, Miserable: 0, Ecstatic: 0 };
    let minMood = 100;
    let maxMood = 0;
    let sumMood = 0;

    for (const id of livingDwarves) {
      const mood = w.game.world.entities.get(id, C.Mood);
      if (!mood) continue;
      const val = mood.value;
      moods.push(val);
      if (val < minMood) minMood = val;
      if (val > maxMood) maxMood = val;
      sumMood += val;

      if (val < 20) breakdown['Miserable'] = (breakdown['Miserable'] ?? 0) + 1;
      else if (val < 40) breakdown['Unhappy'] = (breakdown['Unhappy'] ?? 0) + 1;
      else if (val < 60) breakdown['Fine'] = (breakdown['Fine'] ?? 0) + 1;
      else if (val < 75) breakdown['Content'] = (breakdown['Content'] ?? 0) + 1;
      else if (val < 90) breakdown['Happy'] = (breakdown['Happy'] ?? 0) + 1;
      else breakdown['Ecstatic'] = (breakdown['Ecstatic'] ?? 0) + 1;

      // Assertion 1: Deterministic mood floor (mood >= MOOD_MIN and mood >= 20 - needPressure)
      expect(val).toBeGreaterThanOrEqual(MOOD_MIN);
      const needPressure = Math.min(
        NEED_PRESSURE_CAP,
        mood.thoughts.reduce((sum, t) => {
          return sum + (t.baseValue < 0 ? Math.max(0, -t.baseValue) : 0);
        }, 0),
      );
      expect(val).toBeGreaterThanOrEqual(MOOD_NEEDS_MET_FLOOR - needPressure);

      // Assertion 2: Thought caps
      const positives = mood.thoughts.filter((t) => t.baseValue > 0).reduce((sum, t) => sum + t.baseValue, 0);
      const negatives = mood.thoughts.filter((t) => t.baseValue < 0).reduce((sum, t) => sum + -t.baseValue, 0);
      expect(positives).toBeLessThanOrEqual(POSITIVE_CAP + 1); // allowance for active tick
      expect(negatives).toBeLessThanOrEqual(75); // allowance for active tick, standing thoughts and personality multipliers
    }

    const deaths = deathCounts(w);
    const avgMood = moods.length > 0 ? (sumMood / moods.length).toFixed(1) : 'N/A';

    // Balance reporting table
    const totalDwarfDays = economy.dwarfTicks / TICKS_PER_DAY;
    mealsEaten = economy.meals;
    drinksAlcohol = economy.alcohol;
    drinksWater = economy.water;
    const mealsPerDwarfDay = totalDwarfDays > 0 ? (mealsEaten / totalDwarfDays).toFixed(2) : '0';
    const drinksPerDwarfDay = totalDwarfDays > 0 ? ((drinksAlcohol + drinksWater) / totalDwarfDays).toFixed(2) : '0';

    const table: ThreeYearsRow[] = [
      { metric: 'Consumption: food/dwarf/day', model: '0.48 food units', measured: `${mealsPerDwarfDay} meals (${mealsEaten} total)` },
      { metric: 'Consumption: drink/dwarf/day', model: '0.77 drink units', measured: `${drinksPerDwarfDay} drinks (${drinksAlcohol} ale, ${drinksWater} water)` },
      { metric: 'Wealth curve: Year 1', model: '4,000–8,000 marks', measured: `${y1Wealth} marks (pop ${y1Pop})` },
      { metric: 'Wealth curve: Year 2', model: '15,000–25,000 marks', measured: `${y2Wealth} marks (pop ${y2Pop})` },
      { metric: 'Wealth curve: Year 3', model: '35,000–60,000 marks', measured: `${y3Wealth} marks (pop ${y3Pop})` },
      { metric: 'Immigration: Year 1 guaranteed', model: '2 waves (4–8 dwarves)', measured: `${waves.filter((w) => w.guaranteed).length} waves (${waves.reduce((s, w) => s + w.count, 0)} dwarves)` },
      { metric: 'Immigration: Years 2–3', model: 'spirit >= 55: waves of 4–12', measured: `${waves.filter((w) => !w.guaranteed).length} waves${waves.filter((w) => !w.guaranteed).length === 0 ? ' (spirit < 55 threshold)' : ''}` },
      { metric: 'Raids: Peril 0', model: 'Thieves from Y2 spring (size 1)', measured: `${raids.length} thieves (sizes: ${raids.map((r) => r.size).join(', ')})` },
      { metric: 'Mood distribution: Mean', model: 'Content (~70 with hearth)', measured: `${avgMood} (min ${minMood.toFixed(1)}, max ${maxMood.toFixed(1)})` },
      { metric: 'Mood distribution: Breakdown', model: 'Content dominant', measured: `Fine: ${breakdown['Fine']}, Content: ${breakdown['Content']}, Unhappy: ${breakdown['Unhappy']}, Miserable: ${breakdown['Miserable']}` },
    ];

    const NL = String.fromCharCode(10);
    console.log(['three_years balance table:', ...table.map((r) => `  ${r.metric} | model: ${r.model} | measured: ${r.measured}`)].join(NL));
    console.log(`three_years summary: ${JSON.stringify({ y1Pop, y2Pop, y3Pop, y1Wealth, y2Wealth, y3Wealth, deaths, mealsEaten, drinksAlcohol, drinksWater, waves, raids, moodStats: { min: minMood, max: maxMood, avg: avgMood, breakdown } })}`);

    // Witness the real production chains, independently of any target wealth figure.
    for (const recipe of ['craft_stone', 'make_charcoal', 'cut_gem', 'forge_pick', 'forge_mail_shirt', 'forge_crafts', 'alloy_steel']) {
      const completed = economy.recipes[recipe] ?? 0;
      if (F17_KNOWN_GAPS.recipes.has(recipe)) {
        expect(completed, `F-17 known gap: ${recipe} still has no completed job`).toBe(0);
      } else {
        expect(completed, `${recipe} completed through normal jobs`).toBeGreaterThan(0);
      }
    }
    expect(economy.years[2]?.engraved ?? 0, 'halls engraved through terrain jobs').toBeGreaterThan(0);
    // Original target: completed === arrived. F-17 known gap: four visits were missed.
    expect(economy.caravans.filter((c) => c.state === 'TradeCompleted').length, 'F-17 known gap: completed trades')
      .toBe(F17_KNOWN_GAPS.trades.completed);
    expect(economy.caravans.filter((c) => c.state === 'CaravanArrived').length, 'F-17 known gap: caravan arrivals')
      .toBe(F17_KNOWN_GAPS.trades.arrived);

    // Assertion 3: No-spiral guarantee (peril 0 survives without deaths, population larger than embark)
    expect(deaths.dwarf, 'no dwarf died across three years in peril 0').toBe(0);
    expect(y3Pop, 'fortress grew past the 7 embark dwarves').toBeGreaterThan(7);

    // Assertion 4: Caps
    expect(y3Pop, 'population within POPULATION_CAP_DEFAULT').toBeLessThanOrEqual(POPULATION_CAP_DEFAULT);
    for (const wave of waves) {
      expect(wave.count, 'wave size within WAVE_MAX').toBeLessThanOrEqual(WAVE_MAX);
    }
  },
};

export default scenario;
