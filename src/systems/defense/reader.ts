import type { EntityId, TileIndex } from '@core/types';
import type { TrapMode, TrapStatus } from './state';

export interface DefenseReader {
  trapAt(tile: TileIndex): EntityId;
  trapState(id: EntityId): TrapStatus | null;
  trapMode(id: EntityId): TrapMode | null;
  retreatTile(dwarfId: EntityId): TileIndex;
  plateActive(id: EntityId): boolean;
  stationOf(animalId: EntityId): EntityId;
}
