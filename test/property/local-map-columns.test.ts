/**
 * T-M1-05 property: "for 20 seeds, no `Open` tile below a `Floor` in the same column except cavern
 * bands and river beds" (`M1-ground.md`). The Sea of Fire (z ≤ `MAGMA_SEA_TOP_Z`) is open magma
 * by design (`03` § Local map generation stage 5) and is excepted too.
 */

import { describe, it, expect } from 'vitest';
import { contentRegistry } from '@content/loader';
import {
  CAVERN_1_Z_MAX,
  CAVERN_1_Z_MIN,
  CAVERN_2_Z_MAX,
  CAVERN_2_Z_MIN,
  CAVERN_3_Z_MAX,
  CAVERN_3_Z_MIN,
  MAGMA_SEA_TOP_Z,
} from '@core/constants';
import { TileKind } from '@core/map3d';
import { generatedSpec } from '@app/headless';
import { generateLocalMap } from '@systems/terrain/generate';

const registry = contentRegistry();

function inCavernBand(z: number): boolean {
  return (
    (z >= CAVERN_1_Z_MIN && z <= CAVERN_1_Z_MAX) ||
    (z >= CAVERN_2_Z_MIN && z <= CAVERN_2_Z_MAX) ||
    (z >= CAVERN_3_Z_MIN && z <= CAVERN_3_Z_MAX)
  );
}

describe('T-M1-05 property: local map columns', () => {
  it('no Open tile below the surface Floor outside cavern bands, river beds and the Sea of Fire (20 seeds)', () => {
    for (let k = 0; k < 20; k += 1) {
      const spec = generatedSpec(`columns-${k}`, registry);
      const { map, result } = generateLocalMap(spec, registry);
      for (let y = 0; y < map.h; y += 1) {
        for (let x = 0; x < map.w; x += 1) {
          const c = y * map.w + x;
          // River and lake beds are Floors like any other surface; nothing below them is open.
          const top = result.surface[c] as number;
          expect(map.kindAt(map.index(x, y, top))).toBe(TileKind.Floor);
          for (let z = top - 1; z > MAGMA_SEA_TOP_Z; z -= 1) {
            if (inCavernBand(z)) continue;
            if (map.kindAt(map.index(x, y, z)) === TileKind.Open) {
              throw new Error(`seed ${k}: open tile at (${x}, ${y}, ${z}) below the floor at ${top}`);
            }
          }
        }
      }
    }
    expect(true).toBe(true);
  });
});
