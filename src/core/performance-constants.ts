/** performance-budget.md § Load shedding rules; prose names and sampling choice: D-210.
 * Kept beside the other core constant tables because constants.ts is pinned to its own spec.
 */
export const LOAD_SHEDDING_RATE_PERCENT = 80;
export const LOAD_SHEDDING_ENGAGE_MS = 2_000;
export const LOAD_SHEDDING_RECOVER_MS = 5_000;
export const LOAD_SHEDDING_RATE_SAMPLE_MS = 1_000;
export const LOAD_SHEDDING_PATH_DIVISOR = 2;
