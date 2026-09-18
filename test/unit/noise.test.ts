import { describe, it, expect } from 'vitest';
import { FIXED_SCALE } from '@core/fixed';
import {
  hash,
  hash64,
  hashInts,
  mix32,
  noise2,
  noise3,
  smoothstep,
  valueNoise2,
  valueNoise3,
} from '@core/noise';

describe('T-M1-01 noise: hashing', () => {
  it('hash is a pure uint32 function of its arguments and order-sensitive', () => {
    const a = hash('deepholm', 'worldgen.elevation', 0);
    expect(hash('deepholm', 'worldgen.elevation', 0)).toBe(a);
    expect(Number.isInteger(a) && a >= 0 && a <= 0xffffffff).toBe(true);
    expect(hash('deepholm', 'worldgen.elevation', 1)).not.toBe(a);
    expect(hash('deepholm', 0, 'worldgen.elevation')).not.toBe(a);
    expect(hash('deepholm2', 'worldgen.elevation', 0)).not.toBe(a);
    expect(hash(12345, 'x')).toBe(hash(12345, 'x'));
    expect(hash(12345, 'x')).not.toBe(hash('12345', 'x'));
    expect(hash(1, 2 ** 40)).not.toBe(hash(1, 0));
  });

  it('hash rejects a fractional salt', () => {
    expect(() => hash('s', 1.5)).toThrow(RangeError);
  });

  it('hash64 is 16 hex digits with independent halves', () => {
    const h = hash64('deepholm', 17);
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(hash64('deepholm', 17)).toBe(h);
    expect(hash64('deepholm', 18)).not.toBe(h);
    expect(h.slice(0, 8)).not.toBe(h.slice(8));
  });

  it('hashInts and mix32 are uint32 and spread consecutive inputs', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i += 1) {
      const v = hashInts(7, 0, i, 0);
      expect(v).toBe(v >>> 0);
      seen.add(v);
    }
    expect(seen.size).toBe(1000);
    expect(mix32(0)).toBe(0);
    expect(mix32(1)).not.toBe(1);
  });
});

describe('T-M1-01 noise: value noise 2D', () => {
  it('is a pure function of (seed, coords)', () => {
    for (let k = 0; k < 50; k += 1) {
      const x = (k * 7) % 96;
      const y = (k * 13) % 96;
      expect(noise2(99, x, y, [32, 12], [70, 30])).toBe(noise2(99, x, y, [32, 12], [70, 30]));
    }
    let differs = 0;
    for (let x = 0; x < 64; x += 1) if (valueNoise2(1, x, 5, 8, 100) !== valueNoise2(2, x, 5, 8, 100)) differs += 1;
    expect(differs).toBeGreaterThan(32);
  });

  it('stays within 0 … amplitude (as Fixed) and uses the range', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let y = 0; y < 96; y += 1) {
      for (let x = 0; x < 96; x += 1) {
        const v = valueNoise2(4242, x, y, 6, 255);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255 * FIXED_SCALE);
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
    expect(min).toBeLessThan(50 * FIXED_SCALE);
    expect(max).toBeGreaterThan(205 * FIXED_SCALE);
    const sum = noise2(3, 10, 10, [16, 8, 4], [128, 64, 32]);
    expect(sum).toBeGreaterThanOrEqual(0);
    expect(sum).toBeLessThanOrEqual(224 * FIXED_SCALE);
  });

  it('is smooth: adjacent samples differ by less than amplitude/4 at freq 1/32', () => {
    const amp = 200;
    for (let y = 0; y < 96; y += 1) {
      for (let x = 0; x < 96; x += 1) {
        const v = valueNoise2(77, x, y, 32, amp);
        expect(Math.abs(valueNoise2(77, x + 1, y, 32, amp) - v)).toBeLessThan((amp * FIXED_SCALE) / 4);
        expect(Math.abs(valueNoise2(77, x, y + 1, 32, amp) - v)).toBeLessThan((amp * FIXED_SCALE) / 4);
      }
    }
  });

  it('passes through the lattice values at lattice points and accepts fractional periods', () => {
    // At a lattice point the fraction is 0, so the sample is the lattice value itself.
    const at = valueNoise2(5, 32, 64, 32, 100);
    expect(at).toBe(hashInts(5, 0, 1, 2, 0) % (100 * FIXED_SCALE + 1));
    const frac = valueNoise2(5, 10, 10, 64 / 12, 255);
    expect(frac).toBeGreaterThanOrEqual(0);
    expect(frac).toBeLessThanOrEqual(255 * FIXED_SCALE);
    expect(valueNoise2(5, 3, 3, 8, 0)).toBe(0);
  });

  it('rejects impossible periods and amplitudes', () => {
    expect(() => valueNoise2(1, 0, 0, 0, 10)).toThrow(RangeError);
    expect(() => valueNoise2(1, 0, 0, 4, -1)).toThrow(RangeError);
    expect(() => noise2(1, 0, 0, [4], [1, 2])).toThrow(RangeError);
  });

  it('smoothstep is monotone from 0 to FIXED_SCALE', () => {
    expect(smoothstep(-5)).toBe(0);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(500)).toBe(500);
    expect(smoothstep(1000)).toBe(1000);
    expect(smoothstep(2000)).toBe(1000);
    let prev = 0;
    for (let t = 0; t <= 1000; t += 1) {
      const s = smoothstep(t);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });
});

describe('T-M1-01 noise: value noise 3D', () => {
  it('is pure, bounded and smooth along every axis', () => {
    const amp = 100;
    for (let z = 0; z < 12; z += 1) {
      for (let y = 0; y < 40; y += 2) {
        for (let x = 0; x < 40; x += 2) {
          const v = valueNoise3(11, x, y, z, 32, amp);
          expect(v).toBe(valueNoise3(11, x, y, z, 32, amp));
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(amp * FIXED_SCALE);
          expect(Math.abs(valueNoise3(11, x + 1, y, z, 32, amp) - v)).toBeLessThan((amp * FIXED_SCALE) / 4);
          expect(Math.abs(valueNoise3(11, x, y + 1, z, 32, amp) - v)).toBeLessThan((amp * FIXED_SCALE) / 4);
          expect(Math.abs(valueNoise3(11, x, y, z + 1, 32, amp) - v)).toBeLessThan((amp * FIXED_SCALE) / 4);
        }
      }
    }
  });

  it('sums octaves within 0 … Σ amps and differs by z', () => {
    let differs = 0;
    for (let z = 0; z < 10; z += 1) {
      const v = noise3(8, 20, 30, z, [14, 6], [70, 30]);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100 * FIXED_SCALE);
      if (v !== noise3(8, 20, 30, z + 1, [14, 6], [70, 30])) differs += 1;
    }
    expect(differs).toBeGreaterThan(5);
    expect(() => noise3(1, 0, 0, 0, [4, 2], [1])).toThrow(RangeError);
  });
});
