/** `schemas/system-state.md` MoraleState; components hold each dwarf's active thoughts. */
import type { RngState } from '@core/rng';
import type { EntityId, MoodTier } from '@core/types';

export interface MoraleStateV1 {
  stateVersion: 1;
  hallSpirit: number;
  hallSpiritTier: MoodTier;
  rng: RngState;
  /** Sleep state for the standing `slept_on_floor_last_night` row. */
  floorSleepers: EntityId[];
  /** Cached daily conditions; recomputed at the next day boundary. */
  dailyStandingDue: boolean;
  hourlyDue: boolean;
  lastHearthTier: number;
  dayOffUntil: [EntityId, number][];
  sunlightSeen: EntityId[];
  statueSeen: [EntityId, EntityId, number][];
}
