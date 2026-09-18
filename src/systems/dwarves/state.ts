/**
 * 10 dwarves' saved state: `schemas/system-state.md` `DwarvesState`, and `10-dwarves.md` § State.
 * Private to the system.
 */

import type { RngState } from '@core/rng';
import type { EntityId, TileIndex } from '@core/types';

export type TitleName = 'thane' | 'warden' | 'broker' | 'chief_medic';

export interface DwarvesStateV1 {
  stateVersion: 1;
  titles: Record<TitleName, EntityId>;
  populationCached: number;
  children: EntityId[];
  rng: RngState;
  /**
   * The idle anchor while there is no hearth hall: the wagon tile of the arrival (`creature-brains.md`
   * `goal = hearthHallTile(id) or wagonTile`; D-057). -1 when there was no arrival.
   */
  wagonTile: TileIndex;
}
