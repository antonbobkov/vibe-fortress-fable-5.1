/**
 * 05 materials' saved state: `04-implementation/schemas/system-state.md` `MaterialsState`, and
 * `02-systems/05-materials-and-temperature.md` § State.
 *
 * Supersets (D-095, D-093, T-M3-04): `started` (the first tick's override computation has run),
 * `pendingChunks` (chunks waiting for this system's next tick to recompute), `forced` (test and
 * debug temperatures by tile, `TestWorld.forceTemperature`), `itemBurn` (burn timers of items on
 * burning tiles), `pendingIgnite` (tiles to test for ignition next tick).
 *
 * Private to the system (`module-interfaces.md` § Interface stability).
 */

import type { RngState } from '@core/rng';
import type { ChunkIndex, EntityId, TileIndex } from '@core/types';

export interface BurningState {
  remainingTicks: number;
  spreadCooldown: number;
}

export interface MaterialsStateV1 {
  stateVersion: 1;
  burning: [TileIndex, BurningState][];
  warmSprings: TileIndex[];
  magmaSourceChunks: ChunkIndex[];
  /** Per chunk with magma, a signature of its magma tiles (D-095). */
  magmaSignatures: [ChunkIndex, number][];
  rng: RngState;
  started: boolean;
  pendingChunks: ChunkIndex[];
  forced: [TileIndex, number][];
  itemBurn: [EntityId, number][];
  pendingIgnite: TileIndex[];
  /** `05` § Smoke: each smoky workshop's centre tile and the tick its smoke clears, ascending; omitted when none. */
  smoke?: [TileIndex, number][];
  /** `05` § Ice constructions: each ice wall or floor and the tick it was built, ascending; omitted when none. */
  iceBuilt?: [TileIndex, number][];
  /** A `DayPassed` came: the next materials tick melts the underground ice whose days are up. Omitted when false. */
  iceDayDue?: true;
  /** The day of the last `IceMelted` (one a day); omitted before the first. */
  iceMeltedDay?: number;
}
