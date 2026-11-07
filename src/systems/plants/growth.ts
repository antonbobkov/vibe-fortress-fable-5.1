/**
 * Crop growth as pure rules: `02-systems/07-plants-and-farming.md` § Growth and
 * `04-implementation/algorithms/environment.md` § Plant growth.
 *
 * ```
 * growthPerHour(plant, tile) =
 *   if not seasonAllows or not lightOk or not tempOk: 0
 *   else BASE_GROWTH × weather.growthModifier() / 100
 * ```
 *
 * A stage is `stageDays × HOURS_PER_DAY × BASE_GROWTH` units long; crossing it advances the stage
 * and keeps the remainder. Cave crops use a growth modifier of 100 in every season and ignore
 * weather. Nothing here reads the map or the clock: the system passes the conditions in.
 */

import { DAYS_PER_SEASON, HOURS_PER_DAY } from '@core/constants';
import { OVERCAST_GROWTH_PERCENT, SEASON_GROWTH_PERCENT } from '@systems/weather/constants';
import { BASE_GROWTH, CROP_STAGE_MAX, SOWING_MARGIN_DAYS, YIELD_BONUS_MAX, YIELD_LEVELS_PER_BONUS } from './constants';
import type { PlantRow } from './facts';

export interface GrowthConditions {
  readonly season: number;
  readonly lit: boolean;
  /** The tile lies under a glowstone lamp (`buildings.lampCoveredAt`). */
  readonly lamped: boolean;
  readonly tempC: number;
  /** `weather.growthModifier()`; ignored by cave crops. */
  readonly growthModifier: number;
}

/** "surface crops grow only in their `growSeasons`"; cave species grow in all seasons. */
export function seasonAllows(row: PlantRow, cave: boolean, season: number): boolean {
  if (cave) return true;
  const seasons = row.seasons;
  return seasons === undefined || seasons.includes(season);
}

/** "`sun` needs crop light; `dark` needs it clear; `glow` needs it clear under a lamp; `any` ignores both." */
export function lightOk(row: PlantRow, lit: boolean, lamped: boolean): boolean {
  if (row.light === 'sun') return lit;
  if (row.light === 'dark') return !lit;
  if (row.light === 'glow') return !lit && lamped;
  return true;
}

/** "`minC ≤ temperatureAt(tile) ≤ maxC`". */
export function tempOk(row: PlantRow, tempC: number): boolean {
  return tempC >= row.minC && tempC <= row.maxC;
}

/** The growth units a crop gains this hour, 0 when any condition blocks it. */
export function growthPerHour(row: PlantRow, cave: boolean, c: GrowthConditions): number {
  if (!seasonAllows(row, cave, c.season)) return 0;
  if (!lightOk(row, c.lit, c.lamped)) return 0;
  if (!tempOk(row, c.tempC)) return 0;
  const modifier = cave ? 100 : c.growthModifier;
  return Math.floor((BASE_GROWTH * modifier) / 100);
}

/** `stageDays × HOURS_PER_DAY × BASE_GROWTH`. */
export function stageLength(row: PlantRow): number {
  return (row.stageDays ?? 0) * HOURS_PER_DAY * BASE_GROWTH;
}

export interface CropProgress {
  readonly stage: number;
  readonly growth: number;
}

/**
 * "when the accumulator crosses it the stage advances and the accumulator keeps the remainder".
 *
 * The accumulator runs on through the fourth (mature) stage, so a crop is ready to harvest
 * `4 × stageDays` after planting — the cycle `03-content/plants.md` states ("crops have four
 * stages; the total is the cycle", "a dimcap … completes a cycle in 16 days") and the one the
 * acceptance row `pl_cave_cycle` measures. docs/02-systems/07-plants-and-farming.md § Cave farming.
 */
export function advance(progress: CropProgress, gained: number, length: number): CropProgress {
  let stage = progress.stage;
  let growth = progress.growth + gained;
  while (length > 0 && growth >= length && stage < CROP_STAGE_MAX) {
    growth -= length;
    stage += 1;
  }
  if (length > 0 && stage >= CROP_STAGE_MAX && growth > length) growth = length;
  return { stage, growth };
}

/** Ready to harvest: the fourth stage has run its own `stageDays` (D-107). */
export function isMature(progress: CropProgress, length: number): boolean {
  return progress.stage >= CROP_STAGE_MAX && (length <= 0 || progress.growth >= length);
}

/** Percent of the way through the current stage, for `plants.cropInfo`. */
export function progressPercent(progress: CropProgress, length: number): number {
  if (length <= 0) return 0;
  return Math.min(100, Math.floor((progress.growth * 100) / length));
}

/**
 * `environment.md`: `count = rng.int(min, max) + floor(skill / 5)`, capped at `max + 2`.
 * `roll` is the already-drawn `rng.int(min, max)`.
 */
export function harvestCount(row: PlantRow, roll: number, skill: number): number {
  const max = row.yield?.[1] ?? roll;
  const bonus = Math.floor(skill / YIELD_LEVELS_PER_BONUS);
  return Math.min(roll + bonus, max + YIELD_BONUS_MAX);
}

/** What a surface crop sown on a day needs and has before winter, in days of growth at 100%. */
export interface RipeningOutlook {
  /** Four stages of `stageDays`. */
  readonly needDays: number;
  /** The growing days left, each counted at its season's growth percent, overcast; rounded down. */
  readonly leftDays: number;
  readonly ripens: boolean;
}

/**
 * T-512, T-516: whether a surface crop sown on this day of this season (`dayOfSeason` 1-based)
 * ripens before winter (07 § Growth: four stages of `stageDays` at normal growth; it grows only in
 * its `seasons`, at the season's growth percent, 120 in summer and 80 in autumn; out of its seasons
 * it lies dormant, and winter's frost kills it with its seed). The days left are counted after
 * `SOWING_MARGIN_DAYS`, every one as if overcast, as a player who reads the calendar would leave a
 * margin. A dormant season between two growing ones (cabbage's summer) is passed over: a temperate
 * summer does not freeze. The plot panel's note and the three-year script both read this.
 */
export function ripeningOutlook(row: { readonly stageDays?: number; readonly seasons?: readonly number[] }, season: number, dayOfSeason: number): RipeningOutlook {
  const needDays = (CROP_STAGE_MAX + 1) * (row.stageDays ?? 0);
  let growth = 0;
  for (let s = season; s < SEASON_GROWTH_PERCENT.length - 1; s += 1) {
    if (row.seasons !== undefined && !row.seasons.includes(s)) continue;
    const days = s === season ? Math.max(0, DAYS_PER_SEASON - dayOfSeason - SOWING_MARGIN_DAYS) : DAYS_PER_SEASON;
    growth += days * (SEASON_GROWTH_PERCENT[s] ?? 0) * OVERCAST_GROWTH_PERCENT;
  }
  return { needDays, leftDays: Math.floor(growth / (100 * 100)), ripens: growth >= needDays * 100 * 100 };
}

/** `ripeningOutlook(...).ripens`. */
export function ripensInTime(row: { readonly stageDays?: number; readonly seasons?: readonly number[] }, season: number, dayOfSeason: number): boolean {
  return ripeningOutlook(row, season, dayOfSeason).ripens;
}
