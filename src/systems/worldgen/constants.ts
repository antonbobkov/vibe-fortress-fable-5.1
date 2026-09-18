/**
 * 01 World generation tuning constants.
 *
 * Every row of `02-systems/01-world-generation.md` § Tuning constants, verbatim. Percentages are
 * integer percents. Nothing here is duplicated in `src/core/constants.ts`.
 */

/** Elevation of the sea. */
export const SEA_LEVEL = 96;
/** Start of the hills band. */
export const HILLS_ELEVATION = 130;
/** Start of the mountain band. */
export const MOUNTAIN_ELEVATION = 165;
/** Retry elevation if less land (percent of all regions). */
export const MIN_LAND_FRACTION = 35;
/** degrees C at the south edge at sea level. */
export const TEMP_SOUTH = 30;
/** degrees C at the north edge at sea level. */
export const TEMP_NORTH = -12;
/** degrees C lost per 100 elevation units above sea level. */
export const TEMP_LAPSE_PER_ELEVATION = 22;
/** Rain removed immediately east of mountains. */
export const RAIN_SHADOW_STRENGTH = 90;
/** Shadow decay per region. */
export const RAIN_SHADOW_DECAY = 18;
export const COAST_RAIN_BONUS = 30;
export const RIVER_SOURCE_ELEVATION = 150;
export const RIVER_SOURCE_RAIN = 120;
/** Regions of brook before river. */
export const BROOK_LENGTH = 3;
/** Regions before a river becomes major. */
export const MAJOR_LENGTH = 12;
/** Per mountain region. */
export const VOLCANO_CHANCE_PERMILLE = 40;
/** Regions between homes. */
export const CIV_MIN_SEPARATION = 10;
/** Regions of distance from the Gloam per peril point. */
export const PERIL_DISTANCE_STEP = 6;
export const TRAIT_MAX_PER_REGION = 2;
