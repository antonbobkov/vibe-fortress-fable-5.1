/** T-136: distributions include extinct fortresses and distinguish livestock losses. */
import type { WildlifeYear } from './wildlife_year_fixture';
import { COMBINED_REGRESSION_LIMIT, MEDIAN_REGRESSION_TOLERANCE, WILDLIFE_FREE_REGRESSION_TOLERANCE, LIVING_SUM_REGRESSION_TOLERANCE, EXTINCTION_REGRESSION_TOLERANCE, NEED_DEATH_REGRESSION_TOLERANCE } from './wildlife_year_constants';

export function distribution(years: readonly Pick<WildlifeYear, 'living' | 'deaths'>[]): {
  median: number; worst: number; secondWorst: number; living: number; wildlifeFree: number; seeds: number; extinct: number; hungerThirstDeaths: number;
} {
  const living = years.map((row) => row.living).sort((a, b) => a - b);
  if (living.length === 0) throw new Error('A wildlife distribution needs at least one year');
  const middle = Math.floor(living.length / 2);
  return {
    median: living.length % 2 === 0 ? (living[middle - 1]! + living[middle]!) / 2 : living[middle]!,
    worst: living[0]!,
    secondWorst: living[1] ?? living[0]!,
    living: living.reduce((sum, n) => sum + n, 0),
    wildlifeFree: years.filter((row) => !row.deaths.some((death) => death.kind === 'dwarf' && death.wildlife)).length,
    seeds: years.length,
    extinct: years.filter((row) => row.living === 0).length,
    hungerThirstDeaths: years.flatMap((row) => row.deaths).filter((death) =>
      death.kind === 'dwarf' && ['starvation', 'dehydration'].includes(death.cause)).length,
  };
}

export interface WildlifeFigures {
  median: number;
  worst: number;
  secondWorst: number;
  /** The sum of the living over the cohort. */
  living: number;
  wildlifeFree: number;
  extinct: number;
  hungerThirstDeaths: number;
}

export type GuardedWildlifeFigures = Omit<WildlifeFigures, 'worst' | 'secondWorst'>;

const FIGURES = ['median', 'living', 'wildlifeFree', 'extinct', 'hungerThirstDeaths'] as const;
const lowerIsBetter = (key: keyof WildlifeFigures): boolean => key === 'extinct' || key === 'hungerThirstDeaths';

export function measuredBounds(measured: WildlifeFigures): GuardedWildlifeFigures {
  return {
    median: measured.median - MEDIAN_REGRESSION_TOLERANCE,
    living: measured.living - LIVING_SUM_REGRESSION_TOLERANCE,
    wildlifeFree: measured.wildlifeFree - WILDLIFE_FREE_REGRESSION_TOLERANCE,
    extinct: measured.extinct + EXTINCTION_REGRESSION_TOLERANCE,
    hungerThirstDeaths: measured.hungerThirstDeaths + NEED_DEATH_REGRESSION_TOLERANCE,
  };
}

/** Guard the best measurements, but count simultaneous losses against the latest accepted row. */
export function regressionCheck(before: WildlifeFigures, after: WildlifeFigures, measured: WildlifeFigures) {
  const floors = measuredBounds(measured);
  const worsened = FIGURES.filter(key => lowerIsBetter(key) ? after[key] > before[key] : after[key] < before[key]);
  const exceeded = FIGURES.filter(key => lowerIsBetter(key) ? after[key] > floors[key] : after[key] < floors[key]);
  return { floors, worsened, exceeded, allowed: exceeded.length === 0 && worsened.length < COMBINED_REGRESSION_LIMIT };
}

/** An accepted improvement tightens its guard; tolerated drops do not loosen measured bounds. */
export function improvedMeasurements(measured: WildlifeFigures, after: WildlifeFigures): WildlifeFigures {
  const next = { ...measured };
  // Keep the best reported minimum and second-worst too, although no single seed is guarded.
  for (const key of [...FIGURES, 'worst', 'secondWorst'] as const) next[key] = lowerIsBetter(key)
    ? Math.min(measured[key], after[key]) : Math.max(measured[key], after[key]);
  return next;
}
