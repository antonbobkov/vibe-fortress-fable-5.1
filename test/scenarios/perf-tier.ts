/**
 * Scenarios that run in the performance tier (`npm run test:perf`), not in `npm test`.
 *
 * The list is explicit and named: `m8.test.ts` leaves these out, `index.test.ts` checks that each
 * one names a real scenario and has its perf test file, and nothing else is skipped. A scenario
 * is added here only by a decision recorded in `docs/process/testing-strategy.md` § The long
 * scenarios.
 */

export interface PerfTierScenario {
  /** The scenario id (its file name without `.scenario.ts`). */
  readonly id: string;
  /** The test file that runs it, relative to the repository root. */
  readonly file: string;
}

export const PERF_TIER_SCENARIOS: readonly PerfTierScenario[] = [
  // T-140: the economy run grows to about 43 dwarves at walking speed x1.5 and takes about
  // 18 minutes. A balance instrument, not a per-commit gate; every assertion is unchanged.
  { id: 'three_years', file: 'test/perf/three_years_main.test.ts' },
];

export function isPerfTierScenario(id: string): boolean {
  return PERF_TIER_SCENARIOS.some((s) => s.id === id);
}
