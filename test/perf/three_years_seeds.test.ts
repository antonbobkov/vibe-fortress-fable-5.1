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
import { buildFlatTestMap, FLAT_TEST_SURFACE_Z, regionSpec } from '@app/headless';
import { DAYS_PER_YEAR, TICKS_PER_DAY, POPULATION_CAP_DEFAULT, MOOD_MIN } from '@core/constants';
import { C } from '@core/components';
import { NEED_PRESSURE_CAP, MOOD_NEEDS_MET_FLOOR } from '@systems/morale/mood';
import { WAVE_MAX } from '@systems/immigration/constants';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../scenarios/test-world';
import { deathCounts } from '../scenarios/death-counts';
import {
  setupThreeYearsFortress,
  checkFortressWorkOrders,
  checkFortressRooms,
  checkFortressCaveFarm,
  checkFortressDefense,
} from '../scenarios/three_years_fortress';

const Z = FLAT_TEST_SURFACE_Z;

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
  readonly raidsCount: number;
  readonly mealsEaten: number;
  readonly drinksDrunk: number;
  readonly extinctDay: number | null;
  readonly avgMood: string;
  readonly minMood: number;
  readonly maxMood: number;
}

export function runThreeYearsSeed(seed: string, peril: number): ThreeYearsSeedResult {
  const w = new TestWorld({
    seed,
    map: buildFlatTestMap(undefined, 48, 48),
    spec: regionSpec(seed, { peril }),
    embark: 'default',
  });

  const state = setupThreeYearsFortress(w);
  const cx = state.cx;
  const cy = state.cy;
  const buildings = w.readers.of<BuildingsReader>('14');

  // Advance bootstrap period (20 days)
  const totalTicksBootstrap = 20 * TICKS_PER_DAY;
  while (w.tick < totalTicksBootstrap) {
    w.step(Math.min(100, totalTicksBootstrap - w.tick));
    checkFortressWorkOrders(w, state);
    checkFortressRooms(w, state);
    checkFortressCaveFarm(w, state);
    checkFortressDefense(w, state);
  }

  // Depot
  for (const at of [w.index(cx - 9, cy + 4, Z), w.index(cx - 9, cy + 8, Z), w.index(cx + 8, cy + 14, Z)]) {
    if (buildings.ghost('trade_depot', at, 0).reason !== null) continue;
    const placed = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'trade_depot', origin: at, orientation: 0, materialChoice: 0 });
    if (placed.ok) break;
  }
  w.game.world.applyCommand({ type: 'SetRequests', civ: 'mountainhome', entries: [{ itemType: 'anvil', priority: 1 }] });

  // Tracking
  const waves: { day: number; count: number; guaranteed: boolean }[] = [];
  const raids: { day: number; kind: string; size: number }[] = [];
  let mealsEaten = 0;
  let drinksDrunk = 0;

  const unsub = w.game.world.onEvents((events) => {
    const day = Math.floor(w.tick / TICKS_PER_DAY) + 1;
    for (const e of events) {
      if (e.type === 'ImmigrantsArrived') {
        waves.push({ day, count: Number(e['count'] ?? 0), guaranteed: e['guaranteed'] === true });
      } else if (e.type === 'RaidArrived') {
        raids.push({ day, kind: String(e['threatKind'] ?? 'raid'), size: Number(e['size'] ?? 0) });
      } else if (e.type === 'MealEaten') {
        mealsEaten += 1;
      } else if (e.type === 'DrankAlcohol' || e.type === 'DrankWater') {
        drinksDrunk += 1;
      }
    }
  });

  const totalTicks = 3 * DAYS_PER_YEAR * TICKS_PER_DAY;
  const year1Tick = DAYS_PER_YEAR * TICKS_PER_DAY;
  const year2Tick = 2 * DAYS_PER_YEAR * TICKS_PER_DAY;

  let y1Wealth = 0;
  let y2Wealth = 0;
  let y3Wealth = 0;
  let y1Pop = 0;
  let y2Pop = 0;
  let y3Pop = 0;
  let extinctDay: number | null = null;

  const items = w.readers.of<ItemsReader>('13');

  while (w.tick < totalTicks) {
    const living = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress');
    if (w.tick > totalTicksBootstrap && living.length === 0) {
      extinctDay = Math.floor(w.tick / TICKS_PER_DAY) + 1;
      break;
    }

    w.step(Math.min(300, totalTicks - w.tick));
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

  unsub();

  y3Wealth = items.wealth();
  const survivingDwarves = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress');
  y3Pop = survivingDwarves.length;

  const moods: number[] = [];
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

    // Assert deterministic mood floor and thought caps for surviving dwarves
    expect(val).toBeGreaterThanOrEqual(MOOD_MIN);
    const needPressure = Math.min(
      NEED_PRESSURE_CAP,
      m.thoughts.reduce((sum, t) => sum + (t.baseValue < 0 ? Math.max(0, -t.baseValue) : 0), 0),
    );
    expect(val).toBeGreaterThanOrEqual(MOOD_NEEDS_MET_FLOOR - needPressure);
  }

  const deaths = deathCounts(w);
  const avgMood = moods.length > 0 ? (sumMood / moods.length).toFixed(1) : 'extinct';

  // Assert deterministic guarantees
  if (peril === 0) {
    expect(deaths.dwarf, `${seed} (peril 0) has 0 dwarf deaths`).toBe(0);
    expect(y3Pop, `${seed} (peril 0) grew past embark size`).toBeGreaterThan(7);
  }
  expect(y3Pop, `${seed} population within POPULATION_CAP_DEFAULT`).toBeLessThanOrEqual(POPULATION_CAP_DEFAULT);
  for (const wave of waves) {
    expect(wave.count, `${seed} wave size within WAVE_MAX`).toBeLessThanOrEqual(WAVE_MAX);
  }

  return {
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
    raidsCount: raids.length,
    mealsEaten,
    drinksDrunk,
    extinctDay,
    avgMood,
    minMood: moods.length > 0 ? minMood : 0,
    maxMood: moods.length > 0 ? maxMood : 0,
  };
}

describe('T-M8-06 perf: three_years_seeds', () => {
  it.each(THREE_YEARS_20_SEEDS)('runs $seed (peril $peril) across 3 years', ({ seed, peril }) => {
    const res = runThreeYearsSeed(seed, peril);
    const line = `[three_years_seeds] ${res.seed} (peril ${res.peril}): pop=${res.y3Pop} (Y1:${res.y1Pop}, Y2:${res.y2Pop}), wealth=${res.y3Wealth} (Y1:${res.y1Wealth}, Y2:${res.y2Wealth}), deaths(dwarf=${res.dwarfDeaths}, tame=${res.tameDeaths}), waves=${res.wavesCount} (+${res.totalImmigrants} dw), raids=${res.raidsCount}, meals=${res.mealsEaten}, drinks=${res.drinksDrunk}, moodAvg=${res.avgMood}, extinct=${res.extinctDay ?? 'none'}`;
    console.log(line);
  });
});
