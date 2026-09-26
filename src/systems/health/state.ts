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
  rng: RngState;
}
