import type { EntityId, TileIndex } from '@core/types';
import type { ButcherYieldsWithParts } from './butcher';
import type { WaterBody } from './fishing';

export interface ForagingReader {
  isHuntable(species: string | number): boolean;
  huntTargets(): EntityId[];
  waterBodyAt(tile: TileIndex): WaterBody | undefined;
  fishPool(bodyId: number): number;
  canFishAt(tile: TileIndex): boolean;
  /** A whole adult corpse's yields, with the species' butcher parts (`09` § Butchery). */
  butcherYields(species: string | number): ButcherYieldsWithParts;
}
