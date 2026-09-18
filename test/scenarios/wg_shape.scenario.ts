/**
 * `wg_shape` of `04-implementation/acceptance-tests.md` § 01 World generation:
 * "generate standard world, 20 seeds | land fraction ≥ 35%; ≥ 1 mountain 3×3 cluster; 4 civ homes
 * placed with separation ≥ 8".
 */

import { expect } from 'vitest';
import { WORLD_SIZE_STANDARD } from '@core/constants';
import { CIVS, generate } from '@systems/worldgen';
import { hasEnoughLand, hasMountainCluster } from '@systems/worldgen/stages/elevation';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'wg_shape',
  milestone: 1,
  seed: 'wg-shape',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    const size = WORLD_SIZE_STANDARD;
    for (let k = 0; k < 20; k += 1) {
      const world = generate(`wg-shape-${k}`, size, w.game.registry);
      const elev = world.regions.map((r) => r.elevation);
      expect(hasEnoughLand(elev, size), `seed ${k}: land`).toBe(true);
      expect(hasMountainCluster(elev, size), `seed ${k}: mountain cluster`).toBe(true);
      const homes = CIVS.map((civ) => world.civHomes[civ]);
      expect(new Set(homes).size).toBe(4);
      for (let a = 0; a < homes.length; a += 1) {
        for (let b = a + 1; b < homes.length; b += 1) {
          const ha = homes[a] as number;
          const hb = homes[b] as number;
          const sep = Math.max(Math.abs((ha % size) - (hb % size)), Math.abs(Math.floor(ha / size) - Math.floor(hb / size)));
          expect(sep, `seed ${k}: ${CIVS[a]} to ${CIVS[b]}`).toBeGreaterThanOrEqual(8);
        }
      }
    }
  },
};

export default scenario;
