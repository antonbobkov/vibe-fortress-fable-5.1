/**
 * The main `three_years` scenario (T-M8-06), run in the performance tier (T-140).
 *
 * At walking speed x1.5 the economy fortress grows to about 43 dwarves and the three-year run takes
 * about 18 minutes, so it is a balance instrument and not a per-commit gate. It runs here through
 * the same `runScenario` as every other scenario, with every assertion the scenario file carries
 * and its timeout raised to fit. The place is recorded in `test/scenarios/perf-tier.ts`.
 */

import { describe, it } from 'vitest';
import { runScenario } from '../scenarios/runner';
import scenario from '../scenarios/three_years.scenario';

describe('T-M8-06 perf: three_years (main scenario)', () => {
  it(
    `${scenario.id} (M${scenario.milestone})`,
    () => {
      runScenario(scenario);
    },
    scenario.timeoutMs,
  );
});
