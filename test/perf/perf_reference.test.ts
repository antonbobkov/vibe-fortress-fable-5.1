/** T-M6-18 / T-M8-01: gate the played and full scripted reference fortresses. */
import { describe, expect, it } from 'vitest';
import { measureReference as measure } from './measure-reference';

/** T-393: the worst tick is taken from each tick's least time over three passes (`measure-reference.ts`). */
const WORST_TICK_PASSES = 3;
/**
 * T-393: the least of three passes cannot see a stall that comes once (a collection, a one-time cost
 * in the process), so the single-pass worst keeps a loose guard of its own: it measured 32.8 to 60.1 ms
 * over twelve quiet runs of the two fixtures.
 */
const SINGLE_PASS_WORST_MS = 80;

const ALLOCATION_MS: Readonly<Record<string, number>> = {
  '03': 0.10, '04': 1.25, '05': 0.15, '06': 0.02, '07': 0.15,
  '08': 0.80, '09': 0.05, '10': 0.50, '11': 0.60, '12': 0.10,
  '13': 0.30, '14': 0.10, '15': 0.20, '16': 0.20, '17': 0.10,
  '18': 0.20, '19': 0.05,
};

describe('T-M6-18 / T-M8-01 perf: perf_reference', () => {
  it('asserts per-system allocations on the 20-dwarf played fortress', async () => {
    const { systems, pathing, core, worstTickMs, steadyWorstTickMs } = await measure('played', WORST_TICK_PASSES);
    for (const [id, allocation] of Object.entries(ALLOCATION_MS)) {
      if (systems[id] === undefined) continue;
      expect(systems[id], `system ${id}: ${systems[id]?.toFixed(3)} ms > ${allocation.toFixed(3)} ms`).toBeLessThanOrEqual(allocation);
    }
    expect(pathing, 'system 22 pathing').toBeLessThanOrEqual(0.75);
    expect(core, 'core').toBeLessThanOrEqual(0.30);
    expect(steadyWorstTickMs).toBeLessThanOrEqual(40);
    expect(worstTickMs, 'single-pass worst tick').toBeLessThanOrEqual(SINGLE_PASS_WORST_MS);
  }, 600_000);

  it('T-M8-01: gates every present system and the full 80-dwarf reference tick (the furniture fixture the budgets were measured on)', async () => {
    const { systems, pathing, core, averageTickMs, worstTickMs, steadyWorstTickMs } = await measure('furniture', WORST_TICK_PASSES);
    for (const id of Object.keys(ALLOCATION_MS)) expect(systems[id], `missing system ${id}`).toBeDefined();
    expect(Number.isFinite(pathing) && Number.isFinite(core)).toBe(true);
    expect(averageTickMs).toBeLessThanOrEqual(12);
    expect(steadyWorstTickMs).toBeLessThanOrEqual(40);
    expect(worstTickMs, 'single-pass worst tick').toBeLessThanOrEqual(SINGLE_PASS_WORST_MS);
  }, 600_000);
});
