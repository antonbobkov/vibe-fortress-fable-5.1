/** T-136: distributions include extinct fortresses and distinguish livestock losses. */
import type { WildlifeYear } from './wildlife_year_fixture';
import { COMBINED_REGRESSION_LIMIT, WORSENED_SHARE, WILDLIFE_TOLERANCE } from './wildlife_year_constants';

const needDeath = (death: Pick<WildlifeYear, 'deaths'>['deaths'][number]): boolean =>
  death.kind === 'dwarf' && ['starvation', 'dehydration'].includes(death.cause);

export function distribution(years: readonly Pick<WildlifeYear, 'living' | 'deaths'>[]): {
  median: number; worst: number; secondWorst: number; living: number; wildlifeFree: number; seeds: number; extinct: number; hungerThirstDeaths: number; starvedYears: number;
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
    hungerThirstDeaths: years.flatMap((row) => row.deaths).filter(needDeath).length,
    starvedYears: years.filter((row) => row.deaths.some(needDeath)).length,
  };
}

/**
 * T-509: the instrument's figures pooled over its samples, the same code shifted 0 to N-1 ticks.
 * The median, the sum of the living, wildlife-free years, the worst and the second-worst are each
 * the mean over the samples; extinct years, years with a need death and need deaths are counted
 * over all of them.
 */
export interface WildlifeFigures {
  median: number;
  worst: number;
  secondWorst: number;
  /** The sum of the living over the twelve seeds, the mean of the samples. */
  living: number;
  wildlifeFree: number;
  /** Extinct fortresses over all the samples' years. */
  extinct: number;
  /** Years with a dwarf dead of hunger or thirst, over all the samples' years. */
  starvedYears: number;
  /** Dwarves dead of hunger or thirst, over all the samples (reported, not guarded). */
  hungerThirstDeaths: number;
}

export type Sample = Omit<ReturnType<typeof distribution>, 'seeds'>;

const mean = (values: readonly number[]): number => Math.round(values.reduce((sum, n) => sum + n, 0) / values.length * 100) / 100;

export function pool(samples: readonly Sample[]): WildlifeFigures & { samples: number } {
  if (samples.length === 0) throw new Error('A pooled verdict needs at least one sample');
  const total = (key: keyof Sample): number => samples.reduce((sum, s) => sum + s[key], 0);
  return {
    samples: samples.length,
    median: mean(samples.map((s) => s.median)),
    worst: mean(samples.map((s) => s.worst)),
    secondWorst: mean(samples.map((s) => s.secondWorst)),
    living: mean(samples.map((s) => s.living)),
    wildlifeFree: mean(samples.map((s) => s.wildlifeFree)),
    extinct: total('extinct'),
    starvedYears: total('starvedYears'),
    hungerThirstDeaths: total('hungerThirstDeaths'),
  };
}

export type GuardedWildlifeFigures = Pick<WildlifeFigures, 'median' | 'living' | 'wildlifeFree' | 'extinct' | 'starvedYears'>;

const FIGURES = ['median', 'living', 'wildlifeFree', 'extinct', 'starvedYears'] as const;
const lowerIsBetter = (key: keyof WildlifeFigures): boolean => key === 'extinct' || key === 'starvedYears' || key === 'hungerThirstDeaths';

export function measuredBounds(measured: WildlifeFigures): GuardedWildlifeFigures {
  return Object.fromEntries(FIGURES.map((key) => [key, lowerIsBetter(key)
    ? measured[key] + WILDLIFE_TOLERANCE[key] : Math.round((measured[key] - WILDLIFE_TOLERANCE[key]) * 100) / 100])) as GuardedWildlifeFigures;
}

/**
 * Guard the best pooled figures; count simultaneous losses against the latest accepted pooled row.
 * A figure has worsened when it falls by more than `WORSENED_SHARE` of its tolerance.
 */
export function regressionCheck(before: WildlifeFigures, after: WildlifeFigures, measured: WildlifeFigures) {
  const floors = measuredBounds(measured);
  const loss = (key: (typeof FIGURES)[number]): number => lowerIsBetter(key) ? after[key] - before[key] : before[key] - after[key];
  const worsened = FIGURES.filter((key) => loss(key) > WORSENED_SHARE * WILDLIFE_TOLERANCE[key]);
  const exceeded = FIGURES.filter((key) => lowerIsBetter(key) ? after[key] > floors[key] : after[key] < floors[key]);
  return { floors, worsened, exceeded, allowed: exceeded.length === 0 && worsened.length < COMBINED_REGRESSION_LIMIT };
}

/** An accepted improvement tightens its guard; tolerated drops do not loosen measured bounds. */
export function improvedMeasurements(measured: WildlifeFigures, after: WildlifeFigures): WildlifeFigures {
  const next = { ...measured };
  // Keep the best reported worst, second-worst and need deaths too, although none is guarded.
  for (const key of [...FIGURES, 'worst', 'secondWorst', 'hungerThirstDeaths'] as const) next[key] = lowerIsBetter(key)
    ? Math.min(measured[key], after[key]) : Math.max(measured[key], after[key]);
  return next;
}
