/** `02-systems/25-runecraft.md` § Tuning constants: the rows that have landed. */

/** Rune maximum per `runecraft` level. */
export const RUNE_PER_LEVEL = 5;
/** Rune regained per hour per level. */
export const RUNE_REGEN_PER_LEVEL = 0.1;
/** Regen lost per worn metal piece of layer mail or plate, in percent. */
export const METAL_RUNE_PENALTY_PERCENT = 20;
/** Regen never falls below this percent for metal. */
export const METAL_RUNE_FLOOR_PERCENT = 20;
/** Apprentices a sanctum holds. */
export const SANCTUM_APPRENTICES = 4;
/** An `attune` job's base work time. */
export const ATTUNE_TICKS = 300;
/** A session's xp before the sanctum's tier and the dwarf's Wits. */
export const ATTUNE_XP = 25;
/** Sessions an apprentice sits in a day. */
export const ATTUNE_SESSIONS_PER_DAY = 2;
/** Mishap chance per mille at level 0 in a bare sanctum, less 2 per level and 1 per tier. */
export const MISHAP_BASE = 60;
/** The mishap chance never falls below this, per mille. */
export const MISHAP_FLOOR = 10;
/** A blackout's length. */
export const MISHAP_BLACKOUT_TICKS = 200;
/** A surge burns every creature this close to the circle (Chebyshev, on its level). */
export const MISHAP_SURGE_RADIUS = 3;
/** A Frostbind hit slows its target by this percent. */
export const FROSTBIND_SLOW_PERCENT = 50;
