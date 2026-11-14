/**
 * 13 Items & storage tuning constants: every row of `02-systems/13-items-and-storage.md`
 * § Tuning constants, verbatim.
 */

/** Items per bin. */
export const BIN_CAPACITY = 30;
/** Units of drink or food per barrel. */
export const BARREL_CAPACITY = 20;
/** Seeds or units of powder. */
export const BAG_CAPACITY = 25;
export const CHEST_CAPACITY = 20;
/** New haul jobs created per items tick. */
export const HAUL_JOBS_PER_TICK = 20;
/** Rot speed inside a container in a stockpile. */
export const ROT_CONTAINER_PERCENT = 25;
export const ROT_HOT_C = 30;
export const ROT_COLD_C = 5;
/** Ticks. */
export const MIASMA_DURATION = 300;
/** Tiles. */
export const FIND_RADIUS_MAX = 48;
/** Marks. */
export const WEALTH_EVENT_STEP = 250;
/** Default; species may override. */
export const CORPSE_ROT_DAYS = 14;
/** An enchanted item's value adds its stone's value times this. */
export const ENCHANT_STONE_VALUE_MULT = 3;
/** An enchanted item's value adds this for each rune vial its setting burned. */
export const ENCHANT_VIAL_VALUE = 15;
/** °C: the coolest a working cellar's tiles may be. */
export const CELLAR_MIN_C = 2;
/** °C: the warmest a working cellar's tiles may be. */
export const CELLAR_MAX_C = 14;
/** An aged item's value, percent of its young value. */
export const AGED_VALUE_PERCENT = 150;
/** A vintage item's value, percent of its young value. */
export const VINTAGE_VALUE_PERCENT = 250;

/**
 * `12-workshops-and-professions.md` § Quality, "Value multiplier" column, in permille, by quality
 * tier (poor, common, fine, superior, exceptional, masterwork). 13 § Value reads "12's tier table
 * (0.5 … 5.0)".
 */
export const QUALITY_VALUE_PERMILLE: readonly number[] = Object.freeze([500, 1000, 1500, 2000, 3000, 5000]);

/** The radii `findItem` expands through (`algorithms/jobs-and-hauling.md` § Item search). */
export const FIND_RADII: readonly number[] = Object.freeze([4, 8, 16, 32, FIND_RADIUS_MAX]);
