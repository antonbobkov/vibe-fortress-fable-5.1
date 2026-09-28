import type { RngState } from '@core/rng';
import type { EntityId, TileIndex } from '@core/types';
import type { DwarfRecord } from '@systems/dwarves/rules/make-dwarf';

export interface PlannedImmigrant {
  record: DwarfRecord;
  profession: string;
  spouseIndex: number;
  parentIndex: number;
  pet: 'dog' | 'cat' | null;
  tile: TileIndex;
}

export interface PendingWave {
  planned: PlannedImmigrant[];
  ids: EntityId[];
  nextIndex: number;
  nextSpawnTick: number;
  guaranteed: boolean;
}

export interface ImmigrationStateV1 {
  stateVersion: 1;
  wavesSoFar: number;
  guaranteedDone: [boolean, boolean];
  lastWave: { tick: number; count: number } | null;
  deferredUntilTick: number;
  deferredSeason: number;
  deferredYear: number;
  lastSkipReason: string | null;
  pending: PendingWave | null;
  raidOngoing: boolean;
  rng: RngState;
}
