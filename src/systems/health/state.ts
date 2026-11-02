/**
 * Health system persistent state: `04-implementation/schemas/system-state.md` § HealthState.
 */

import type { RngState } from '@core/rng';
import type { EntityId } from '@core/types';

export interface HealthStateV1 {
  stateVersion: 1;
  wounded: EntityId[];
  hospitals: EntityId[];
  patientJobs: [EntityId, string[]][];
  /** Failed still-needed wound treatments, retained independently of admission. */
  pendingTreatments?: [EntityId, string[]][];
  /** Creatures held unconscious by a stun, and the tick it ends; absent when none, and in older saves. */
  stunnedUntil?: [EntityId, number][];
  rng: RngState;
}
