/**
 * Combat system saved state: `02-systems/16-combat.md` § State.
 */

import type { Alert, EntityId, Tick } from '@core/types';

export interface CombatStateV1 {
  version: 1;
  alert: Alert;
  targets: [EntityId, EntityId][];
  cooldownUntil: [EntityId, Tick][];
  engagements: [EntityId, Tick][];
  unreachableSince?: [EntityId, Tick][];
}
