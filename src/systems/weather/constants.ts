/**
 * 06 Weather tuning constants: every row of `02-systems/06-weather-and-seasons.md` § Tuning
 * constants, verbatim, plus the tables the document's rules state in prose (the season table, the
 * weather deltas, the day curve, the temper scaling of the transition weights).
 */

import { SNOW_MOVE_COST_PERCENT as PATH_SNOW_MOVE_COST_PERCENT } from '@core/path-constants';

/** At or below this, precipitation is snow. */
export const SNOW_C = 0;
/** Above this snow melts. */
export const MELT_C = 2;
export const WET_DURATION_HOURS = 6;
/** Per storm hour. */
export const LIGHTNING_PER_HOUR_PERMILLE = 250;
/** Of 36 outdoor chunks per level at standard size. */
export const SNOW_CHUNKS_PER_HOUR = 8;
/** `22` owns the value's use; it is restated nowhere (D-019). */
export const SNOW_MOVE_COST_PERCENT = PATH_SNOW_MOVE_COST_PERCENT;
export const WILT_PERMILLE = 50;

/** `tick-order.md`: 06 runs at `(tick − 7) % 50`, one game hour. */
export const WEATHER_CADENCE = 50;
export const WEATHER_PHASE = 7;

/** The weather states of `06` § Concepts, in the column order of the transition tables. */
export const WEATHER_STATES = ['clear', 'overcast', 'rain', 'storm', 'snow', 'fog', 'heatwave', 'cold_snap'] as const;
export type WeatherStateId = (typeof WEATHER_STATES)[number];

/** `regions-biomes-and-traits.md` § Weather: "The initial state at embark is `clear`." */
export const INITIAL_WEATHER: WeatherStateId = 'clear';

/** `06` § Surface temperature, `weatherDelta`. */
export const WEATHER_DELTA_C: Readonly<Record<WeatherStateId, number>> = Object.freeze({
  clear: 0,
  overcast: -2,
  rain: -3,
  storm: -4,
  snow: -2,
  fog: -1,
  heatwave: 10,
  cold_snap: -12,
});

/**
 * `06` § Surface temperature, `dayCurve`: "a fixed 24-entry table, −6 at hour 4 rising to +6 at
 * hour 15". The entries between are the straight lines between those two points (rising over
 * 11 hours, falling back over 13), rounded to whole degrees (DECISIONS.md D-101).
 */
export const DAY_CURVE_C: readonly number[] = Object.freeze([
  -2, -3, -4, -5, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 0, 0, -1,
]);
export const DAY_CURVE_MIN_HOUR = 4;
export const DAY_CURVE_MAX_HOUR = 15;
export const DAY_CURVE_MIN_C = -6;
export const DAY_CURVE_MAX_C = 6;

/** `06` § Seasons: growth multiplier (surface), percent, spring … winter. */
export const SEASON_GROWTH_PERCENT: readonly number[] = Object.freeze([100, 120, 80, 0]);

/** `06` § Seasons: daylight `[sunrise, sunset)` hours per season, for temper 0–1 and temper 2–4. */
export const DAYLIGHT_HOURS: readonly (readonly [readonly [number, number], readonly [number, number]])[] = Object.freeze([
  [
    [6, 19],
    [7, 18],
  ],
  [
    [5, 21],
    [6, 20],
  ],
  [
    [6, 19],
    [7, 18],
  ],
  [
    [8, 17],
    [9, 16],
  ],
]);
/** The first temper of the second daylight column ("temper 2–4"). */
export const DAYLIGHT_HARSH_TEMPER = 2;

/** `06` § Effects of each state: `overcast` gives surface plants growth −10%. */
export const OVERCAST_GROWTH_PERCENT = 90;
/** `frostmarrow`: "its summer growth multiplier is 80%". */
export const FROSTMARROW_SUMMER_GROWTH_PERCENT = 80;
/** `heatwave`: "thirst rises ×1.5". */
export const HEATWAVE_THIRST_PERCENT = 150;
/** `fog`: "raid warning distance halved". */
export const FOG_VISIBILITY_PERCENT = 50;

/** `06` § Surface temperature, `temperSpread`: "temper × 1 added in summer and subtracted in winter". */
export const TEMPER_SPREAD_PER_TEMPER = 1;

/**
 * `regions-biomes-and-traits.md` § Weather, the temper rule: "multiplies the `storm`, `fog`,
 * `heatwave` and `cold_snap` columns by `(1 + temper × 0.5)` and the `clear` column by
 * `(1 − temper × 0.1)`". Weights are scaled by `TRANSITION_WEIGHT_SCALE` so the products stay
 * whole: `× (2 + temper) × 10` and `× (10 − temper) × 2`, the other columns `× 20`.
 */
export const TRANSITION_WEIGHT_SCALE = 20;

/** `thunderhead`: "storm weight ×2; `LIGHTNING_PER_HOUR_PERMILLE` ×1.5" (as ×3/2). */
export const THUNDERHEAD_STORM_FACTOR = 2;
export const THUNDERHEAD_LIGHTNING_NUMERATOR = 3;
export const THUNDERHEAD_LIGHTNING_DENOMINATOR = 2;

/** `algorithms/environment.md` § Weather tick: "mud on outdoor soil floors with rain for 2+ hours". */
export const MUD_RAIN_HOURS = 2;

/** `algorithms/environment.md`: lightning's `weightedOutdoorTile(trees ×4, tall creatures ×2)`. */
export const LIGHTNING_TREE_WEIGHT = 4;
export const LIGHTNING_TALL_WEIGHT = 2;
