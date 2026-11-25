/**
 * T-694's probe of the brook's depth where the three-year cistern breaches it, over the first
 * months. Local measurement only (set `T694_PROBE=1`); not part of `npm test`.
 */

import { describe, it } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import { setupThreeYearsFortress, threeYearsWorld } from '../scenarios/three_years_fortress';
import { keepWaterInside } from '../scenarios/three_years_cistern';

const SEEDS = (process.env['T694_SEEDS'] ?? 'three-years-p0-3:0').split(',').map((s) => ({ seed: s.split(':')[0] as string, peril: Number(s.split(':')[1]) }));

describe('T-694 probe: the brook at the breach', () => {
  it.runIf(process.env['T694_PROBE'] === '1')('depth', () => {
    for (const { seed, peril } of SEEDS) {
      const w = threeYearsWorld(seed, peril);
      const state = setupThreeYearsFortress(w);
      state.waterInside = true;
      keepWaterInside(w, state);
      const plan = state.cistern?.plan;
      if (!plan) continue;
      const b = { x: 2 * plan.p.x - plan.s.x, y: 2 * plan.p.y - plan.s.y };
      const row: string[] = [];
      const days = Number(process.env['T694_DAYS'] ?? '60');
      for (let d = 0; d <= days; d += 5) {
        let around = '';
        for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) around += String(w.map.fluidLevelAt(w.index(b.x + dx, b.y + dy, plan.bz)));
        row.push(`d${d}:${w.map.fluidLevelAt(w.index(b.x, b.y, plan.bz))}/${around}`);
        w.step(5 * TICKS_PER_DAY);
      }
      console.log(`${seed} bz ${plan.bz}: ${row.join(' ')}`);
    }
  }, 1_800_000);
});
