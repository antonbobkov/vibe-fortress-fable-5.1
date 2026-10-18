/**
 * 13 items' saved state: `04-implementation/schemas/system-state.md` `ItemsState` and
 * `StockCount`. Private to the system.
 */

import type { RngState } from '@core/rng';
import type { EntityId, Tick, TileIndex } from '@core/types';

export interface StockCountV1 {
  total: number;
  available: number;
  /** `[materialClass, units]`, sorted by class. */
  byClass: [string, number][];
  /** Units per quality tier 0 … 5. */
  byQuality: number[];
}

export interface ItemsStateV1 {
  stateVersion: 1;
  wantsHauling: EntityId[];
  noHome: EntityId[];
  /** `[slotKey, jobId]`, sorted by key. */
  slotReservations: [string, number][];
  rotQueue: { bucketTick: Tick; items: EntityId[] }[];
  /** Decay accumulated under the last sampled location and temperature. */
  rotRecords: { id: EntityId; type: number; progress: number; sampledTick: Tick; speed: number; due: Tick }[];
  miasmaTiles: [TileIndex, Tick][];
  pendingDeaths: { id: EntityId; species: number; tile: TileIndex; name: string | null; wornItems: EntityId[]; foreign?: boolean }[];
  /** `[typeIndex, StockCount]`, ascending type. */
  counts: [number, StockCountV1][];
  wealthCached: number;
  wealthLastEmitted: number;
  stockpileTiles: [TileIndex, EntityId][];
  rng: RngState;
  /** Superset (D-068): the types whose counts changed since the last `StocksChanged`. */
  dirtyTypes: number[];
  /** Superset: announced `StockpileFull` once per stockpile until it has space (T-M2-03). */
  fullStockpiles: EntityId[];
  /** Superset: the building part of the wealth (14 § Value, summed from `BuildingCompleted`/`Removed`). */
  buildingWealth: number;
  /** Superset: stockpiles whose haul priority the player set (D-071). */
  explicitPriority: EntityId[];
  /** Superset: empty containers on their way to a stockpile that wants them, `[containerId, stockpileId]`. */
  incomingContainers: [EntityId, EntityId][];
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

/** Insert into an ascending array; false when already present. */
export function sortedInsert(list: number[], value: number): boolean {
  const at = lowerBound(list, value);
  if (list[at] === value) return false;
  list.splice(at, 0, value);
  return true;
}

/** Insert every value of an ascending array into an ascending array in one pass (the result of repeated `sortedInsert`). */
export function sortedMerge(list: number[], extra: readonly number[]): void {
  if (extra.length === 0) return;
  if (list.length === 0 || (list[list.length - 1] as number) < (extra[0] as number)) {
    for (const v of extra) list.push(v);
    return;
  }
  const merged: number[] = [];
  let i = 0;
  let j = 0;
  while (i < list.length || j < extra.length) {
    const a = i < list.length ? (list[i] as number) : Number.POSITIVE_INFINITY;
    const b = j < extra.length ? (extra[j] as number) : Number.POSITIVE_INFINITY;
    if (a < b) {
      merged.push(a);
      i += 1;
    } else if (b < a) {
      merged.push(b);
      j += 1;
    } else {
      merged.push(a);
      i += 1;
      j += 1;
    }
  }
  list.length = 0;
  for (const v of merged) list.push(v);
}

/** Remove from an ascending array; false when absent. */
export function sortedRemove(list: number[], value: number): boolean {
  const at = lowerBound(list, value);
  if (list[at] !== value) return false;
  list.splice(at, 1);
  return true;
}

export function sortedHas(list: readonly number[], value: number): boolean {
  return list[lowerBound(list, value)] === value;
}
