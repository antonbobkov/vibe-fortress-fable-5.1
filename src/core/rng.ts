/**
 * Deterministic random number streams.
 *
 * Implements `01-architecture/simulation-core.md` § Random numbers: `xoshiro128**` over 32-bit
 * integers, one persistent stream per system (`world.rngFor(systemId)`), whose state is part of
 * that system's saved state.
 *
 * Nothing here uses `Math.random`; an ESLint rule forbids it outside `src/platform`.
 */

import type { Fixed } from './fixed';

/** The four 32-bit words of a `xoshiro128**` generator. Saved and restored verbatim. */
export interface RngState {
  s0: number;
  s1: number;
  s2: number;
  s3: number;
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/**
 * `splitmix32`: expands one 32-bit seed into a well-mixed sequence. Used only to fill the four
 * state words, which is the standard way to seed a xoshiro generator from a single value.
 * See DECISIONS.md D-005.
 */
export function splitmix32(seed: number): () => number {
  let a = seed >>> 0;
  return (): number => {
    a = (a + 0x9e3779b9) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 0x85ebca6b) >>> 0;
    t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35) >>> 0;
    return (t ^ (t >>> 16)) >>> 0;
  };
}

/** FNV-1a over UTF-16 code units, 32 bits. Deterministic across engines. */
export function hashString(text: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (h ^ text.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * The seed of the stream `streamId` in the world `worldSeed`.
 * `simulation-core.md`: "returns a persistent stream seeded from `hash(worldSeed, systemId)`".
 */
export function seedFor(worldSeed: string, streamId: string): number {
  return hashString(streamId, hashString(worldSeed));
}

/** Build the four state words from one seed, never leaving the all-zero state. */
export function stateFromSeed(seed: number): RngState {
  const mix = splitmix32(seed);
  const s: RngState = { s0: mix(), s1: mix(), s2: mix(), s3: mix() };
  if ((s.s0 | s.s1 | s.s2 | s.s3) === 0) s.s0 = 0x9e3779b9;
  return s;
}

/**
 * One `xoshiro128**` stream. Every method is integer-only and deterministic; the whole state is
 * four 32-bit words, so `state()` / `setState()` are all serialization needs.
 */
export class RngStream {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seedOrState: number | RngState) {
    const st = typeof seedOrState === 'number' ? stateFromSeed(seedOrState) : seedOrState;
    this.s0 = st.s0 >>> 0;
    this.s1 = st.s1 >>> 0;
    this.s2 = st.s2 >>> 0;
    this.s3 = st.s3 >>> 0;
  }

  /** A stream for `streamId` inside the world `worldSeed`. */
  static forStream(worldSeed: string, streamId: string): RngStream {
    return new RngStream(seedFor(worldSeed, streamId));
  }

  /** The next 32-bit value, 0 … 2^32-1. The published `xoshiro128**` `next()`. */
  nextU32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (this.s1 << 9) >>> 0;
    this.s2 = (this.s2 ^ this.s0) >>> 0;
    this.s3 = (this.s3 ^ this.s1) >>> 0;
    this.s1 = (this.s1 ^ this.s2) >>> 0;
    this.s0 = (this.s0 ^ this.s3) >>> 0;
    this.s2 = (this.s2 ^ t) >>> 0;
    this.s3 = rotl(this.s3, 11);
    return result;
  }

  /**
   * A uniform integer in [loInclusive, hiInclusive]. Rejection sampling removes the modulo bias;
   * rejection is deterministic because it only consumes further draws from this stream.
   */
  int(loInclusive: number, hiInclusive: number): number {
    if (hiInclusive < loInclusive) {
      throw new RangeError(`RngStream.int with an empty range: [${loInclusive}, ${hiInclusive}]`);
    }
    const range = hiInclusive - loInclusive + 1;
    if (range === 1) return loInclusive;
    if (range > 0x100000000) {
      throw new RangeError(`RngStream.int range wider than 2^32: ${range}`);
    }
    const limit = 0x100000000 - (0x100000000 % range);
    let draw = this.nextU32();
    while (draw >= limit) draw = this.nextU32();
    return loInclusive + (draw % range);
  }

  /** True with probability `permille` / 1000. */
  chance(permille: number): boolean {
    return this.int(0, 999) < permille;
  }

  /** A uniform element of a non-empty array. */
  pick<T>(array: readonly T[]): T {
    if (array.length === 0) throw new RangeError('RngStream.pick from an empty array');
    const value = array[this.int(0, array.length - 1)];
    if (value === undefined && !(0 in array)) throw new RangeError('RngStream.pick: sparse array');
    return value as T;
  }

  /**
   * An element chosen in proportion to its weight. Entries with a weight of zero or less are
   * never chosen; the total must be positive.
   */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    let total = 0;
    for (let i = 0; i < entries.length; i += 1) {
      const w = entries[i]?.[1] ?? 0;
      if (w > 0) total += w;
    }
    if (total <= 0) throw new RangeError('RngStream.weighted with no positive weight');
    let roll = this.int(0, total - 1);
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      if (entry === undefined) continue;
      const w = entry[1];
      if (w <= 0) continue;
      if (roll < w) return entry[0];
      roll -= w;
    }
    throw new RangeError('RngStream.weighted fell through');
  }

  /** Fisher-Yates in place. */
  shuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i);
      const a = array[i] as T;
      const b = array[j] as T;
      array[i] = b;
      array[j] = a;
    }
  }

  /** A fraction 0 … 999 as a `Fixed`. */
  fixed(): Fixed {
    return this.int(0, 999);
  }

  /** A fresh independent stream derived from this one's current state. */
  fork(label: string): RngStream {
    return new RngStream(hashString(label, this.nextU32()));
  }

  /** The serializable state. */
  state(): RngState {
    return { s0: this.s0, s1: this.s1, s2: this.s2, s3: this.s3 };
  }

  /** Restore a state produced by {@link state}. */
  setState(st: RngState): void {
    this.s0 = st.s0 >>> 0;
    this.s1 = st.s1 >>> 0;
    this.s2 = st.s2 >>> 0;
    this.s3 = st.s3 >>> 0;
  }
}
