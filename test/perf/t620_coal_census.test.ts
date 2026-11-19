import { describe, it } from 'vitest';
import { TileKind } from '@core/map3d';
import { threeYearsWorld } from '../scenarios/three_years_fortress';

/**
 * T-620: the coal of each three-year map: tiles of bituminous coal and lignite by level, and the
 * upper rock's (level 23 to the halls'). A census, not a gate: `T620_CENSUS=1`.
 */
describe.skipIf(process.env['T620_CENSUS'] !== '1')('T-620 coal census', () => {
  it('counts the coal of the peril-2 and peril-4 maps', () => {
    for (const peril of [2, 4]) for (let n = 1; n <= 7; n += 1) {
      if (peril === 4 && n === 7) continue;
      const seed = `three-years-p${peril}-${n}`;
      const w = threeYearsWorld(seed, peril);
      const mats = w.game.registry.table<{ id: string }>('materials');
      const coal = new Set([mats.index('bituminous_coal'), mats.index('lignite')]);
      const byZ: Record<number, number> = {};
      let total = 0;
      for (let z = 0; z < w.map.d; z += 1) for (let y = 0; y < w.map.h; y += 1) for (let x = 0; x < w.map.w; x += 1) {
        const t = w.index(x, y, z);
        if (w.map.kindAt(t) === TileKind.Wall && coal.has(w.map.materialAt(t))) { byZ[z] = (byZ[z] ?? 0) + 1; total += 1; }
      }
      console.log(`[t620coal] ${seed} total ${total} ${JSON.stringify(byZ)}`);
    }
  }, 600_000);
});
