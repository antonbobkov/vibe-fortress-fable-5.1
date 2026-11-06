/** Accepted annual measurements and the testing-strategy.md regression policy. */
import type { WildlifeFigures } from './wildlife_year_measurements';

export const WILDLIFE_TARGET = { median: 11, worst: 8, hungerThirstDeaths: 0 };
/**
 * T-509: a verdict pools this many samples of the same code, shifted 0 to N-1 ticks before the
 * opening (measure.yml's default `shifts`). One sample's bounds were inside the timeline's noise.
 */
export const WILDLIFE_SAMPLES = 8;
// Best accepted pooled figures set the guards; preserve a tolerated loss rather than ratcheting down.
// T-509: the guards restart from the first pooled row (eight shifts of T-508's master, the opening digging for stone).
export const WILDLIFE_MEASURED: WildlifeFigures = {
  median: 0, worst: 0, secondWorst: 0, living: 0, wildlifeFree: 0, extinct: 0, starvedYears: 0, hungerThirstDeaths: 0,
};
// Latest accepted pooled row: simultaneous regressions compare an actual before/after pair.
export const WILDLIFE_REFERENCE: WildlifeFigures = {
  median: 0, worst: 0, secondWorst: 0, living: 0, wildlifeFree: 0, extinct: 0, starvedYears: 0, hungerThirstDeaths: 0,
};
/**
 * T-509: each guarded figure's tolerance, wider than the measured spread of its pooled value
 * between two sets of shifts of the same code (testing-strategy.md § Annual wildlife survival).
 */
export const WILDLIFE_TOLERANCE = { median: 0, living: 0, wildlifeFree: 0, extinct: 0, starvedYears: 0 };
/** A figure counts as worsened together with others when it falls by more than this share of its tolerance. */
export const WORSENED_SHARE = 0.5;
export const COMBINED_REGRESSION_LIMIT = 3;
