import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import { harness } from '../unit/fluids/harness';

/**
 * `01-testing-strategy.md` § Property tests, "fluid conservation": random sealed basins, random
 * initial levels, 500 steps; "Σ levels constant; every tile settles".
 *
 * Σ is asserted with the units the rules themselves destroy (evaporation and steam, T-M3-02)
 * added back: rules 1–3 conserve units exactly (`04` § Rules). "Every tile settles" contradicts
 * rule 2's equalizing draw, which keeps level differences of one moving for ever; see C-002.
 */

const W = 10;
const H = 8;
const D = 4;

interface Basin {
  readonly seed: number;
  /** Per tile of the 8×6 interior of levels 1 and 2: the kind (0 wall, 1 floor, 2 open). */
  readonly kinds: readonly number[];
  readonly levels: readonly number[];
  readonly magma: boolean;
}

const INTERIOR = (W - 2) * (H - 2) * 2;

const basinArb: fc.Arbitrary<Basin> = fc.record({
  seed: fc.integer({ min: 0, max: 1_000_000 }),
  kinds: fc.array(fc.integer({ min: 0, max: 2 }), { minLength: INTERIOR, maxLength: INTERIOR }),
  levels: fc.array(fc.integer({ min: 0, max: 7 }), { minLength: INTERIOR, maxLength: INTERIOR }),
  magma: fc.boolean(),
});

function build(b: Basin): { h: ReturnType<typeof harness>; tiles: TileIndex[] } {
  const h = harness(`basin-${b.seed}`, W, H, D);
  const tiles: TileIndex[] = [];
  let k = 0;
  for (let z = 1; z <= 2; z += 1) {
    for (let y = 1; y < H - 1; y += 1) {
      for (let x = 1; x < W - 1; x += 1) {
        const i = h.map.index(x, y, z);
        const kind = b.kinds[k] as number;
        h.map.kind[i] = kind === 0 ? TileKind.Wall : kind === 1 ? TileKind.Floor : TileKind.Open;
        if (kind !== 0) tiles.push(i);
        k += 1;
      }
    }
  }
  k = 0;
  for (let z = 1; z <= 2; z += 1) {
    for (let y = 1; y < H - 1; y += 1) {
      for (let x = 1; x < W - 1; x += 1) {
        const i = h.map.index(x, y, z);
        const level = b.levels[k] as number;
        if (h.map.kindAt(i) !== TileKind.Wall && level > 0) h.sim.pour(i, level, b.magma);
        k += 1;
      }
    }
  }
  return { h, tiles };
}

describe('T-M3-01 property: fluid conservation', () => {
  it('in a random sealed basin Σ levels (plus what the rules destroy) is constant over 500 steps', () => {
    fc.assert(
      fc.property(basinArb, (b) => {
        const { h, tiles } = build(b);
        const start = h.sum(tiles, b.magma);
        for (let s = 0; s < 500; s += 1) {
          h.sim.step(b.magma);
          const sum = h.sum(tiles, b.magma) + h.sim.destroyedUnits;
          if (sum !== start) expect([s, sum]).toEqual([s, start]);
        }
      }),
      { numRuns: 25, seed: 3301 },
    );
  });

  it.todo('C-002: every tile settles (rule 2 equalizes level differences of one for ever)');
});
