/**
 * T-283: the reference fortress in play. It reports, for the systems it exercises, the figures the first 80-dwarf fixture
 * could not (workshops, farming, the military, a depot and a gate), and it lives through a season. The budgets of
 * `performance-budget.md` stay measured on the furniture fixture (`perf_reference.test.ts`, `per-system.test.ts`); the
 * figures here are reported in the dated audit report and gate nothing but survival.
 */
import { describe, expect, it } from 'vitest';
import { DAYS_PER_SEASON, TICKS_PER_DAY } from '@core/constants';
import { deathCounts } from '../scenarios/death-counts';
import { measureReference } from './measure-reference';
import { buildScriptedReference } from './scripted-reference';

describe('T-283 perf: the reference fortress', () => {
  it('reports every system on the reference fortress', async () => {
    const { systems, pathing, core, averageTickMs, worstTickMs, producers } = await measureReference('scripted');
    expect(Object.keys(systems).length).toBeGreaterThan(15);
    // T-345: the workshops job producer visits the workshops, not the 600 buildings: its allocation is 0.10 ms, with the tolerance of per-system.test.ts.
    expect(producers['workshops'], 'workshops job producer, ms per tick').toBeLessThanOrEqual(0.10 * 2);
    expect(Number.isFinite(pathing) && Number.isFinite(core) && Number.isFinite(averageTickMs) && Number.isFinite(worstTickMs)).toBe(true);
  }, 3_600_000);

  it('lives through a season with nobody starving or dying of thirst', () => {
    const w = buildScriptedReference();
    const ticks = DAYS_PER_SEASON * TICKS_PER_DAY;
    let worst = 0;
    const began = performance.now();
    for (let k = 0; k < ticks; k += 1) {
      const start = performance.now();
      w.step(1);
      worst = Math.max(worst, performance.now() - start);
    }
    const deaths = w.events('CreatureDied').filter((e) => e['faction'] === 'fortress');
    const hungry = deaths.filter((e) => ['starvation', 'dehydration', 'thirst', 'hunger'].includes(String(e['cause'])));
    console.log(`reference_season: ${JSON.stringify({ ticks, averageTickMs: (performance.now() - began) / ticks, worstTickMs: worst,
      deaths: deathCounts(w), causes: deaths.map((e) => e['cause']), starvingEvents: w.events('Starving').length })}`);
    expect(hungry).toEqual([]);
  }, 7_200_000);
});
