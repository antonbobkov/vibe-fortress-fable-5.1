/**
 * 04 Fluids tuning constants: every row of `02-systems/04-fluids.md` § Tuning constants, verbatim.
 * The level scale and the cadences are global (`src/core/constants.ts`).
 */

/** Idle steps before a tile sleeps. */
export const FLUID_SETTLE_STEPS = 8;
/** Chance to move a unit into a neighbor at level − 1. */
export const SPREAD_EQUALIZE_PERMILLE = 500;
/** Equalizing moves a tile may make between two real flows. */
export const FLUID_EQUALIZE_BUDGET = 16;
/** Units a tile may give away sideways per step. */
export const SPREAD_MAX_PER_STEP = 2;
/** Tiles per body search. */
export const PRESSURE_SEARCH_LIMIT = 256;
/** Total search tiles per step. */
export const PRESSURE_BUDGET_TILES = 4000;
/** Per step for an isolated level-1 water tile (about 250 ticks to vanish on average). */
export const WATER_EVAPORATE_PERMILLE = 8;
/** Magma level at or above which contact makes a wall. */
export const OBSIDIAN_WALL_LEVEL = 4;
/** Water level at or above which freezing makes a wall. */
export const ICE_WALL_LEVEL = 4;
/** Hysteresis so tiles do not flicker. */
export const FREEZE_C = -1;
export const THAW_C = 2;
export const MIST_DURATION_TICKS = 100;
/** Temperature used for melting items. */
export const MAGMA_C = 1200;
