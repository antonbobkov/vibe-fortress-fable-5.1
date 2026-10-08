/**
 * 03 terrain's saved state: `04-implementation/schemas/system-state.md` `TerrainState`, and
 * `02-systems/03-terrain-and-mining.md` § State.
 *
 * Private to the system (`module-interfaces.md` § Interface stability).
 */

import type { Designation } from '@core/map3d';
import type { RngState } from '@core/rng';
import type { EntityId, Priority, Quality, TileIndex } from '@core/types';
import type { LocalMapSpec } from '@systems/embark';

export interface DesignationEntry {
  tile: TileIndex;
  kind: Designation;
  priority: Priority;
  /** The progress of the designation's job (`Fixed`), mirrored from 11 when saved. */
  progress: number;
}

export interface Engraving {
  quality: Quality;
  engraverId: EntityId;
  motif: number;
}

export interface TerrainStateV1 {
  stateVersion: 1;
  designations: DesignationEntry[];
  engravings: [TileIndex, Engraving][];
  forbiddenTiles: TileIndex[];
  cavernBreached: [boolean, boolean, boolean];
  layerStack: { material: number; thickness: number }[];
  rng: RngState;
  bigDigCounter: number;
  /** The veins already found, each keyed by its lowest tile (docs/02-systems/03-terrain-and-mining.md § Discovery). */
  veinsFound: TileIndex[];
  /** The `LocalMapSpec` of the map, for the legend and regeneration in tests (`03` § State). */
  spec: LocalMapSpec | null;
  /** `EntitiesMoved` batches handled but not yet ticked (discovery runs next tick; D-082). */
  pendingMoves?: [EntityId, TileIndex, TileIndex][];
  /** The job producer has scanned the current designations (D-082). */
  producerCurrent?: boolean;
}

/** Keeps a sorted array of numbers sorted; the sets of `03` § State are sorted arrays. */
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

export function sortedRemove(list: number[], value: number): boolean {
  const at = sortedIndexOf(list, value);
  if (at < 0) return false;
  list.splice(at, 1);
  return true;
}

export function sortedIndexOf(list: readonly number[], value: number): number {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((list[mid] as number) < value) lo = mid + 1;
    else hi = mid;
  }
  return list[lo] === value ? lo : -1;
}
