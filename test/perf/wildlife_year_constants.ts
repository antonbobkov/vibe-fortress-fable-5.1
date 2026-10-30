/** Accepted annual measurements and the testing-strategy.md regression policy. */
import type { WildlifeFigures } from './wildlife_year_measurements';

export const WILDLIFE_TARGET = { median: 11, worst: 8, hungerThirstDeaths: 0 };
// Best accepted figures set the guards; preserve a tolerated loss rather than ratcheting down.
// T-448: the instrument moved to relief 1, a new fixture; the guards restart from its first row.
export const WILDLIFE_MEASURED: WildlifeFigures = {
  median: 11.5, worst: 5, secondWorst: 5, living: 130, wildlifeFree: 5, extinct: 0, hungerThirstDeaths: 0,
};
// Latest accepted distribution: simultaneous regressions compare an actual before/after pair.
export const WILDLIFE_REFERENCE: WildlifeFigures = {
  median: 11.5, worst: 5, secondWorst: 5, living: 130, wildlifeFree: 5, extinct: 0, hungerThirstDeaths: 0,
};
export const MEDIAN_REGRESSION_TOLERANCE = 1;
export const WILDLIFE_FREE_REGRESSION_TOLERANCE = 2;
/** The sum of the living over the twelve seeds; neutral changes of the job timeline moved it by up to 9. */
export const LIVING_SUM_REGRESSION_TOLERANCE = 12;
export const EXTINCTION_REGRESSION_TOLERANCE = 1;
export const NEED_DEATH_REGRESSION_TOLERANCE = 1;
export const COMBINED_REGRESSION_LIMIT = 3;
