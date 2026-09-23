import type { TileIndex } from '@core/types';
import type { RngState } from '@core/rng';
import type { WaterBody } from './fishing';

export interface ForagingStateV1 {
  stateVersion: 1;
  huntable: number[];
  hunterAssignments: [number, number][];
  waterBodies: WaterBody[];
  bodyOfTile: [TileIndex, number][];
  bodiesStale: boolean;
  version: number;
  nextBodyId: number;
  nextFishTick: [number, number][];
  dailyDue: boolean;
  rng: RngState;
}
