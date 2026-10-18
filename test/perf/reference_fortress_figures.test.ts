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
    // T-345: the workshops job producer visits the workshops, not the 600 buildings. Its allocation is 0.10 ms and it
    // measured 0.06 ms; a wall-clock bound on a shared machine is only a gate if it is far wider than the noise, and the
    // regression it guards (a visit of every building and every item) cost 20 ms, so the bound is 1 ms.
    expect(producers['workshops'], 'workshops job producer, ms per tick').toBeLessThanOrEqual(1);
    // T-383: the 25,000 loose items cost the job board's unit search a minute of one tick, and system 11 57 ms a tick,
    // while it enumerated every match afresh for each one found. It costs what the standard fixture's job board costs
    // (about 2 ms on a busy machine); the bounds are far wider than that and far below what the fault cost.
    expect(systems['11'], 'system 11, ms per tick').toBeLessThanOrEqual(10);
    expect(worstTickMs, 'worst tick, ms').toBeLessThanOrEqual(5_000);
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
