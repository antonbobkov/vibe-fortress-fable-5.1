/**
 * `readers.of('03')`: `02-systems/03-terrain-and-mining.md` § Interfaces › Reader, plus the tile
 * inspector data of § Registrations (inspector section `tile`) and § Player-facing behavior (the
 * look cursor: material, smoothed or engraved, the designation, "undiscovered").
 */

import { Designation, TileFlag, TileKind } from '@core/map3d';
import type { EntityId, Priority, TileIndex } from '@core/types';
import type { LocalMapSpec } from '@systems/embark';
import type { IntendedDrop, TerrainCore } from './api';
import type { MaterialClass } from './rules/transitions';
import type { DesignationEntry } from './state';

/** `03` § Discovery: "the material is shown as 'unknown rock'". */
export const UNKNOWN_ROCK = 'unknown rock';

export interface TileInspection {
  readonly tile: TileIndex;
  readonly discovered: boolean;
  readonly kind: TileKind;
  /** The material's name, or "unknown rock" for an undiscovered tile. */
  readonly material: string;
  readonly materialClass: MaterialClass | 'unknown';
  readonly smoothed: boolean;
  readonly engraved: boolean;
  readonly designation: { kind: Designation; priority: Priority } | null;
  readonly engraving: { quality: number; engraverId: EntityId; motif: number } | null;
  readonly forbidden: boolean;
  readonly restricted: boolean;
}

export interface TerrainReader {
  designationAt(i: TileIndex): { kind: Designation; priority: Priority } | null;
  /** A fresh array in tile order. */
  designations(): DesignationEntry[];
  engravingAt(i: TileIndex): { quality: number; engraverId: EntityId; motif: number } | null;
  surfaceZ(x: number, y: number): number;
  isSupported(i: TileIndex): boolean;
  /** `n` is 1, 2 or 3. */
  cavernBreached(n: number): boolean;
  materialClassAt(i: TileIndex): MaterialClass;
  spec(): LocalMapSpec | null;
  isForbidden(i: TileIndex): boolean;
  /** Items 03 owes the world until the item system exists (M2); a fresh copy. */
  intendedDrops(): IntendedDrop[];
  /** The look cursor's data for a tile. */
  inspect(i: TileIndex): TileInspection;
  /** Where a designated tile's work stands (23 § Animation's blink), or null with no designation. */
  designationWork(i: TileIndex): DesignationWork | null;
}

/** `queued`: its job is open or not made yet; `assigned`: a worker holds it; `blocked`: its job is blocked. */
export type DesignationWork = 'queued' | 'assigned' | 'blocked';

export function makeReader(
  core: TerrainCore,
  spec: () => LocalMapSpec | null,
  progressOf: (tile: TileIndex) => number,
  workOf: (tile: TileIndex) => DesignationWork | null = (tile) => (core.host.map.designationAt(tile) === Designation.None ? null : 'queued'),
): TerrainReader {
  const map = core.host.map;
  const facts = core.host.facts;
  const designationAt = (i: TileIndex): { kind: Designation; priority: Priority } | null => {
    const kind = map.designationAt(i);
    return kind === Designation.None ? null : { kind, priority: map.designationPriorityAt(i) as Priority };
  };
  const materialClassAt = (i: TileIndex): MaterialClass => {
    const kind = map.kindAt(i);
    if (kind === TileKind.Tree || kind === TileKind.Sapling || kind === TileKind.Shrub) return 'wood';
    if (map.hasFlag(i, TileFlag.Constructed)) return 'constructed';
    return facts.classOf(map.materialAt(i));
  };
  const engravingAt = (i: TileIndex): { quality: number; engraverId: EntityId; motif: number } | null => {
    const e = core.engravings.get(i);
    return e === undefined ? null : { ...e };
  };
  return {
    designationAt,
    designations: () =>
      core.designated.map((tile) => ({
        tile,
        kind: map.designationAt(tile),
        priority: map.designationPriorityAt(tile) as Priority,
        progress: progressOf(tile),
      })),
    engravingAt,
    surfaceZ: (x, y) => map.columnSurfaceZ(x, y),
    isSupported: (i) => core.isSupported(i),
    cavernBreached: (n) => core.cavernBreached[n - 1] === true,
    materialClassAt,
    spec,
    isForbidden: (i) => core.isForbidden(i),
    intendedDrops: () => core.drops.slice(),
    designationWork: (i) => workOf(i),
    inspect: (i) => {
      const discovered = map.hasFlag(i, TileFlag.Discovered);
      const kind = map.kindAt(i);
      const plant = kind === TileKind.Tree || kind === TileKind.Sapling || kind === TileKind.Shrub;
      return {
        tile: i,
        discovered,
        kind,
        material: !discovered ? UNKNOWN_ROCK : plant ? (facts.plant(map.materialAt(i))?.id ?? '') : facts.materialName(map.materialAt(i)),
        materialClass: discovered ? materialClassAt(i) : 'unknown',
        smoothed: map.hasFlag(i, TileFlag.Smoothed),
        engraved: map.hasFlag(i, TileFlag.Engraved),
        designation: designationAt(i),
        engraving: engravingAt(i),
        forbidden: core.isForbidden(i),
        restricted: map.hasFlag(i, TileFlag.Restricted),
      };
    },
  };
}
