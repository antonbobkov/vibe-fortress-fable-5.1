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
/** `creature-brains.md` § startNeed social: wait up to 200 ticks. */
export const SOCIAL_WAIT_TICKS = 200;
/** `creature-brains.md` § startNeed joy: visit the hearth for 100 ticks. */
export const HEARTH_VISIT_TICKS = 100;
export const SIT_TICKS = 100;
export const IDLE_TICKS = 50;
/** Tiles (path distance). */
export const DINING_SEARCH_RADIUS = 40;
/** A job at priority 1–2 is done before a want-level need. */
export const NEED_DEFER_PRIORITY = 2;
export const THREAT_RADIUS = 8;
export const FRIEND_TALKS = 5;
export const GRUDGE_DAYS = 28;
export const THANE_SOCIAL_BONUS = 20;
export const WARDEN_TRAINING_BONUS_PERCENT = 25;
/** Items heavier than 3 × the carrier's size units halve speed. */
export const HEAVY_ITEM_DENSITY = 3;
/** Ticks. */
export const MIST_THOUGHT_COOLDOWN = 1200;
