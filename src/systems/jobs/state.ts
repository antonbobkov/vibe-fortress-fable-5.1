/**
 * 11 jobs' saved state: `04-implementation/schemas/system-state.md` `JobsState` and `Job`, and
 * `02-systems/11-jobs-and-labor.md` § The job record, § State. Private to the system.
 */

import type { EntityId, Priority, Tick, TileIndex } from '@core/types';

export type JobState =
  | 'open'
  | 'claimed'
  | 'fetching'
  | 'travelling'
  | 'working'
  | 'completing'
  | 'blocked'
  | 'cancelled'
  | 'done';

export type TargetKind = 'tile' | 'entity' | 'building' | 'zone' | 'pair';

/** `schemas/system-state.md` `ItemFilter`. */
export interface ItemFilter {
  type?: number;
  /** Any of these item types (a superset: building inputs name alternatives; D-070). */
  types?: number[];
  /** Exactly this item (a superset: a haul job's one input; D-072). */
  itemId?: EntityId;
  category?: string;
  tag?: string;
  materialClass?: string;
  materialId?: number;
  /** One of several materials, retained through job reservation and save. */
  materialIds?: number[];
  minQuality?: number;
  edible?: boolean;
  drinkable?: boolean;
  emptyContainer?: string;
  excludeIds?: EntityId[];
  /** Marked item flag required by a workshop input (T-M5-06). */
  requiredFlags?: number;
}

export interface JobInput {
  filter: ItemFilter;
  count: number;
  wholeItem?: true;
  reserved: EntityId[];
  delivered: EntityId[];
}

export type Tool = 'pick' | 'axe' | 'ranged' | 'bucket';

export interface Job {
  id: number;
  key: string;
  /** Registry index of the job type (`jobTypes`). */
  type: number;
  producer: string;
  priority: Priority;
  target: { kind: TargetKind; ref: number; ref2?: number };
  workTile: TileIndex | 'adjacent' | 'at';
  inputs: JobInput[];
  tool: Tool | null;
  state: JobState;
  blockedReason: string | null;
  retryTick: Tick;
  workerId: EntityId;
  /** 0 … 1000 of the work step; kept on interruption. */
  progress: number;
  createdTick: Tick;
  claimedTick: Tick;
  /**
   * Producer data, plus 11's own: `effort` (work done, in skill-scaled hundredths of a tick
   * times percent; D-055), `standTile` (the chosen work tile), `toolToFetch`.
   */
  data: Record<string, unknown>;
}

export interface JobsStateV1 {
  stateVersion: 1;
  /** Ascending id. */
  jobs: Job[];
  nextJobId: number;
  /** Per labor registry index (index 0 unused), 1 … 9. */
  laborPriorities: number[];
  standingOrders: Record<string, boolean>;
  assignQueue: EntityId[];
  blockedRetryCursor: number;
  /** 11 has ticked once: its producers and 13's items are connected (D-082). */
  ticked?: boolean;
}
