/**
 * 14 buildings' saved state: `04-implementation/schemas/system-state.md` `BuildingsState`.
 * Private to the system.
 */

import type { RngState } from '@core/rng';
import type { EntityId, Tick, TileIndex } from '@core/types';

export interface BuildingsStateV1 {
  stateVersion: 1;
  /** `[tile, zoneId]`, ascending tile. One zone per tile; a meeting area over a hall is kept in its own tiles (D-071). */
  zoneAt: [TileIndex, EntityId][];
  hearthId: EntityId;
  depots: EntityId[];
  coffins: EntityId[];
  dirtyRooms: EntityId[];
  pendingToggles: { id: EntityId; on: boolean; atTick: Tick }[];
  rng: RngState;
  /** Superset: buildings waiting for their build or deconstruct job (D-073). */
  pendingJobs: EntityId[];
  /** Superset: tiles `MagmaContact` named, for 14's next tick (D-098). */
  magmaTouched?: TileIndex[];
  /** T-M4-13: common furniture targeted by a sulk, removed only during 14's tick. */
  brokenFurniture?: EntityId[];
  /** T-M5-05: lamp coverage and the original crop light under each covered tile. */
  lampLight?: { tile: TileIndex; count: number; baseLit: boolean }[];
}

/** Binary search: the insertion point of `value` in an ascending array. */
export function lowerBound(list: readonly number[], value: number): number {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((list[mid] as number) < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function sortedInsert(list: number[], value: number): boolean {
  const at = lowerBound(list, value);
  if (list[at] === value) return false;
  list.splice(at, 0, value);
  return true;
}

export function sortedRemove(list: number[], value: number): boolean {
  const at = lowerBound(list, value);
  if (list[at] !== value) return false;
  list.splice(at, 1);
  return true;
}
