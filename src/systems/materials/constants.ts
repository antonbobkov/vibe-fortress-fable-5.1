/**
 * 05 Materials & temperature tuning constants: every row of
 * `02-systems/05-materials-and-temperature.md` § Tuning constants, verbatim. `MAGMA_C` is 04's
 * (`src/systems/fluids/constants.ts`).
 */

/** Constant temperature at depth. */
export const UNDERGROUND_BASE_C = 10;
/** z-levels over which surface temperature blends into the base. */
export const NEAR_SURFACE_DEPTH = 3;
/** Below this, temperature rises toward the magma sea. */
export const DEEP_HEAT_START_Z = 12;
/** °C per level below `DEEP_HEAT_START_Z`. */
export const DEEP_HEAT_PER_Z = 3;
/** ×5 °C = +80 at the magma tile. */
export const MAGMA_OVERRIDE = 16;
/** +60 at the burning tile. */
export const FIRE_OVERRIDE = 12;
/** +25. */
export const SPRING_OVERRIDE = 5;
/** −5. */
export const SNOW_OVERRIDE = 1;
/** Per neighbor per attempt. */
export const FIRE_SPREAD_PERMILLE = 150;
/** Under rain. */
export const FIRE_SPREAD_WET_PERMILLE = 20;
/** Ticks between spread attempts. */
export const FIRE_SPREAD_COOLDOWN = 30;
export const ITEM_BURN_TICKS = 100;
/** Damage units per materials tick to a creature on a burning tile. */
export const BURN_TICK_DAMAGE = 6;
/** Per tick. */
export const RAIN_EXTINGUISH_PERMILLE = 30;
export const ASH_DURATION_DAYS = 28;
/** Surface crops die below this. */
export const FROST_KILL_C = -2;
/** Heat stroke. */
export const HEAT_INJURY_C = 55;
/** Frostbite. */
export const COLD_INJURY_C = -25;

/** `tempOverride` is "clamped to ±120 °C": ±24 units of 5 °C. */
export const TEMP_OVERRIDE_LIMIT = 24;
/** The materials tick (`tick-order.md`: 05 runs at `(tick − 3) % 10`). */
export const MATERIALS_CADENCE = 10;
export const MATERIALS_PHASE = 3;
