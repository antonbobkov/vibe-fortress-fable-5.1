/**
 * The scenario index of `testing-strategy.md` § The scenario runner.
 * F-09d: Checks that every scenario file exports a scenario whose id matches its file name.
 * Milestone scenario executions run in parallel from m0.test.ts ... m8.test.ts.
 */

import { describe, it, expect } from 'vitest';
import type { Scenario } from './runner';

const modules = import.meta.glob('./*.scenario.ts', { eager: true }) as Record<
  string,
  { default: Scenario }
>;

const scenarios = Object.keys(modules)
  .sort()
  .map((path) => ({ path, scenario: (modules[path] as { default: Scenario }).default }));

describe('T-M0-11 scenarios', () => {
  it('every scenario file exports a scenario whose id matches its file name', () => {
    expect(scenarios.length).toBeGreaterThan(0);
    for (const { path, scenario } of scenarios) {
      const name = (path.split('/').pop() as string).replace('.scenario.ts', '');
      expect(scenario.id).toBe(name);
      expect(scenario.milestone).toBeGreaterThanOrEqual(0);
    }
  });
});
