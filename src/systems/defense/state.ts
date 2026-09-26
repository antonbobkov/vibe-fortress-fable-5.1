import type { EntityId, TileIndex } from '@core/types';
import type { RngState } from '@core/rng';

export type TrapKind = 'stone_fall' | 'spike' | 'cage' | 'weapon';
export type TrapMode = 'enemies' | 'all';
export type TrapStatus = 'armed' | 'spent' | 'jammed';
export interface TrapRecord { kind: TrapKind; mode: TrapMode; state: TrapStatus; loaded: EntityId[] }
export interface PlateRecord { lastState: boolean; lastEdgeTick: number }
export interface DefenseStateV1 {
  stateVersion: 1;
  traps: [EntityId, TrapRecord][];
  trapTiles: [TileIndex, EntityId][];
  plates: [EntityId, PlateRecord][];
  chains: [EntityId, EntityId][];
  rng: RngState;
}
