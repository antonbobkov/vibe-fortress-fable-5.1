import type { WorkOrder } from '@core/components';
import type { RngState } from '@core/rng';
import type { EntityId } from '@core/types';

/** `schemas/system-state.md` WorkshopsState. Workshop components are saved with entities. */
export interface WorkshopsStateV1 {
  stateVersion: 1;
  globalOrders: WorkOrder[];
  professionCache: [EntityId, string][];
  rng: RngState;
  /** D-082: registration was connected before the saved tick. */
  ticked: boolean;
}

