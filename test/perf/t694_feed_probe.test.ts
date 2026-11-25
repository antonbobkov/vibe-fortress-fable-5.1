/**
 * T-694's probe of the ground about the three-year cistern's feed on one map, as planned: tile kinds
 * (. open, # wall, _ floor, ^ ramp, < > X stairs, T tree, ~ water) level by level. Local only
 * (set `T694_PROBE=1`, the seed and peril in `T694_SEED`, e.g. `three-years-p2-7:2`).
 */

import { describe, it } from 'vitest';
import { setupThreeYearsFortress, threeYearsWorld } from '../scenarios/three_years_fortress';
import { keepWaterInside } from '../scenarios/three_years_cistern';

describe('T-694 probe: the ground about the feed', () => {
  it.runIf(process.env['T694_PROBE'] === '1')('feed', () => {
    const [seed, peril] = (process.env['T694_SEED'] ?? 'three-years-p2-7:2').split(':');
    const w = threeYearsWorld(seed as string, Number(peril));
    const state = setupThreeYearsFortress(w);
    keepWaterInside(w, state);
    const plan = state.cistern?.plan;
    if (!plan) return;
    console.log(JSON.stringify({ p: plan.p, s: plan.s, t: plan.t, tops: plan.tops, bz: plan.bz }));
    for (let z = plan.bz; z <= plan.bz + 3; z += 1) {
      const rows: string[] = [];
      for (let y = plan.s.y - 4; y <= plan.s.y + 4; y += 1) {
        let r = '';
        for (let x = plan.s.x - 4; x <= plan.s.x + 4; x += 1) {
          const i = w.index(x, y, z);
          r += w.map.fluidLevelAt(i) > 0 ? '~' : ('.#_^<>X%T,"o'[w.map.kindAt(i)] ?? '?');
        }
        rows.push(r);
      }
      console.log(`z ${z} (x from ${plan.s.x - 4}, y from ${plan.s.y - 4})\n${rows.join('\n')}`);
    }
  });
});
