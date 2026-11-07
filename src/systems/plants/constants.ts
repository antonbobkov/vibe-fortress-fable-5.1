/**
 * 07 Plants & farming tuning constants: every row of `02-systems/07-plants-and-farming.md`
 * § Tuning constants, verbatim, plus the cadence and phase of `04-implementation/tick-order.md`
 * ("07 plants `(tick − 11) % 50`") and the literals the rules of § Growth and § Farm plots name.
 */

/** `tick-order.md`: 07 runs once per game hour, eleven ticks after the hour boundary. */
export const PLANTS_CADENCE = 50;
export const PLANTS_PHASE = 11;

/** Growth units per hour at 100%. */
export const BASE_GROWTH = 100;
/** Base work time. */
export const PLANT_TICKS = 40;
export const HARVEST_TICKS = 40;
export const SEEDS_PER_HARVEST = 1;
/** Work added to a build job per sapling or shrub on its footprint (14 § Placement). */
export const CLEAR_PLANT_TICKS = 20;
/** Candidate tiles per day for saplings. */
export const REGROWTH_TRIES_PER_DAY = 40;
/** Multiplied by biome tree density (0–1). */
export const REGROWTH_PERMILLE = 200;
/** Per bare tile per day with a grass neighbor. */
export const GRASS_REGROW_PERMILLE = 120;
/** Default; species may override. */
export const SAPLING_YEARS = 2;

/**
 * `07` § Player-facing behavior (T-512, T-516): days of a crop's first season kept back for the
 * sowing itself when the plot panel reckons whether a crop sown now ripens before winter.
 */
export const SOWING_MARGIN_DAYS = 3;

/** `07` § Concepts: crops have four stages, `0 sprout … 3 mature`. */
export const CROP_STAGE_MAX = 3;

/** The priority a `DesignateHarvest` gives its tiles (`PRIORITY_DEFAULT` of the designation menu). */
export const HARVEST_PRIORITY = 5;

/** `07` § Farm plots: the harvest roll gains one unit per this many farming skill levels. */
export const YIELD_LEVELS_PER_BONUS = 5;
/** "capped at `yieldMax + 2`". */
export const YIELD_BONUS_MAX = 2;

/** `07` § Trees, § Regrowth: "no tree or sapling within 2 tiles". */
export const SAPLING_CLEARANCE = 2;

/** `07` § Farm plots: "a crop on a tile … flooded to level ≥ 4 dies" (`FLUID_DEEP_LEVEL`). */
export const CROP_DROWN_LEVEL = 4;
