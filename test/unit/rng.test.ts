import { describe, it, expect } from 'vitest';
import {
  RngStream,
  hashString,
  seedFor,
  splitmix32,
  stateFromSeed,
  type RngState,
} from '@core/rng';

/**
 * Reference vectors produced by the published `xoshiro128**` source (Blackman & Vigna, 2018):
 *
 *   uint32_t next(void) {
 *     const uint32_t result = rotl(s[1] * 5, 7) * 9;
 *     const uint32_t t = s[1] << 9;
 *     s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
 *     s[2] ^= t; s[3] = rotl(s[3], 11);
 *     return result;
 *   }
 */
const VECTORS: { state: RngState; first: number[] }[] = [
  {
    state: { s0: 1, s1: 2, s2: 3, s3: 4 },
    first: [11520, 0, 5927040, 70819200, 2031721883, 1637235492, 1287239034, 3734860849],
  },
  {
    state: { s0: 0x9e3779b9, s1: 0x243f6a88, s2: 0xb7e15162, s3: 0xdeadbeef },
    first: [2463954730, 5524658, 74256371, 1905451993, 3123413897, 314453775, 1263677054, 1531511215],
  },
  {
    state: { s0: 0xdeadbeef, s1: 0xcafebabe, s2: 0x8badf00d, s3: 0x1badb002 },
    first: [1667872595, 3900315271, 1385813237, 4163113681, 1761488601, 3489642547, 2659098233, 413747753],
  },
];

describe('T-M0-02 rng: xoshiro128** reference vectors', () => {
  for (const [i, v] of VECTORS.entries()) {
    it(`vector ${i + 1} matches the published sequence`, () => {
      const rng = new RngStream(v.state);
      const got = v.first.map(() => rng.nextU32());
      expect(got).toEqual(v.first);
    });
  }

  it('every output is a uint32', () => {
    const rng = new RngStream(12345);
    for (let i = 0; i < 2000; i += 1) {
      const n = rng.nextU32();
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('never enters the all-zero state from a zero seed', () => {
    const st = stateFromSeed(0);
    expect(st.s0 | st.s1 | st.s2 | st.s3).not.toBe(0);
  });
});

describe('T-M0-02 rng: derived streams', () => {
  it('hashString is stable and order-sensitive', () => {
    expect(hashString('')).toBe(0x811c9dc5);
    expect(hashString('deepholm')).toBe(hashString('deepholm'));
    expect(hashString('ab')).not.toBe(hashString('ba'));
  });

  it('seedFor separates streams and worlds', () => {
    expect(seedFor('seed-a', 'worldgen.elevation')).toBe(seedFor('seed-a', 'worldgen.elevation'));
    expect(seedFor('seed-a', 'worldgen.elevation')).not.toBe(
      seedFor('seed-a', 'worldgen.climate'),
    );
    expect(seedFor('seed-a', 'worldgen.elevation')).not.toBe(
      seedFor('seed-b', 'worldgen.elevation'),
    );
  });

  it('two streams from the same seed produce the same sequence', () => {
    const a = RngStream.forStream('world-1', 'dwarves');
    const b = RngStream.forStream('world-1', 'dwarves');
    const c = RngStream.forStream('world-1', 'animals');
    const seqA = Array.from({ length: 50 }, () => a.nextU32());
    const seqB = Array.from({ length: 50 }, () => b.nextU32());
    const seqC = Array.from({ length: 50 }, () => c.nextU32());
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });

  it('splitmix32 is deterministic', () => {
    const a = splitmix32(7);
    const b = splitmix32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('state round-trips exactly', () => {
    const rng = new RngStream(999);
    for (let i = 0; i < 17; i += 1) rng.nextU32();
    const saved = rng.state();
    const expected = Array.from({ length: 20 }, () => rng.nextU32());
    const restored = new RngStream(saved);
    expect(Array.from({ length: 20 }, () => restored.nextU32())).toEqual(expected);
  });

  it('fork produces an independent stream and advances the parent', () => {
    const parent = new RngStream(4242);
    const before = parent.state();
    const child = parent.fork('worldgen.rivers');
    expect(parent.state()).not.toEqual(before);
    const twin = new RngStream(before).fork('worldgen.rivers');
    expect(child.nextU32()).toBe(twin.nextU32());
  });
});

describe('T-M0-02 rng: helpers are deterministic per seed', () => {
  const fresh = (): RngStream => new RngStream(20260917);

  it('int stays inside the inclusive range and repeats per seed', () => {
    const a = fresh();
    const b = fresh();
    for (let i = 0; i < 500; i += 1) {
      const v = a.int(-5, 9);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThanOrEqual(9);
      expect(v).toBe(b.int(-5, 9));
    }
  });

  it('int on a single-value range consumes nothing', () => {
    const rng = fresh();
    const before = rng.state();
    expect(rng.int(4, 4)).toBe(4);
    expect(rng.state()).toEqual(before);
  });

  it('int rejects an empty range', () => {
    expect(() => fresh().int(3, 2)).toThrow(RangeError);
  });

  it('int is unbiased enough over a small range', () => {
    const rng = fresh();
    const tally = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60000; i += 1) {
      const v = rng.int(0, 5);
      tally[v] = (tally[v] ?? 0) + 1;
    }
    for (const c of tally) {
      expect(c).toBeGreaterThan(9000);
      expect(c).toBeLessThan(11000);
    }
  });

  it('chance honours its bounds and its rate', () => {
    expect(fresh().chance(0)).toBe(false);
    expect(fresh().chance(1000)).toBe(true);
    const rng = fresh();
    let hits = 0;
    for (let i = 0; i < 10000; i += 1) if (rng.chance(250)) hits += 1;
    expect(hits).toBeGreaterThan(2300);
    expect(hits).toBeLessThan(2700);
  });

  it('pick is deterministic and rejects an empty array', () => {
    const items = ['a', 'b', 'c', 'd'] as const;
    const a = fresh();
    const b = fresh();
    for (let i = 0; i < 100; i += 1) expect(a.pick(items)).toBe(b.pick(items));
    expect(() => fresh().pick([])).toThrow(RangeError);
  });

  it('weighted respects the weights and skips non-positive entries', () => {
    const rng = fresh();
    const entries: (readonly [string, number])[] = [
      ['never', 0],
      ['rare', 1],
      ['common', 9],
      ['negative', -3],
    ];
    const tally: Record<string, number> = { rare: 0, common: 0 };
    for (let i = 0; i < 10000; i += 1) {
      const got = rng.weighted(entries);
      expect(got === 'rare' || got === 'common').toBe(true);
      tally[got] = (tally[got] ?? 0) + 1;
    }
    expect(tally['common']).toBeGreaterThan(8500);
    expect(tally['rare']).toBeGreaterThan(700);
    expect(tally['rare']).toBeLessThan(1300);
    expect(() => fresh().weighted([['x', 0]])).toThrow(RangeError);
  });

  it('shuffle is a permutation and is deterministic per seed', () => {
    const base = Array.from({ length: 64 }, (_, i) => i);
    const a = [...base];
    const b = [...base];
    fresh().shuffle(a);
    fresh().shuffle(b);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(base);
    expect(a).not.toEqual(base);
  });

  it('shuffle of 0 and 1 elements is a no-op', () => {
    const empty: number[] = [];
    const one = [7];
    fresh().shuffle(empty);
    fresh().shuffle(one);
    expect(empty).toEqual([]);
    expect(one).toEqual([7]);
  });

  it('fixed returns 0..999', () => {
    const rng = fresh();
    for (let i = 0; i < 2000; i += 1) {
      const f = rng.fixed();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(999);
    }
  });
});
