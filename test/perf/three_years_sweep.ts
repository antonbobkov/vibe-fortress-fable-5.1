/**
 * T-513: the twenty-seed sweep's set rule and its verdict over pooled shifted sweeps
 * (testing-strategy.md § What may be a gate). measure.yml's `sweep` suite plays every seed of
 * `three_years_seeds.test.ts` once per shift, and `three_years_sweep_verdict.test.ts` pools them.
 */

/** Founders: a peril-0 fortress has grown when it ends year 3 above this. */
export const EMBARK_SIZE = 7;
export const SWEEP_SEEDS = 20;
/**
 * A verdict pools this many sweeps of the same code, each shifted before the opening by a multiple of
 * SWEEP_SHIFT_STEP: 80 jobs, about 40 minutes on GitHub's twenty free runners when nothing else queues.
 */
export const SWEEP_SAMPLES = 4;
/**
 * Ticks between two sweeps' shifts. Shifts 2 to 10 end year 3 with the same world hash on every seed
 * measured but one, and shifts 450, 500 and 550 on most seeds; shifts 0 to 400 ticks, 50 apart, are
 * each a timeline of their own on every seed.
 */
export const SWEEP_SHIFT_STEP = 50;
/** The shifts a verdict pools: 0, 50, 100, 150. */
export const SWEEP_SHIFTS: readonly number[] = [...Array(SWEEP_SAMPLES).keys()].map((k) => k * SWEEP_SHIFT_STEP);

/**
 * The set rule, read as a mean over the pooled sweeps: on average at least this many of the twenty
 * fortresses alive at year 1, at least this many of the seven peril-0 fortresses past embark size at
 * year 3, and at most this many peril-0 fortresses with a dwarf dead of hunger or thirst.
 */
export const SET_ALIVE_AT_YEAR_ONE = 18;
export const SET_PERIL_ZERO_GROWN = 6;
export const SET_PERIL_ZERO_NEED_DEATHS = 1;

export interface SweepSeedRow {
  readonly seed: string;
  readonly peril: number;
  readonly y1: number;
  readonly y3: number;
  readonly deaths: number;
  readonly needDeaths: number;
  readonly extinctDay: number | null;
}

/** One sweep's figures, or (pooled) their means over the sweeps. */
export interface SweepFigures {
  /** Fortresses alive at the end of year 1, of 20. */
  readonly alive: number;
  /** Peril-0 fortresses past embark size at the end of year 3, of 7. */
  readonly grown: number;
  /** Peril-0 fortresses with a dwarf dead of hunger or thirst, of 7. */
  readonly hungry: number;
  /** Dwarves living at the end of year 3, over the twenty. */
  readonly living: number;
  /** Dwarf deaths over the twenty. */
  readonly deaths: number;
  /** Fortresses extinct before the end of year 3. */
  readonly extinct: number;
  /** Dwarves dead of hunger or thirst, every peril. */
  readonly needDeaths: number;
}

export function sweepFigures(rows: readonly SweepSeedRow[]): SweepFigures {
  const peril0 = rows.filter((r) => r.peril === 0);
  return {
    alive: rows.filter((r) => r.y1 > 0).length,
    grown: peril0.filter((r) => r.y3 > EMBARK_SIZE).length,
    hungry: peril0.filter((r) => r.needDeaths > 0).length,
    living: rows.reduce((t, r) => t + r.y3, 0),
    deaths: rows.reduce((t, r) => t + r.deaths, 0),
    extinct: rows.filter((r) => r.extinctDay !== null).length,
    needDeaths: rows.reduce((t, r) => t + r.needDeaths, 0),
  };
}

const KEYS = ['alive', 'grown', 'hungry', 'living', 'deaths', 'extinct', 'needDeaths'] as const;
const round2 = (x: number): number => Math.round(x * 100) / 100;

/** Means over the sweeps, to two decimals. */
export function poolSweeps(samples: readonly SweepFigures[]): SweepFigures {
  const mean = (k: (typeof KEYS)[number]): number => round2(samples.reduce((t, s) => t + s[k], 0) / Math.max(1, samples.length));
  return Object.fromEntries(KEYS.map((k) => [k, mean(k)])) as unknown as SweepFigures;
}

/**
 * Tolerances of the guarded pooled figures, about two and a half times the noise of a four-shift mean
 * against the eight-shift best figures (T-662, under the fixed immigration rolls of T-652). Over 16
 * degrees of freedom of single sweeps of one code (eight shifts of `f83df33f` and three four-shift sweeps
 * of master's codes around it) one sweep's figures have a standard deviation of 52.3 living and 18.0
 * deaths, so a four-shift mean differs from an eight-shift one by 32.0 living and 11.0 deaths (one
 * standard deviation). The shared rolls halved the living's noise (92.4 a sweep on T-580's eight shifts);
 * the deaths' are the timeline's raids and ambushes and did not narrow (16.8), so their tolerance is kept
 * (testing-strategy.md § The twenty-seed sweep, reports/data/2026-11-22-t662-sweep-noise.md).
 */
export const SWEEP_TOLERANCE = { living: 80, deaths: 30 };
/**
 * T-662: inside the bounds, a pooled figure this far from the best figures (about twice the noise of a
 * four-shift mean against them) is worth tracing by seed before it is accepted; nearer is noise.
 */
export const SWEEP_TRACE = { living: 65, deaths: 22.5 };

// T-662: shifts 0, 50, 100 and 150 of master `f83df33f` (T-680), under T-652's fixed immigration rolls;
// Measure run 45005780661. The best figures are the means of its eight shifts (0 to 350, runs
// 45005780661 and 45005782771, the second pooling 1101.5 living and 106.75 deaths), as T-543 set them.
// The row before, of `2e36fb6d` (T-580, run 44200076970), was 19.5/7/0/1010.5/137, best 987.75 and 131.88:
// measured when each shift drew its own rolls, and 139 living and 29 deaths short of master's level since.
/** The best accepted pooled figures, which set the bounds; a tolerated loss is not ratcheted down. */
export const SWEEP_MEASURED: Pick<SweepFigures, 'living' | 'deaths'> = { living: 1126.63, deaths: 102.5 };
/** The latest accepted pooled row. */
export const SWEEP_REFERENCE: SweepFigures = { alive: 20, grown: 7, hungry: 0, living: 1151.75, deaths: 98.25, extinct: 0, needDeaths: 0 };

/** T-662: the guarded figures that are inside their bounds but further from the best figures than `SWEEP_TRACE`. */
export function sweepTrace(pooled: SweepFigures, measured = SWEEP_MEASURED, trace = SWEEP_TRACE): string[] {
  const out: string[] = [];
  if (pooled.living <= round2(measured.living - trace.living)) out.push(`living at year 3 (${pooled.living}, ${round2(measured.living - pooled.living)} under the best)`);
  if (pooled.deaths >= round2(measured.deaths + trace.deaths)) out.push(`dwarf deaths (${pooled.deaths}, ${round2(pooled.deaths - measured.deaths)} over the best)`);
  return out;
}

export interface SweepCheck {
  readonly allowed: boolean;
  readonly bounds: { alive: number; grown: number; hungry: number; living: number; deaths: number };
  readonly exceeded: string[];
}

export function sweepCheck(pooled: SweepFigures, measured = SWEEP_MEASURED, tolerance = SWEEP_TOLERANCE): SweepCheck {
  const bounds = {
    alive: SET_ALIVE_AT_YEAR_ONE,
    grown: SET_PERIL_ZERO_GROWN,
    hungry: SET_PERIL_ZERO_NEED_DEATHS,
    living: round2(measured.living - tolerance.living),
    deaths: round2(measured.deaths + tolerance.deaths),
  };
  const exceeded: string[] = [];
  if (pooled.alive < bounds.alive) exceeded.push('alive at year 1');
  if (pooled.grown < bounds.grown) exceeded.push('peril-0 grown');
  if (pooled.hungry > bounds.hungry) exceeded.push('peril-0 with need deaths');
  if (pooled.living < bounds.living) exceeded.push('living at year 3');
  if (pooled.deaths > bounds.deaths) exceeded.push('dwarf deaths');
  return { allowed: exceeded.length === 0, bounds, exceeded };
}

/** The best figures after an accepted change: each guarded figure keeps the better of old and new. */
export function improvedSweep(measured: Pick<SweepFigures, 'living' | 'deaths'>, pooled: SweepFigures): Pick<SweepFigures, 'living' | 'deaths'> {
  return { living: Math.max(measured.living, pooled.living), deaths: Math.min(measured.deaths, pooled.deaths) };
}
