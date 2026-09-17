/**
 * The scenario index of `01-testing-strategy.md` § The scenario runner: every `*.scenario.ts`
 * under this folder is discovered and run when its milestone is at most the `current-milestone`
 * of `docs/05-plan/PROGRESS.md`.
 */

import { describe, it, expect } from 'vitest';
import { currentMilestone, runScenario, type Scenario } from './runner';

const modules = import.meta.glob('./*.scenario.ts', { eager: true }) as Record<
  string,
  { default: Scenario }
>;

const scenarios = Object.keys(modules)
  .sort()
  .map((path) => ({ path, scenario: (modules[path] as { default: Scenario }).default }));

const milestone = currentMilestone();

describe('T-M0-11 scenarios', () => {
  it('every scenario file exports a scenario whose id matches its file name', () => {
    expect(scenarios.length).toBeGreaterThan(0);
    for (const { path, scenario } of scenarios) {
      const name = (path.split('/').pop() as string).replace('.scenario.ts', '');
      expect(scenario.id).toBe(name);
      expect(scenario.milestone).toBeGreaterThanOrEqual(0);
    }
  });

  for (const { scenario } of scenarios) {
    const skip = scenario.milestone > milestone;
    const test = skip ? it.skip : it;
    test(`${scenario.id} (M${scenario.milestone})`, () => {
      runScenario(scenario);
    });
  }
});
