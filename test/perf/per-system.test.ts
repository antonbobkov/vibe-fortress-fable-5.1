/** T-M8-01: every allocation on the full, saved 80-dwarf reference, with the specified CI tolerance. */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { measureReference } from './measure-reference';

const budgetDoc = readFileSync(new URL('../../docs/01-architecture/performance-budget.md', import.meta.url), 'utf8');
const budgets = [...budgetDoc.matchAll(/^\| (\d{2}|core)(?: [^|]*)? \| ([\d.]+) \|/gm)]
  .map((row) => ({ id: row[1] as string, budget: Number(row[2]) }));

describe('T-M8-01 profiling pass and per-system budgets', () => {
  let measured: Awaited<ReturnType<typeof measureReference>>;
  beforeAll(async () => { measured = await measureReference('scripted'); }, 600_000);

  it('reads all 20 systems and core from the unchanged allocation table', () => {
    expect(budgets).toHaveLength(21);
    for (const { id } of budgets) {
      const value = id === 'core' ? measured.core : id === '22' ? measured.pathing : measured.systems[id];
      expect(value, `missing measurement for ${id}`).toBeDefined();
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  for (const { id, budget } of budgets) {
    it(`${id === '21' ? 'C-009: ' : ''}system ${id} averages at most ${budget} ms × 2`, () => {
      const value = id === 'core' ? measured.core : id === '22' ? measured.pathing : measured.systems[id];
      expect(value, `system ${id}: ${value?.toFixed(6)} ms; budget ${budget} ms × 2`).toBeLessThanOrEqual(budget * 2);
    });
  }
});
