import type { EntityId, TileIndex } from '@core/types';
import type { RngState } from '@core/rng';

export type TrapKind = 'stone_fall' | 'spike' | 'cage' | 'weapon';
/** `anyone`: a ruin's old trap, which no faction owns (19 § Trap targeting); the player cannot set it. */
export type TrapMode = 'enemies' | 'all' | 'anyone';
export type TrapStatus = 'armed' | 'spent' | 'jammed';
export interface TrapRecord { kind: TrapKind; mode: TrapMode; state: TrapStatus; loaded: EntityId[] }
export interface PlateRecord { lastState: boolean; lastEdgeTick: number }
export interface DefenseStateV1 {
  stateVersion: 1;
  traps: [EntityId, TrapRecord][];
  trapTiles: [TileIndex, EntityId][];
  plates: [EntityId, PlateRecord][];
  chains: [EntityId, EntityId][];
  /** Sheltering civilians' kept retreat tiles; absent when none, and in older saves. */
  retreats?: [EntityId, TileIndex][];
  rng: RngState;
}
