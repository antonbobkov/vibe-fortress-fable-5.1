/**
 * Value noise and hashing utilities.
 *
 * Implements the noise of `04-implementation/algorithms/world-generation.md` (preamble): "value
 * noise on an integer lattice with fixed-point smoothstep interpolation; `noise(stream, x, y, freq,
 * octaves, amps)` sums octaves with lattice values drawn from a hash of `(seed, octave, lx, ly)`
 * so that the field is a pure function of the seed (the stream is used only for the per-stage
 * salt)". The same lattice noise, in 3D, drives the cavern bands of
 * `algorithms/local-map-generation.md` § 4.
 *
 * Every function here is pure and integer-only. Samples are `Fixed` (`simulation-core.md`
 * § Fixed-point math): a lattice value is an integer in `0 … round(amplitude × FIXED_SCALE)` and
 * the interpolation truncates toward zero, so the same inputs give the same bits on every engine.
 *
 * The octave argument is a *period* in cells (the lattice spacing): an octave of period 32 is the
 * frequency 1/32 the plan's tests speak of. A period may be fractional (`size / 12`); it is
 * converted to thousandths once, and every sample position is then exact integer arithmetic.
 */

import { FIXED_SCALE, type Fixed } from './fixed';
import { hashString } from './rng';

// ---------- hashing ----------

/** The 32-bit finaliser of MurmurHash3: a bijective avalanche mix. */
export function mix32(value: number): number {
  let h = value >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Fold one signed 32-bit integer into a running hash. */
function foldInt(h: number, value: number): number {
  return mix32((h ^ mix32((value | 0) + 0x9e3779b9)) + 0x7f4a7c15);
}

/**
 * Hash a seed and up to four integer coordinates to a uint32. The lattice hash of the noise
 * functions: `(seed, octave, lx, ly[, lz])`.
 */
export function hashInts(seed: number, a: number, b = 0, c = 0, d = 0): number {
  let h = mix32(seed ^ 0x2545f491);
  h = foldInt(h, a);
  h = foldInt(h, b);
  h = foldInt(h, c);
  h = foldInt(h, d);
  return h;
}

/** One salt of {@link hash}: a string, or an integer. */
export type HashSalt = string | number;

function foldSalt(h: number, salt: HashSalt): number {
  if (typeof salt === 'string') return mix32(hashString(salt, h ^ 0x811c9dc5) ^ 0x68e31da4);
  if (!Number.isInteger(salt)) throw new RangeError(`hash salt must be an integer or a string: ${salt}`);
  // Fold both 32-bit halves so integers beyond 2^32 still hash distinctly.
  const lo = salt % 0x100000000;
  const hi = Math.floor(salt / 0x100000000);
  return foldInt(foldInt(h ^ 0x1b873593, lo | 0), hi | 0);
}

/**
 * `hash(seed, ...salts)`: a 32-bit hash of a seed (string or integer) and any number of salts.
 * Order matters; `hash(s, 'a', 'b') !== hash(s, 'b', 'a')`.
 */
export function hash(seed: HashSalt, ...salts: readonly HashSalt[]): number {
  let h = typeof seed === 'string' ? mix32(hashString(seed)) : foldSalt(0x3c6ef372, seed);
  for (let k = 0; k < salts.length; k += 1) h = foldSalt(h, salts[k] as HashSalt);
  return h >>> 0;
}

/**
 * `hash64(seed, ...salts)`: a 64-bit hash as 16 lowercase hex digits. `simulation-core.md`
 * § Random numbers: "The world seed is a 64-bit value shown to the player as a string", so the
 * 64-bit value is carried as its hex string (`LocalMapSpec.seed` is a `string`,
 * `schemas/system-state.md`). The two halves are independent 32-bit lanes.
 */
export function hash64(seed: HashSalt, ...salts: readonly HashSalt[]): string {
  const hi = hash(seed, ...salts);
  const lo = hash(seed, ...salts, 'hash64.lo');
  return `${hi.toString(16).padStart(8, '0')}${lo.toString(16).padStart(8, '0')}`;
}

// ---------- interpolation ----------

/** Fixed-point smoothstep: `3t² − 2t³` for `t` in `0 … FIXED_SCALE`, truncated. */
export function smoothstep(t: Fixed): Fixed {
  if (t <= 0) return 0;
  if (t >= FIXED_SCALE) return FIXED_SCALE;
  return Math.floor((t * t * (3 * FIXED_SCALE - 2 * t)) / (FIXED_SCALE * FIXED_SCALE));
}

/** `a + (b − a) × s`, `s` a `Fixed` in 0 … 1, truncated toward zero; stays within [a, b]. */
function lerpFx(a: number, b: number, s: Fixed): number {
  const d = (b - a) * s;
  const step = d < 0 ? Math.ceil(d / FIXED_SCALE) : Math.floor(d / FIXED_SCALE);
  return a + step;
}

/** A period in cells as thousandths of a cell, rejecting what cannot be a lattice spacing. */
function periodMilli(period: number): number {
  const p = Math.round(period * FIXED_SCALE);
  if (!Number.isFinite(period) || p < 1) throw new RangeError(`noise period must be positive: ${period}`);
  return p;
}

/** An amplitude as a `Fixed`, rejecting negatives. */
export function amplitudeFx(amplitude: number): Fixed {
  const a = Math.round(amplitude * FIXED_SCALE);
  if (!Number.isFinite(amplitude) || a < 0) throw new RangeError(`noise amplitude must be ≥ 0: ${amplitude}`);
  return a;
}

/** Lattice cell and fraction of an integer coordinate at a period: `{ cell, t }` with `t` in 0 … 999. */
function locate(coord: number, pMilli: number): [number, number] {
  const pos = Math.floor((coord * FIXED_SCALE * FIXED_SCALE) / pMilli); // thousandths of a lattice cell
  const cell = Math.floor(pos / FIXED_SCALE);
  return [cell, pos - cell * FIXED_SCALE];
}

function lattice(seed: number, octave: number, ampFx: Fixed, lx: number, ly: number, lz: number): number {
  if (ampFx === 0) return 0;
  return hashInts(seed, octave, lx, ly, lz) % (ampFx + 1);
}

// ---------- 2D ----------

/**
 * One octave of 2D value noise at integer coordinates: a `Fixed` in `0 … amplitude`.
 * `octave` salts the lattice so that the octaves of one field are independent.
 */
export function valueNoise2(seed: number, x: number, y: number, period: number, amplitude: number, octave = 0): Fixed {
  const p = periodMilli(period);
  const amp = amplitudeFx(amplitude);
  const [lx, tx] = locate(x, p);
  const [ly, ty] = locate(y, p);
  const sx = smoothstep(tx);
  const sy = smoothstep(ty);
  const v00 = lattice(seed, octave, amp, lx, ly, 0);
  const v10 = lattice(seed, octave, amp, lx + 1, ly, 0);
  const v01 = lattice(seed, octave, amp, lx, ly + 1, 0);
  const v11 = lattice(seed, octave, amp, lx + 1, ly + 1, 0);
  return lerpFx(lerpFx(v00, v10, sx), lerpFx(v01, v11, sx), sy);
}

/**
 * `noise(seed, x, y, periods, amps)`: the sum of octaves, octave `k` at `periods[k]` with
 * amplitude `amps[k]`. A `Fixed` in `0 … Σ amps`.
 */
export function noise2(seed: number, x: number, y: number, periods: readonly number[], amps: readonly number[]): Fixed {
  if (periods.length !== amps.length) throw new RangeError('noise2: periods and amplitudes differ in length');
  let sum = 0;
  for (let k = 0; k < periods.length; k += 1) {
    sum += valueNoise2(seed, x, y, periods[k] as number, amps[k] as number, k);
  }
  return sum;
}

// ---------- 3D ----------

/** One octave of 3D value noise at integer coordinates: a `Fixed` in `0 … amplitude`. */
export function valueNoise3(
  seed: number,
  x: number,
  y: number,
  z: number,
  period: number,
  amplitude: number,
  octave = 0,
): Fixed {
  const p = periodMilli(period);
  const amp = amplitudeFx(amplitude);
  const [lx, tx] = locate(x, p);
  const [ly, ty] = locate(y, p);
  const [lz, tz] = locate(z, p);
  const sx = smoothstep(tx);
  const sy = smoothstep(ty);
  const sz = smoothstep(tz);
  const o = octave;
  const c000 = lattice(seed, o, amp, lx, ly, lz);
  const c100 = lattice(seed, o, amp, lx + 1, ly, lz);
  const c010 = lattice(seed, o, amp, lx, ly + 1, lz);
  const c110 = lattice(seed, o, amp, lx + 1, ly + 1, lz);
  const c001 = lattice(seed, o, amp, lx, ly, lz + 1);
  const c101 = lattice(seed, o, amp, lx + 1, ly, lz + 1);
  const c011 = lattice(seed, o, amp, lx, ly + 1, lz + 1);
  const c111 = lattice(seed, o, amp, lx + 1, ly + 1, lz + 1);
  const near = lerpFx(lerpFx(c000, c100, sx), lerpFx(c010, c110, sx), sy);
  const far = lerpFx(lerpFx(c001, c101, sx), lerpFx(c011, c111, sx), sy);
  return lerpFx(near, far, sz);
}

/** The 3D sum of octaves; a `Fixed` in `0 … Σ amps`. */
export function noise3(
  seed: number,
  x: number,
  y: number,
  z: number,
  periods: readonly number[],
  amps: readonly number[],
): Fixed {
  if (periods.length !== amps.length) throw new RangeError('noise3: periods and amplitudes differ in length');
  let sum = 0;
  for (let k = 0; k < periods.length; k += 1) {
    sum += valueNoise3(seed, x, y, z, periods[k] as number, amps[k] as number, k);
  }
  return sum;
}
