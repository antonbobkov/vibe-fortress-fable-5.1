/**
 * T-694's probe of the three-year cistern's plan on the twenty sweep maps: which plan each map
 * takes on the script's first look (under the hearth hall or under a well room by the brook), the
 * feed tunnel's length and the passage's. Local measurement only (set `T694_PROBE=1`); not part of
 * `npm test`.
 */

import { describe, it } from 'vitest';
import { setupThreeYearsFortress, threeYearsWorld } from '../scenarios/three_years_fortress';
import { keepWaterInside } from '../scenarios/three_years_cistern';

const SEEDS = [1, 2, 3, 4, 5, 6, 7].map((k) => ({ seed: `three-years-p0-${k}`, peril: 0 }))
  .concat([1, 2, 3, 4, 5, 6, 7].map((k) => ({ seed: `three-years-p2-${k}`, peril: 2 })))
  .concat([1, 2, 3, 4, 5, 6].map((k) => ({ seed: `three-years-p4-${k}`, peril: 4 })));

describe('T-694 probe: the cistern plan on the twenty maps', () => {
  it.runIf(process.env['T694_PROBE'] === '1')('plans', () => {
    const rows: string[] = [];
    for (const { seed, peril } of SEEDS) {
      const w = threeYearsWorld(seed, peril);
      const state = setupThreeYearsFortress(w);
      state.waterInside = true;
      keepWaterInside(w, state);
      const work = state.cistern;
      const levels: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
      for (let y = 0; y < w.map.h; y += 1) for (let x = 0; x < w.map.w; x += 1) {
        for (let z = w.map.d - 2; z > 0; z -= 1) { const l = w.map.fluidLevelAt(w.index(x, y, z)); if (l > 0) { levels[l] = (levels[l] ?? 0) + 1; break; } }
      }
      if (work) {
        const p = work.plan.p, s2 = work.plan.s, b = { x: 2 * p.x - s2.x, y: 2 * p.y - s2.y };
        rows.push(`${seed}: brook tile level ${w.map.fluidLevelAt(w.index(b.x, b.y, work.plan.bz))}, surface water levels 1..7: ${levels.slice(1).join(' ')}`);
      }
      rows.push(work === null || work === undefined ? `${seed}: none`
        : `${seed}: ${work.room.length > 0 ? 'room' : 'hall'} tunnel ${work.plan.tunnel.length} gate ${work.plan.gate} passage ${work.room.length} brookZ ${work.plan.bz} hallZ ${work.plan.hallZ}`);
    }
    console.log(rows.join('\n'));
  }, 600_000);
});
