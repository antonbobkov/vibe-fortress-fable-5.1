import type { EntityId, TileIndex } from '@core/types';
import type { ButcherYieldsWithParts } from './butcher';
import type { WaterBody } from './fishing';

export interface ForagingReader {
  isHuntable(species: string | number): boolean;
  huntTargets(): EntityId[];
  waterBodyAt(tile: TileIndex): WaterBody | undefined;
  fishPool(bodyId: number): number;
  canFishAt(tile: TileIndex): boolean;
  /**
   * The kind of the largest body of open water (not a cavern's) of at least `MIN_FISHING_TILES`
   * tiles that has a bank a fishing zone could take, or null (`09` § Fishing). A fresh flood fill
   * of the map that leaves the saved bodies untouched: a whole-map read, for a once-only hint.
   */
  fishableWater(): 'river' | 'lake' | null;
  /** A whole adult corpse's yields, with the species' butcher parts (`09` § Butchery). */
  butcherYields(species: string | number): ButcherYieldsWithParts;
}
