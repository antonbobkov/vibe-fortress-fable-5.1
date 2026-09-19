/**
 * 04 fluids' saved state: `04-implementation/schemas/system-state.md` `FluidsState`, and
 * `02-systems/04-fluids.md` § State.
 *
 * `idleCounter` is stored parallel to `active` (one counter per active tile), because the counter
 * is "only meaningful for active tiles" (`04` § State) and a freshly activated tile starts from 0.
 * `freezePending` records that a `TemperatureTick` waits for this system's next tick (T-M3-05).
 *
 * Private to the system (`module-interfaces.md` § Interface stability).
 */

import type { TileKind } from '@core/map3d';
import type { RngState } from '@core/rng';
import type { Tick, TileIndex } from '@core/types';

export interface FluidsStateV1 {
  stateVersion: 1;
  /** Active tile indices, every chunk's list concatenated in chunk order, each ascending. */
  active: number[];
  /** `activeChunkOffsets[c]..activeChunkOffsets[c + 1]` is chunk `c`'s slice of `active`. */
  activeChunkOffsets: number[];
  /** The idle counter of each active tile, parallel to `active`. */
  idleCounter: number[];
  waterSources: TileIndex[];
  magmaSources: TileIndex[];
  sinks: TileIndex[];
  outdoorWaterTiles: TileIndex[];
  frozenOriginalKind: [TileIndex, TileKind][];
  /** Superset: the material each frozen tile had, restored on thaw (D-099). */
  frozenOriginalMaterial?: [TileIndex, number][];
  /** Superset: the ice kind each frozen tile became, to tell a dug one (D-099). */
  frozenIceKind?: [TileIndex, TileKind][];
  mistTiles: [TileIndex, Tick][];
  /** The tick of 04's last step, against which `isMisty` compares expiry (T-M3-07; a superset). */
  mistNow?: Tick;
  stepParity: 0 | 1;
  spreadRotation: 0 | 1 | 2 | 3;
  rng: RngState;
  freezePending: boolean;
}

/** Keeps a sorted array of numbers sorted; true when the value was added. */
export function sortedInsert(list: number[], value: number): boolean {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((list[mid] as number) < value) lo = mid + 1;
    else hi = mid;
  }
  if (list[lo] === value) return false;
  list.splice(lo, 0, value);
  return true;
}

/** Removes a value from a sorted array; true when it was present. */
export function sortedRemove(list: number[], value: number): boolean {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((list[mid] as number) < value) lo = mid + 1;
    else hi = mid;
  }
  if (list[lo] !== value) return false;
  list.splice(lo, 1);
  return true;
}

/** Whether a sorted array holds a value. */
export function sortedHas(list: readonly number[], value: number): boolean {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((list[mid] as number) < value) lo = mid + 1;
    else hi = mid;
  }
  return list[lo] === value;
}
