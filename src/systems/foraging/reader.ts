import type { EntityId, TileIndex } from '@core/types';
import type { ButcherYields } from './butcher';
import type { WaterBody } from './fishing';

export interface ForagingReader {
  isHuntable(species: string | number): boolean;
  huntTargets(): EntityId[];
  waterBodyAt(tile: TileIndex): WaterBody | undefined;
  fishPool(bodyId: number): number;
  canFishAt(tile: TileIndex): boolean;
  butcherYields(species: string | number): ButcherYields;
}
