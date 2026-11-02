/** `readers.of('25')`: `02-systems/25-runecraft.md` § Interfaces › Reader. */

import type { EntityId } from '@core/types';
import type { MishapRecord } from './state';

/** A runecaster's rune, in milli-rune, with what its regen is made of. */
export interface RuneView {
  readonly current: number;
  readonly max: number;
  /** Milli-rune a hour. */
  readonly regen: number;
  /** The metal percent of the regen (100 with no metal worn). */
  readonly metalPercent: number;
  /** The worn pieces that lower it, each by `METAL_RUNE_PENALTY_PERCENT`. */
  readonly metalPieces: readonly EntityId[];
  /** Whole hours to full; 0 when full, -1 when it never fills. */
  readonly hoursToFull: number;
}

export interface MagicReader {
  /** `magic.rune(id)`: current, max, regen with its breakdown and time to full; undefined without a `Rune`. */
  rune(id: EntityId): RuneView | undefined;
  /** Sanctum zones, ascending. */
  sanctums(): EntityId[];
  /** A sanctum's living apprentices, ascending. */
  apprentices(zoneId: EntityId): EntityId[];
  /** Attune sessions a dwarf has sat today. */
  sessionsToday(id: EntityId): number;
  /** The mishap chance per mille of a session by this dwarf in this sanctum. */
  mishapPermille(zoneId: EntityId, id: EntityId): number;
  /** A sanctum's last mishap, or undefined. */
  lastMishap(zoneId: EntityId): MishapRecord | undefined;
}
