/**
 * `fl_perf` of `04-implementation/acceptance-tests.md` § 04 Fluids ("reference fortress with a
 * 40-tile waterfall channel, 2,000 ticks | average fluids tick ≤ 3 ms on CI (2× budget)") with the
 * pathing assertion of `M3-water-fire-sky.md` T-M3-09 (≤ 2 ms average, 2× 22's 1.0 ms budget) and
 * the two rules of `01-testing-strategy.md` § Performance smoke: "average tick ≤ 2× the budget of
 * the systems present, worst tick ≤ 40 ms".
 */

import { describe, it, expect } from 'vitest';
import { buildReferenceFortress, runReferenceFortress } from './reference-fortress';

const TICKS = 2000;

/** `performance-budget.md` § Per-system tick budget, the systems M3 has. */
const BUDGET_MS: Readonly<Record<string, number>> = { '03': 0.1, '04': 1.5, '05': 0.15, '06': 0.02, '10': 0.5, '11': 0.6, '13': 0.3, '14': 0.1 };
const PATHING_BUDGET_MS = 1.0;
const CORE_BUDGET_MS = 0.3;
/** "average tick ≤ 2× the budget", "average fluids tick ≤ 3 ms on CI (2× budget)". */
const TOLERANCE = 2;
/** `01-testing-strategy.md` § Performance smoke. */
const WORST_TICK_MS = 40;

describe('T-M3-09 perf: fl_perf', () => {
  it('fluids, pathing and the whole tick stay inside their budgets on the reference fortress', () => {
    const now = (): number => performance.now();
    const fortress = buildReferenceFortress({ now });
    // A warm-up: the first ticks pay for the lazy first passes of 04 and 05 and the first paths.
    runReferenceFortress(fortress, 200, now);
    const run = runReferenceFortress(fortress, TICKS, now);
    const lines = [
      `ticks ${run.ticks}`,
      `average tick ${run.averageTickMs.toFixed(2)} ms`,
      `worst tick ${run.worstTickMs.toFixed(2)} ms`,
      `pathing (22 + connectivity) ${run.pathingMs.toFixed(3)} ms`,
      `relabelled on ${run.relabelTicks} ticks`,
      ...Object.entries(run.systems).map(([id, ms]) => `${id} ${ms.toFixed(3)} ms`),
    ];
    console.log(`fl_perf: ${lines.join(', ')}`);

    expect(run.systems['04'] ?? 0).toBeLessThanOrEqual(TOLERANCE * (BUDGET_MS['04'] as number));
    expect(run.pathingMs).toBeLessThanOrEqual(TOLERANCE * PATHING_BUDGET_MS);
    const budget = Object.values(BUDGET_MS).reduce((a, b) => a + b, 0) + PATHING_BUDGET_MS + CORE_BUDGET_MS;
    expect(run.averageTickMs).toBeLessThanOrEqual(TOLERANCE * budget);
    expect(run.worstTickMs).toBeLessThanOrEqual(WORST_TICK_MS);
  });
});
