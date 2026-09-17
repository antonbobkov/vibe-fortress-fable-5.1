/**
 * Fixed-point arithmetic.
 *
 * Implements `01-architecture/simulation-core.md` § Fixed-point math: `Fixed` is an integer
 * scaled by `FIXED_SCALE = 1000`. Every fraction in a system is a `Fixed`; floating point
 * appears only in presentation.
 *
 * All operations truncate toward zero. Truncation (rather than rounding) is chosen because it
 * is the reading that changes the least state and is exactly reproducible on every engine.
 */

/** An integer scaled by {@link FIXED_SCALE}. */
export type Fixed = number;

/** The scale of a `Fixed`. `simulation-core.md` § Fixed-point math. */
export const FIXED_SCALE = 1000;

/** `Fixed` representation of 1. */
export const FIXED_ONE: Fixed = FIXED_SCALE;

/** `Fixed` representation of 0. */
export const FIXED_ZERO: Fixed = 0;

/** Largest exact integer product operand pair; see {@link assertSafeProduct}. */
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

/** The 32-bit signed bound the accumulator guards check against. */
export const INT32_MAX = 0x7fffffff;
export const INT32_MIN = -0x80000000;

export class OverflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OverflowError';
  }
}

/**
 * Guard for accumulators that must stay inside a signed 32-bit word
 * (`simulation-core.md` § Fixed-point math: "all accumulators are checked against 2^31 in tests").
 */
export function assertInt32(value: number, what = 'value'): number {
  if (!Number.isInteger(value)) throw new OverflowError(`${what} is not an integer: ${value}`);
  if (value > INT32_MAX || value < INT32_MIN) {
    throw new OverflowError(`${what} overflows int32: ${value}`);
  }
  return value;
}

function assertSafeProduct(a: number, b: number, what: string): void {
  if (a !== 0 && Math.abs(b) > MAX_SAFE / Math.abs(a)) {
    throw new OverflowError(`${what} exceeds exact integer range: ${a} * ${b}`);
  }
}

/** Truncate toward zero, normalising `-0` to `0` so that hashes and saves never differ. */
function trunc(n: number): number {
  const r = n < 0 ? Math.ceil(n) : Math.floor(n);
  return r === 0 ? 0 : r;
}

/** Integer `n` as a `Fixed`. `fx(3)` is 3.0. */
export function fx(n: number): Fixed {
  assertSafeProduct(n, FIXED_SCALE, 'fx');
  return trunc(n) * FIXED_SCALE;
}

/** `Fixed` back to an integer, truncating toward zero. */
export function toInt(a: Fixed): number {
  return trunc(a / FIXED_SCALE);
}

/** `Fixed` to the nearest integer, halves away from zero. */
export function fround(a: Fixed): number {
  return a < 0 ? -Math.round(-a / FIXED_SCALE) : Math.round(a / FIXED_SCALE);
}

/** a x b. */
export function fmul(a: Fixed, b: Fixed): Fixed {
  assertSafeProduct(a, b, 'fmul');
  return trunc((a * b) / FIXED_SCALE);
}

/** a / b. Throws on a zero divisor: a divide by zero is always a bug in the caller. */
export function fdiv(a: Fixed, b: Fixed): Fixed {
  if (b === 0) throw new OverflowError('fdiv by zero');
  assertSafeProduct(a, FIXED_SCALE, 'fdiv');
  return trunc((a * FIXED_SCALE) / b);
}

/** Linear interpolation: a at t=0, b at t=`FIXED_ONE`. `t` is not clamped. */
export function flerp(a: Fixed, b: Fixed, t: Fixed): Fixed {
  return a + fmul(b - a, t);
}

/** Clamp into [lo, hi]. */
export function fclamp(value: Fixed, lo: Fixed, hi: Fixed): Fixed {
  if (lo > hi) throw new OverflowError(`fclamp with inverted bounds: ${lo} > ${hi}`);
  return value < lo ? lo : value > hi ? hi : value;
}

/** Integer square root by Newton's method. Exact: the largest `r` with `r*r <= n`. */
export function isqrt(n: number): number {
  if (n < 0) throw new OverflowError(`isqrt of a negative: ${n}`);
  if (n < 2) return n;
  let r = Math.floor(Math.sqrt(n));
  // Correct the float estimate; at most a couple of steps.
  while (r * r > n) r -= 1;
  while ((r + 1) * (r + 1) <= n) r += 1;
  return r;
}

/** Square root of a `Fixed`. `fsqrt(fx(4)) === fx(2)`. */
export function fsqrt(a: Fixed): Fixed {
  if (a < 0) throw new OverflowError(`fsqrt of a negative: ${a}`);
  assertSafeProduct(a, FIXED_SCALE, 'fsqrt');
  return isqrt(a * FIXED_SCALE);
}

/**
 * `pct` percent of `value`, truncated. Works on plain integers and on `Fixed` alike, because
 * the scale cancels.
 */
export function fpercent(value: number, pct: number): number {
  assertSafeProduct(value, pct, 'fpercent');
  return trunc((value * pct) / 100);
}

/** Absolute value. */
export function fabs(a: Fixed): Fixed {
  return a < 0 ? -a : a;
}

/** Smallest of two `Fixed`. */
export function fmin(a: Fixed, b: Fixed): Fixed {
  return a < b ? a : b;
}

/** Largest of two `Fixed`. */
export function fmax(a: Fixed, b: Fixed): Fixed {
  return a > b ? a : b;
}
