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
/** A support caster with rune stands this far from its target. */
export const CASTER_HOLD_DISTANCE = 4;
/** Rune vials a caster carries. */
export const CASTER_VIALS = 3;
/** Rune a drunk vial gives back, whole rune. */
export const VIAL_RUNE = 5;
/** Vials a caster drinks in a day at most. */
export const VIALS_PER_DAY = 3;
/** A drink holds the caster's next attack this long. */
export const DRINK_TICKS = 30;
/** Ticks between a Firebloom's cast and its bloom. */
export const FIREBLOOM_DELAY_TICKS = 20;
/** Creatures one Dread sends running at most. */
export const DREAD_MAX_TARGETS = 4;
/** The resist chance of a creature with no attributes, in percent. */
export const RESIST_NO_ATTRIBUTES_PERCENT = 25;
/** Creatures of at least this size are immune to Dread and Daze. */
export const MENTAL_IMMUNE_SIZE = 180;
/** A soldier's claim score for an enchanted weapon or armor piece adds this. */
export const ENCHANT_CLAIM_BONUS = 0.5;
/** A draught's effects last this long at common quality, times the quality multiplier: one day. */
export const DRAUGHT_TICKS = 1200;
/** Days after any draught before the dwarf takes another. */
export const DRAUGHT_REST_DAYS = 3;
/** Days after a calming draught before a medic gives another. */
export const CALM_REST_DAYS = 7;
/** A spoilable batch spoils at this per mille, less 10 per level of the worker's skill. */
export const ALCHEMY_MISHAP_PERMILLE = 100;
/** A summon fades this long after its call: one day. */
export const SUMMON_TICKS = 1200;
/** Summons one caster has alive at most; a Call is not cast at this many. */
export const MAX_SUMMONS_PER_CASTER = 2;
/** A species that `turns` comes through turned with this chance per mille, on stream 25. */
export const SHADE_TURN_PERMILLE = 50;
/** The `deep` draughts are drunk when the Deep stirs or emerges at this level or above. */
export const DEEP_DRAUGHT_LEVEL = 2;
/** A hexer's rune at arrival, in whole rune; it never comes back (§ Hexers). */
export const HEXER_RUNE = 20;
