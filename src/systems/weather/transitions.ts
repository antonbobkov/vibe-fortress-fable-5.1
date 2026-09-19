/**
 * 06 Weather rules as pure functions: `02-systems/06-weather-and-seasons.md` § Seasons, § Surface
 * temperature, § Weather transitions, § Effects of each state; `algorithms/environment.md`
 * § Weather tick (`transition`); `regions-biomes-and-traits.md` § Weather (durations, weights,
 * the temper rule) and § Region traits (`serene_vale`, `thunderhead`, `frostmarrow`).
 */

import {
  DAYLIGHT_HARSH_TEMPER,
  DAYLIGHT_HOURS,
  DAY_CURVE_C,
  FOG_VISIBILITY_PERCENT,
  FROSTMARROW_SUMMER_GROWTH_PERCENT,
  HEATWAVE_THIRST_PERCENT,
  OVERCAST_GROWTH_PERCENT,
  SEASON_GROWTH_PERCENT,
  SNOW_C,
  TEMPER_SPREAD_PER_TEMPER,
  THUNDERHEAD_STORM_FACTOR,
  TRANSITION_WEIGHT_SCALE,
  WEATHER_DELTA_C,
  WEATHER_STATES,
  type WeatherStateId,
} from './constants';

export const SPRING = 0;
export const SUMMER = 1;
export const AUTUMN = 2;
export const WINTER = 3;

/** The climate facts of the embark region the rules read. */
export interface Climate {
  /** The biome's `seasonTemp`, spring … winter, at its `referenceTempC`. */
  readonly seasonTemp: readonly number[];
  readonly referenceTempC: number;
  /** The region's annual mean `tempC`. */
  readonly tempC: number;
  readonly temper: number;
  readonly traits: readonly string[];
}

export function isWeatherState(s: string): s is WeatherStateId {
  return (WEATHER_STATES as readonly string[]).includes(s);
}

/**
 * `frostmarrow` "uses winter values for autumn and spring as well" (`06` § Seasons; the trait's
 * 06 hook: "winter values in autumn and spring"): the season whose values the rules use.
 * DECISIONS.md D-101.
 */
export function climateSeason(season: number, climate: Climate): number {
  if (climate.traits.includes('frostmarrow') && (season === SPRING || season === AUTUMN)) return WINTER;
  return season;
}

/** `seasonBase = biome.seasonTemp[season] + (region.tempC − biome.referenceTempC)`. */
export function seasonBase(season: number, climate: Climate): number {
  const s = climateSeason(season, climate);
  return (climate.seasonTemp[s] ?? 0) + (climate.tempC - climate.referenceTempC);
}

/** `temperSpread`: temper × 1 added in summer and subtracted in winter. */
export function temperSpread(season: number, climate: Climate): number {
  const s = climateSeason(season, climate);
  if (s === SUMMER) return climate.temper * TEMPER_SPREAD_PER_TEMPER;
  if (s === WINTER) return -climate.temper * TEMPER_SPREAD_PER_TEMPER;
  return 0;
}

/** `surfaceTempC(hour) = seasonBase + dayCurve(hour) + weatherDelta + temperSpread`. */
export function surfaceTemp(season: number, hour: number, state: WeatherStateId, climate: Climate): number {
  return seasonBase(season, climate) + (DAY_CURVE_C[hour] ?? 0) + WEATHER_DELTA_C[state] + temperSpread(season, climate);
}

/** `06` § Seasons: the daylight window `[sunrise, sunset)` of the season and the temper band. */
export function daylightWindow(season: number, climate: Climate): readonly [number, number] {
  const s = climateSeason(season, climate);
  const row = DAYLIGHT_HOURS[s] as readonly [readonly [number, number], readonly [number, number]];
  return row[climate.temper >= DAYLIGHT_HARSH_TEMPER ? 1 : 0];
}

/** `06` § Seasons, daylight: `sunrise ≤ hour < sunset` for the season and the temper band. */
export function isDaylightAt(season: number, hour: number, climate: Climate): boolean {
  const [rise, set] = daylightWindow(season, climate);
  return hour >= rise && hour < set;
}

/**
 * `weather.growthModifier()`: "percent, season × state" (`environment.md`: `seasonGrowth[season] ×
 * stateGrowth[state] / 100`, `stateGrowth` overcast 90, else 100); `frostmarrow`'s summer is 80%.
 */
export function growthModifier(season: number, state: WeatherStateId, climate: Climate): number {
  const s = climateSeason(season, climate);
  let base = SEASON_GROWTH_PERCENT[s] ?? 0;
  if (s === SUMMER && climate.traits.includes('frostmarrow')) base = FROSTMARROW_SUMMER_GROWTH_PERCENT;
  const stateGrowth = state === 'overcast' ? OVERCAST_GROWTH_PERCENT : 100;
  return Math.trunc((base * stateGrowth) / 100);
}

/** `weather.thirstModifier()`: `heatwave` ×1.5, as a percent. */
export function thirstModifier(state: WeatherStateId): number {
  return state === 'heatwave' ? HEATWAVE_THIRST_PERCENT : 100;
}

/** `weather.visibilityModifier()`: `fog` halves the raid warning distance, as a percent. */
export function visibilityModifier(state: WeatherStateId): number {
  return state === 'fog' ? FOG_VISIBILITY_PERCENT : 100;
}

/** `heatwave` only in summer at temper ≥ 2; `cold_snap` only in autumn and winter at temper ≥ 2. */
export function allowed(state: WeatherStateId, season: number, climate: Climate): boolean {
  const s = climateSeason(season, climate);
  if (state === 'heatwave') return s === SUMMER && climate.temper >= 2;
  if (state === 'cold_snap') return (s === AUTUMN || s === WINTER) && climate.temper >= 2;
  return true;
}

/**
 * The weights of the next state, in `WEATHER_STATES` order, scaled by `TRANSITION_WEIGHT_SCALE`:
 * the content row, the temper rule, the trait rules (`thunderhead` doubles `storm`, `serene_vale`
 * removes `storm`, `heatwave`, `cold_snap`), and the season/temper rule for `heatwave` and
 * `cold_snap`.
 */
export function transitionWeights(row: Readonly<Record<string, number>>, season: number, climate: Climate): number[] {
  const t = climate.temper;
  const serene = climate.traits.includes('serene_vale');
  const thunder = climate.traits.includes('thunderhead');
  return WEATHER_STATES.map((to) => {
    let w = row[to] ?? 0;
    if (to === 'storm' || to === 'fog' || to === 'heatwave' || to === 'cold_snap') w *= (2 + t) * (TRANSITION_WEIGHT_SCALE / 2);
    else if (to === 'clear') w *= (10 - t) * (TRANSITION_WEIGHT_SCALE / 10);
    else w *= TRANSITION_WEIGHT_SCALE;
    if (w < 0) w = 0;
    if (to === 'storm' && thunder) w *= THUNDERHEAD_STORM_FACTOR;
    if (serene && (to === 'storm' || to === 'heatwave' || to === 'cold_snap')) w = 0;
    if (!allowed(to, season, climate)) w = 0;
    return w;
  });
}

/**
 * The constraints applied after the draw: `snow` above `SNOW_C` becomes `rain`; `rain` and `storm`
 * at or below it become `snow`; under `frostmarrow` ("snow whenever precipitation") rain and
 * storm are always snow. `surfaceC` is the surface temperature at the time of the draw.
 */
export function constrain(next: WeatherStateId, surfaceC: number, climate: Climate): WeatherStateId {
  const frost = climate.traits.includes('frostmarrow');
  if (next === 'snow') return frost || surfaceC <= SNOW_C ? 'snow' : 'rain';
  if (next === 'rain' || next === 'storm') return frost || surfaceC <= SNOW_C ? 'snow' : next;
  return next;
}

/** Draw an index from integer weights with `int(0, total − 1)`; -1 when every weight is 0. */
export function weightedIndex(weights: readonly number[], draw: (total: number) => number): number {
  let total = 0;
  for (const w of weights) total += w;
  if (total <= 0) return -1;
  let r = draw(total);
  for (let k = 0; k < weights.length; k += 1) {
    const w = weights[k] as number;
    if (r < w) return k;
    r -= w;
  }
  return weights.length - 1;
}
