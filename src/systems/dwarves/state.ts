/**
 * 10 dwarves' saved state: `schemas/system-state.md` `DwarvesState`, and `10-dwarves.md` § State.
 * Private to the system.
 */

import type { RngState } from '@core/rng';
import type { EntityId, TileIndex } from '@core/types';
import type { NeedName } from './needs';

export type TitleName = 'thane' | 'warden' | 'broker' | 'chief_medic';

export interface ActivityPlan {
  need: string;
  phase: 'travel' | 'seat' | 'use';
  itemId: EntityId;
  partner: EntityId;
  target: TileIndex;
  until: number;
  ownBed: boolean;
  atTable: boolean;
  roomTier: number;
  startedRest: number;
  /** A sit in the hearth hall taken at `LEISURE_MARK`, before work. Absent on every other plan. */
  hall?: true;
}

export interface DwarvesStateV1 {
  stateVersion: 1;
  titles: Record<TitleName, EntityId>;
  populationCached: number;
  children: EntityId[];
  rng: RngState;
  /**
   * The idle anchor while there is no hearth hall: the wagon tile of the arrival (`creature-brains.md`
   * `goal = hearthHallTile(id) or wagonTile`; D-057). -1 when there was no arrival.
   */
  wagonTile: TileIndex;
  /** Dwarf ids whose next selection must reconsider needs (T-M4-06 consumes the flag). */
  interruptFlags: EntityId[];
  hungerMaxSince: [EntityId, number][];
  thirstMaxSince: [EntityId, number][];
  starvingAnnounced: [EntityId, number][];
  activities?: [EntityId, ActivityPlan][];
  idleAnnounced?: EntityId[];
  /** T-M5-07: each dwarf remembers individual masterwork items seen on room entry. */
  sawMasterworks?: [EntityId, EntityId][];
  needRetryUntil?: [EntityId, NeedName, number][];
  shutOut?: EntityId[];
  shelterCheckPending?: boolean;
  threatened?: [EntityId, { hostileId: EntityId; tick: number; tile?: TileIndex }][];
  /** Talks in passing: the two dwarves, lower id first, and the tick the talk ends. Absent means none. */
  talks?: [EntityId, EntityId, number][];
  /** Ticks of eating, drinking and sitting in the hearth hall counted toward the next hearth visit. Absent means none. */
  hearthTicks?: [EntityId, number][];
  /** Per dwarf, the tick before which it takes no hall errand before work. Absent means none. */
  hallRetryUntil?: [EntityId, number][];
}
