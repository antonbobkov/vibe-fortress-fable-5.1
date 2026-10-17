/**
 * 11 Jobs & labor tuning constants: every row of `02-systems/11-jobs-and-labor.md`
 * § Tuning constants, verbatim. `SKILL_TIME_BONUS_PERCENT` is "Shared with 03; defined there;
 * referenced here", so it is re-exported from 03's constants rather than restated.
 */

export { SKILL_TIME_BONUS_PERCENT } from '@systems/terrain/constants';

export const ASSIGN_WORKERS_PER_TICK = 8;
export const CANDIDATE_LIMIT = 32;
/** Tiles of horizontal distance one z-level counts as. */
export const Z_DISTANCE_WEIGHT = 6;
export const RESERVE_KEEP_TICKS = 600;
/** A job held by a worker away from work this long goes back to the board (unmeasured). */
export const JOB_HOLD_TICKS = 600;
export const BLOCKED_RETRY_TICKS = 100;
export const BLOCKED_RETRIES_PER_TICK = 20;
/** A job for a patient at this priority calls a worker off interruptible work. */
export const PATIENT_SUMMON_PRIORITY = 1;
/** Hauling is below default work. */
export const HAUL_PRIORITY = 6;
export const HAUL_PRIORITY_FOOD = 5;
export const IDLE_HAULER_WARNING = 200;
export const HAULER_WARNING_MIN_WORKERS = 3;

/** `11` § Standing orders: "All default on." */
export const STANDING_ORDERS: readonly string[] = [
  'autoHarvest',
  'autoCollectProducts',
  'autoButcher',
  'autoHaulRefuse',
  'autoRearmTraps',
  'autoMeltMarked',
];
