/** `schemas/system-state.md` MoraleState; components hold each dwarf's active thoughts. */
import type { RngState } from '@core/rng';
import type { EntityId, MoodTier, Tick } from '@core/types';

export interface MoraleStateV1 {
  stateVersion: 1;
  hallSpirit: number;
  hallSpiritTier: MoodTier;
  rng: RngState;
  /** Sleep state for the standing `slept_on_floor_last_night` row. */
  floorSleepers: EntityId[];
  /** Cached daily conditions; recomputed at the next day boundary. */
  dailyStandingDue: boolean;
  /** Pending recomputation, including the initial bootstrap tick. */
  hourlyDue: boolean;
  lastHearthTier: number;
  dayOffUntil: [EntityId, number][];
  sunlightSeen: EntityId[];
  statueSeen: [EntityId, EntityId, number][];
  /** Laboratories that spoiled a batch today (`lab_stink`), in the order spoiled; absent when none and in older saves. */
  labStinks?: LabStink[];
}

/** A spoiled batch's laboratory: its footprint's bounds on its level, and the tick the stink ends (the day's end). */
export interface LabStink { x0: number; y0: number; x1: number; y1: number; z: number; until: Tick }
