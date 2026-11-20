/** 12 Workshops & Professions, Tuning constants. */
export const MAGMA_POWER_LEVEL = 4;
export const MELT_RETURN_PERCENT = 60;

/** A current job nobody has taken looks for a runnable order ahead of it this often (T-527). */
export const ORDER_AHEAD_TICKS = 100;
/** How long a workshop skips an order whose inputs exist but lie out of its worker's reach before it looks again. */
export const OUT_OF_REACH_RETRY_TICKS = 100;

/** 12 § Fuel: a fuel job burns this many half fuels (`fuel_half`: peat bricks, dung cakes) in place of one bar. */
export const HALF_FUELS_PER_JOB = 2;
/** 12 § Smoke, salt and the smokehouse: the hunger a dwarf near a smokehouse gains when it finishes a batch. */
export const SMOKEHOUSE_HUNGER = 5;
