/**
 * 02 Embark & loadout tuning constants: every row of `02-systems/02-embark-and-loadout.md`
 * § Tuning constants, verbatim.
 */

/** Years. */
export const EMBARK_AGE_MIN = 18;
/** Years. */
export const EMBARK_AGE_MAX = 65;
/** Marks. */
export const EMBARK_REROLL_COST = 25;
/** Added to item value for catalog price. */
export const EMBARK_MARKUP_PERCENT = 20;
/** Tiles inward from the edge to search for a wagon site. */
export const ARRIVAL_SEARCH_DEPTH = 20;
/** Logs from deconstructing the wagon. */
export const WAGON_LOGS = 3;
/** Elevation difference to a neighbour per relief level above 1 (`relief = 1 + floor(maxDiff / RELIEF_DIFF_STEP)`). */
export const RELIEF_DIFF_STEP = 96;
/** Most dwarves a testing embark can bring (`02` § Testing mode). */
export const EMBARK_TESTING_MAX_DWARVES = 50;
/** Most units of one catalog entry or one free item line in a testing embark. */
export const EMBARK_TESTING_MAX_COUNT = 999;
/** `02` § Ruins: the share of an ended fortress's constructed tiles that have fallen by the next embark (*unmeasured*). */
export const RUIN_COLLAPSE_PERMILLE = 250;
/** `02` § Ruins: the chance an ordinary item (furniture, stone, wood, containers, tools) is still there (*unmeasured*). */
export const RUIN_ITEM_KEEP_PERMILLE = 500;
/** `02` § Ruins: the chance a valuable item (bars, gems, crafts, weapons, armor, ammunition) escaped the looters (*unmeasured*). */
export const RUIN_ITEM_VALUABLE_PERMILLE = 200;
/** `02` § Ruins: the most items one ruin keeps (*unmeasured*). */
export const RUIN_ITEMS_MAX = 60;
