/** Accepted annual measurements and the testing-strategy.md regression policy. */
import type { WildlifeFigures } from './wildlife_year_measurements';

export const WILDLIFE_TARGET = { median: 11, worst: 8, hungerThirstDeaths: 0 };
/**
 * T-509: a verdict pools this many samples of the same code, shifted 0 to N-1 ticks before the
 * opening (measure.yml's default `shifts`). One sample's bounds were inside the timeline's noise.
 */
export const WILDLIFE_SAMPLES = 8;
// Best accepted pooled figures set the guards; preserve a tolerated loss rather than ratcheting down.
// T-544: shifts 0 to 7 of `4ab37734`, T-544 merged with T-545's quiet season between dangerous wild
// arrivals (run 43573353421), the row T-545 proposed; T-544 alone does not move the instrument (run
// 43563647188 equals master's 43561445362). The row before, T-509's first pooled row (shifts 0 to 7
// of `de028566`, run 42151935437), was 12.63/6/8.88/143/6.63/0/0.
export const WILDLIFE_MEASURED: WildlifeFigures = {
  median: 12.94, worst: 9.63, secondWorst: 10.5, living: 151.88, wildlifeFree: 9.38, extinct: 0, starvedYears: 0, hungerThirstDeaths: 0,
};
// Latest accepted pooled row: simultaneous regressions compare an actual before/after pair.
export const WILDLIFE_REFERENCE: WildlifeFigures = {
  median: 12.94, worst: 9.63, secondWorst: 10.5, living: 151.88, wildlifeFree: 9.38, extinct: 0, starvedYears: 0, hungerThirstDeaths: 0,
};
/**
 * T-509: each guarded figure's tolerance, wider than the measured spread of its pooled value: over
 * every split of sixteen shifts of one commit into two sets of eight (two commits, 25,740 splits),
 * the two means differed by at most 1.06 in the median, 12.5 in the sum and 2.25 in wildlife-free
 * years, and the counts by one extinct year and no starved year; over twelve shifts of master
 * before the fix, by one of each (testing-strategy.md § Annual wildlife survival).
 */
export const WILDLIFE_TOLERANCE = { median: 1.25, living: 13, wildlifeFree: 2.5, extinct: 2, starvedYears: 2 };
/** A figure counts as worsened together with others when it falls by more than this share of its tolerance. */
export const WORSENED_SHARE = 0.5;
export const COMBINED_REGRESSION_LIMIT = 3;
