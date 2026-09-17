import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Map3D, TileFlag, TILE_FLAG_MASK } from '@core/map3d';

const FLAGS: TileFlag[] = [
  TileFlag.Discovered,
  TileFlag.Constructed,
  TileFlag.Smoothed,
  TileFlag.Engraved,
  TileFlag.Mud,
  TileFlag.Snow,
  TileFlag.Grass,
  TileFlag.Ash,
  TileFlag.Burning,
  TileFlag.Outdoor,
  TileFlag.Lit,
  TileFlag.Restricted,
  TileFlag.Web,
  TileFlag.Wet,
];

const W = 8;
const H = 8;
const D = 3;
const TILES = W * H * D;

interface Op {
  tile: number;
  flag: TileFlag;
  value: boolean;
}

const opArb: fc.Arbitrary<Op> = fc.record({
  tile: fc.integer({ min: 0, max: TILES - 1 }),
  flag: fc.constantFrom(...FLAGS),
  value: fc.boolean(),
});

describe('T-M0-04 property: tile flags', () => {
  it('a sequence of setFlag calls only ever changes the bit it names', () => {
    fc.assert(
      fc.property(fc.array(opArb, { minLength: 1, maxLength: 400 }), (ops) => {
        const m = new Map3D(W, H, D);
        const model = new Uint16Array(TILES);
        for (const op of ops) {
          const before = Array.from(m.flags);
          m.setFlag(op.tile, op.flag, op.value);
          const e = model[op.tile] as number;
          model[op.tile] = op.value ? e | op.flag : e & ~op.flag & 0xffff;
          for (let i = 0; i < TILES; i += 1) {
            if (i === op.tile) continue;
            expect(m.flags[i]).toBe(before[i]);
          }
          const changed = ((before[op.tile] as number) ^ (m.flags[op.tile] as number)) >>> 0;
          expect(changed & ~op.flag & 0xffff).toBe(0);
        }
        for (let i = 0; i < TILES; i += 1) {
          expect(m.flags[i]).toBe(model[i]);
          expect((m.flags[i] as number) & ~TILE_FLAG_MASK & 0xffff).toBe(0);
        }
        return true;
      }),
      { numRuns: 60 },
    );
  });

  it('setting then clearing the same flag is the identity', () => {
    fc.assert(
      fc.property(
        fc.array(opArb, { maxLength: 100 }),
        fc.integer({ min: 0, max: TILES - 1 }),
        fc.constantFrom(...FLAGS),
        (ops, tile, flag) => {
          const m = new Map3D(W, H, D);
          for (const op of ops) m.setFlag(op.tile, op.flag, op.value);
          const before = Array.from(m.flags);
          const had = m.hasFlag(tile, flag);
          m.setFlag(tile, flag, !had);
          m.setFlag(tile, flag, had);
          expect(Array.from(m.flags)).toEqual(before);
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
