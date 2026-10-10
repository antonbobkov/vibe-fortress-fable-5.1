/**
 * Milestone 8 scenarios (F-09d).
 */

import { describe, it } from 'vitest';
import { isPerfTierScenario } from './perf-tier';
import { currentMilestone, runScenario, type Scenario } from './runner';

const modules = import.meta.glob('./*.scenario.ts', { eager: true }) as Record<
  string,
  { default: Scenario }
>;

const scenarios = Object.keys(modules)
  .sort()
  .map((path) => (modules[path] as { default: Scenario }).default)
  .filter((s) => s.milestone === 8 && !isPerfTierScenario(s.id));

const milestone = currentMilestone();

describe('Milestone 8 scenarios', () => {
  if (scenarios.length === 0) {
    it.skip('no milestone 8 scenarios yet', () => {});
    return;
  }

  for (const scenario of scenarios) {
    if (scenario.todo !== undefined) {
      it.todo(`${scenario.id} (M${scenario.milestone}) — ${scenario.todo}`);
      continue;
    }
    const skip = scenario.milestone > milestone;
    const test = skip ? it.skip : it;
    test(`${scenario.id} (M${scenario.milestone})`, () => {
      runScenario(scenario);
    }, scenario.timeoutMs);
  }
});
