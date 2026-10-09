/**
 * The scenario index of `testing-strategy.md` § The scenario runner.
 * F-09d: Checks that every scenario file exports a scenario whose id matches its file name.
 * Milestone scenario executions run in parallel from m0.test.ts ... m8.test.ts.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { PERF_TIER_SCENARIOS } from './perf-tier';
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

  it('the scenarios that run in the performance tier are an explicit named list with a test file each', () => {
    const ids = new Set(scenarios.map(({ scenario }) => scenario.id));
    for (const { id, file } of PERF_TIER_SCENARIOS) {
      expect(ids.has(id), `${id} is a scenario file`).toBe(true);
      expect(existsSync(file), `${file} exists`).toBe(true);
      expect(readFileSync(file, 'utf8'), `${file} runs ${id}`).toContain(`../scenarios/${id}.scenario`);
    }
  });
});
