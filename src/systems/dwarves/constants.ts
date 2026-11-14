/**
 * 10 Dwarves tuning constants: every row of `02-systems/10-dwarves.md` § Tuning constants,
 * verbatim.
 */

export const ADULT_AGE_YEARS = 12;
/** Per level-up. */
export const ATTRIBUTE_DRIFT = 1;
/** Days at hunger 100 before damage. */
export const STARVE_DAYS = 7;
export const DEHYDRATE_DAYS = 3;
export const EAT_TICKS = 60;
export const DRINK_TICKS = 40;
export const SLEEP_HOURS = 7;
export const TALK_TICKS = 80;
/** Ticks between two scans for talks in passing. */
export const TALK_CHECK_TICKS = 10;
/** `creature-brains.md` § startNeed social: wait up to 200 ticks. */
export const SOCIAL_WAIT_TICKS = 200;
/** `creature-brains.md` § startNeed joy: visit the hearth for 100 ticks. */
export const HEARTH_VISIT_TICKS = 100;
export const SIT_TICKS = 100;
/** Social, comfort or joy at this level sends a dwarf to sit in the hearth hall before ordinary work. */
export const LEISURE_MARK = 75;
/** After a hall errand that left one of the three at the mark, no other before work for this long. */
export const LEISURE_RETRY_TICKS = 600;
export const IDLE_TICKS = 50;
/** Tiles (path distance). */
export const DINING_SEARCH_RADIUS = 40;
/** Tiles, horizontal Chebyshev from the dwarf: how far the drink search looks for water. */
export const DRINK_SEARCH_RADIUS = 64;
/** Tiles a dwarf leaving rising water searches for a dry one. */
export const WATER_FLEE_NODE_LIMIT = 2048;
/** A job at priority 1–2 is done before a want-level need. */
export const NEED_DEFER_PRIORITY = 2;
export const NEED_RETRY_TICKS = 50;
export const THREAT_RADIUS = 8;
/** Ticks without a melee or ranged attack opportunity before a civilian leaves combat. */
export const CIVILIAN_COMBAT_TIMEOUT_TICKS = 200;
/** Legal tile visits in the civilian escape fallback search. */
export const CIVILIAN_FLEE_NODE_LIMIT = 256;
/** Maximum legal tile visits in the search of a dwarf running from a fire for ground that cannot burn. */
export const FIRE_FLEE_NODE_LIMIT = 2048;
/** Ticks after its last flight from a fire during which a dwarf takes no work and starts no want near a fire. */
export const FIRE_AVOID_TICKS = 200;
/** Tiles, horizontal Chebyshev on one level: how near a burning tile makes a job's tile or a need's target unfit for such a dwarf. */
export const FIRE_AVOID_RADIUS = 3;
export const FRIEND_TALKS = 5;
export const GRUDGE_DAYS = 28;
export const THANE_SOCIAL_BONUS = 20;
export const WARDEN_TRAINING_BONUS_PERCENT = 25;
/** Items heavier than 3 × the carrier's size units halve speed. */
export const HEAVY_ITEM_DENSITY = 3;
/** Ticks. */
export const MIST_THOUGHT_COOLDOWN = 1200;

/** `10` § Eating and drinking: thirst a drinkable plant (cactus pulp) relieves, half of water's 80. */
export const CACTUS_THIRST_RELIEF = 40;
