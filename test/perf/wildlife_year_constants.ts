/** Accepted annual measurements and the testing-strategy.md regression policy. */
import type { WildlifeFigures } from './wildlife_year_measurements';

export const WILDLIFE_TARGET = { median: 11, worst: 8, hungerThirstDeaths: 0 };
// Best accepted figures set the guards; preserve a tolerated loss rather than ratcheting down.
export const WILDLIFE_MEASURED: WildlifeFigures = {
  median: 13, worst: 3, secondWorst: 10, wildlifeFree: 8, extinct: 0, hungerThirstDeaths: 0,
};
// Latest accepted distribution: simultaneous regressions compare an actual before/after pair.
export const WILDLIFE_REFERENCE: WildlifeFigures = {
  median: 13, worst: 0, secondWorst: 9, wildlifeFree: 8, extinct: 1, hungerThirstDeaths: 0,
};
export const MEDIAN_REGRESSION_TOLERANCE = 1;
export const WILDLIFE_FREE_REGRESSION_TOLERANCE = 2;
export const SECOND_WORST_REGRESSION_TOLERANCE = 2;
export const EXTINCTION_REGRESSION_TOLERANCE = 1;
export const NEED_DEATH_REGRESSION_TOLERANCE = 1;
export const COMBINED_REGRESSION_LIMIT = 3;
