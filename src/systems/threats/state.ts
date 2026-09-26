/**
 * Threats system state schema: `04-implementation/schemas/system-state.md` § ThreatsState.
 */

import type { RngState } from '@core/rng';
import type { EntityId, TileIndex } from '@core/types';

export interface ScheduleEntryState {
  nextTick: number;
  earliestTick: number;
  pendingSpawnTick: number;
}

export interface PendingArrivalState {
  kind: string;
  civ: string;
  size: number;
  arrivalTick: number;
  edge: 'n' | 'e' | 's' | 'w';
  warningEmitted: boolean;
}

export interface PendingSpawnState {
  partyId: EntityId;
  species: string;
  role: string;
  tile: TileIndex;
  tick: number;
  gearTier: number;
  isCaptain: boolean;
}

export interface ThreatsStateV1 {
  stateVersion: 1;
  schedule: [string, ScheduleEntryState][];
  renown: number;
  deepsilverTiles: TileIndex[];
  cavernSpawnCounts: [number, number][];
  webs: [TileIndex, EntityId][];
  namedCaptains: [string, EntityId][];
  pendingArrivals?: PendingArrivalState[];
  pendingSpawns?: PendingSpawnState[];
  rng: RngState;
}
