/**
 * `readers.of('07')`: `02-systems/07-plants-and-farming.md` § Interfaces › Reader. Records and
 * arrays returned are fresh copies; entity references are ids.
 */

import type { EntityId, TileIndex } from '@core/types';
import type { PlantRow } from './facts';
import type { PlotKind } from './plots';

export interface CropInfo {
  /** The species' content id. */
  readonly species: string;
  /** The `plants` table index (`Crop.plant`). */
  readonly plant: number;
  readonly stage: number;
  /** Percent of the way through the current stage; 100 at stage 3. */
  readonly percent: number;
  readonly tile: TileIndex;
  readonly plotZoneId: EntityId;
}

export interface PlantsReader {
  /** The crop entity on a tile, or 0. */
  cropAt(i: TileIndex): EntityId;
  cropInfo(id: EntityId): CropInfo | undefined;
  /** Every crop, ascending id. */
  crops(): EntityId[];
  /** The crop on a tile is ready to harvest (stage 3 with its own stage days run; D-107). */
  cropReady(i: TileIndex): boolean;
  /** The farm plot zone a tile belongs to, or 0. */
  plotAt(i: TileIndex): EntityId;
  /** The four season slots of a plot, as `plants` indices (0 = none). */
  plotSettings(zoneId: EntityId): number[];
  plotKind(zoneId: EntityId): PlotKind | 'none';
  /** Farm plot zones, ascending id. */
  plots(): EntityId[];
  /** The species content id of a tree, sapling or shrub tile, or ''. */
  speciesAt(i: TileIndex): string;
  /** A mature (not regrowing) shrub tile. */
  shrubReady(i: TileIndex): boolean;
  hasGrass(i: TileIndex): boolean;
  /** The `plants` row by content id or `plants` index. */
  def(speciesId: string | number): PlantRow | undefined;
  /** Tiles waiting for grass to regrow, ascending (`07` § Grass, `bareSoil`). */
  bareSoil(): TileIndex[];
  /** Tiles whose ash has not expired, ascending (`07` § Ash). */
  ashTiles(): TileIndex[];
  /** Sapling tiles, ascending. */
  saplings(): TileIndex[];
}
