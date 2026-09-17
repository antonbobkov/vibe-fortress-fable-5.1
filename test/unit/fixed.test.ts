import { describe, it, expect } from 'vitest';
import {
  FIXED_SCALE,
  FIXED_ONE,
  INT32_MAX,
  INT32_MIN,
  OverflowError,
  assertInt32,
  fabs,
  fclamp,
  fdiv,
  flerp,
  fmax,
  fmin,
  fmul,
  fpercent,
  fround,
  fsqrt,
  fx,
  isqrt,
  toInt,
} from '@core/fixed';

describe('T-M0-02 fixed: scale and conversion', () => {
  it('the scale is 1000', () => {
    expect(FIXED_SCALE).toBe(1000);
    expect(FIXED_ONE).toBe(1000);
  });

  it('fx and toInt round-trip integers', () => {
    expect(fx(0)).toBe(0);
    expect(fx(3)).toBe(3000);
    expect(fx(-7)).toBe(-7000);
    expect(toInt(fx(42))).toBe(42);
    expect(toInt(fx(-42))).toBe(-42);
  });

  it('toInt truncates toward zero', () => {
    expect(toInt(1999)).toBe(1);
    expect(toInt(-1999)).toBe(-1);
    expect(toInt(999)).toBe(0);
    expect(toInt(-999)).toBe(0);
  });

  it('fround rounds halves away from zero', () => {
    expect(fround(1500)).toBe(2);
    expect(fround(1499)).toBe(1);
    expect(fround(-1500)).toBe(-2);
    expect(fround(-1499)).toBe(-1);
  });
});

describe('T-M0-02 fixed: arithmetic against known values', () => {
  it('fmul', () => {
    expect(fmul(fx(2), fx(3))).toBe(fx(6));
    expect(fmul(500, 500)).toBe(250); // 0.5 x 0.5 = 0.25
    expect(fmul(fx(7), 0)).toBe(0);
    expect(fmul(fx(-2), 500)).toBe(-1000); // -2 x 0.5 = -1
    expect(fmul(1, 1)).toBe(0); // 0.001 x 0.001 truncates to 0
    expect(fmul(-1, 1)).toBe(0); // truncation is toward zero, not toward -inf
    expect(fmul(3333, 3)).toBe(9); // 3.333 x 0.003 = 0.009999 -> 0.009
  });

  it('fdiv', () => {
    expect(fdiv(fx(6), fx(3))).toBe(fx(2));
    expect(fdiv(fx(1), fx(3))).toBe(333);
    expect(fdiv(fx(-1), fx(3))).toBe(-333);
    expect(fdiv(fx(1), fx(8))).toBe(125);
    expect(() => fdiv(fx(1), 0)).toThrow(OverflowError);
  });

  it('flerp', () => {
    expect(flerp(fx(0), fx(10), 0)).toBe(fx(0));
    expect(flerp(fx(0), fx(10), FIXED_ONE)).toBe(fx(10));
    expect(flerp(fx(0), fx(10), 500)).toBe(fx(5));
    expect(flerp(fx(10), fx(20), 250)).toBe(fx(12) + 500);
    expect(flerp(fx(-10), fx(10), 500)).toBe(0);
  });

  it('fclamp', () => {
    expect(fclamp(fx(5), fx(0), fx(10))).toBe(fx(5));
    expect(fclamp(fx(-1), fx(0), fx(10))).toBe(fx(0));
    expect(fclamp(fx(11), fx(0), fx(10))).toBe(fx(10));
    expect(() => fclamp(0, fx(10), fx(0))).toThrow(OverflowError);
  });

  it('isqrt is exact', () => {
    expect(isqrt(0)).toBe(0);
    expect(isqrt(1)).toBe(1);
    expect(isqrt(2)).toBe(1);
    expect(isqrt(15)).toBe(3);
    expect(isqrt(16)).toBe(4);
    expect(isqrt(1_000_000)).toBe(1000);
    expect(isqrt(2_147_395_600)).toBe(46340);
    for (let n = 0; n < 5000; n += 1) {
      const r = isqrt(n);
      expect(r * r).toBeLessThanOrEqual(n);
      expect((r + 1) * (r + 1)).toBeGreaterThan(n);
    }
    expect(() => isqrt(-1)).toThrow(OverflowError);
  });

  it('fsqrt', () => {
    expect(fsqrt(fx(4))).toBe(fx(2));
    expect(fsqrt(fx(9))).toBe(fx(3));
    expect(fsqrt(fx(0))).toBe(0);
    expect(fsqrt(fx(2))).toBe(1414); // sqrt(2) = 1.41421...
    expect(fsqrt(500)).toBe(707); // sqrt(0.5) = 0.70710...
    expect(() => fsqrt(-1)).toThrow(OverflowError);
  });

  it('fpercent', () => {
    expect(fpercent(200, 50)).toBe(100);
    expect(fpercent(fx(80), 25)).toBe(fx(20));
    expect(fpercent(7, 33)).toBe(2); // 2.31 truncates
    expect(fpercent(-200, 50)).toBe(-100);
    expect(fpercent(0, 99)).toBe(0);
  });

  it('fabs, fmin, fmax', () => {
    expect(fabs(-2500)).toBe(2500);
    expect(fabs(2500)).toBe(2500);
    expect(fmin(1, 2)).toBe(1);
    expect(fmax(1, 2)).toBe(2);
  });
});

describe('T-M0-02 fixed: overflow guards', () => {
  it('assertInt32 accepts the bounds and rejects beyond them', () => {
    expect(assertInt32(0)).toBe(0);
    expect(assertInt32(INT32_MAX)).toBe(INT32_MAX);
    expect(assertInt32(INT32_MIN)).toBe(INT32_MIN);
    expect(() => assertInt32(INT32_MAX + 1, 'wealth')).toThrow(OverflowError);
    expect(() => assertInt32(INT32_MIN - 1, 'wealth')).toThrow(OverflowError);
    expect(() => assertInt32(1.5)).toThrow(OverflowError);
  });

  it('the year accumulator stays inside int32 for 200 years', () => {
    // simulation-core.md: TICKS_PER_YEAR x 200 years < 2^31
    expect(assertInt32(134400 * 200)).toBe(26_880_000);
  });

  it('fmul refuses a product that would lose integer precision', () => {
    expect(() => fmul(2 ** 30, 2 ** 30)).toThrow(OverflowError);
    expect(() => fdiv(2 ** 50, fx(1))).toThrow(OverflowError);
    expect(() => fx(2 ** 50)).toThrow(OverflowError);
    expect(() => fpercent(2 ** 50, 2 ** 10)).toThrow(OverflowError);
  });

  it('products just inside the safe range are exact', () => {
    expect(fmul(INT32_MAX, FIXED_ONE)).toBe(INT32_MAX);
    expect(fdiv(INT32_MAX, FIXED_ONE)).toBe(INT32_MAX);
  });
});
