/**
 * 07 plants' saved state: `04-implementation/schemas/system-state.md` `PlantsState`, and
 * `02-systems/07-plants-and-farming.md` § State. Private to the system.
 *
 * Supersets: `dailyDue` (the `DayPassed` seen in step 4 of a tick is worked off in 07's own next
 * tick, never in the handler, because the daily pass writes tiles — D-089), and `wired` (the lazy
 * first-tick indexing of plots and wild plants, which a load must repeat — D-082).
 */

import type { RngState } from '@core/rng';
import type { EntityId, Tick, TileIndex } from '@core/types';

export interface PlantsStateV1 {
  stateVersion: 1;
  cropAtTile: [TileIndex, EntityId][];
  plotIndex: EntityId[];
  saplings: [TileIndex, Tick][];
  shrubTimers: [TileIndex, Tick][];
  bareSoil: TileIndex[];
  ashTiles: [TileIndex, Tick][];
  needsSeedsAnnounced: [EntityId, number][];
  rng: RngState;
  dailyDue: boolean;
  wired: boolean;
}
