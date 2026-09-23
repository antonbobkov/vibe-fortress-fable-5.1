/**
 * The producer side of 11: the `JobSink` a producer is handed each tick
 * (`module-interfaces.md` § JobProducer: "Producers are responsible for idempotence: they check
 * with `sink.exists(key)` before creating"), the job spec a producer writes, and the item seam.
 *
 * The item seam: jobs reserve inputs and fetch tools through 13's item search
 * (`algorithms/jobs-and-hauling.md` § Assignment, `findItems`, `findItem`), which arrives with
 * M2. Until then 11 uses {@link NO_ITEMS}: no input can be found, and the tool a job needs is taken
 * to be in hand, so digging works before items exist (DECISIONS.md D-054). The unit tests drive the
 * reservation and fetch logic with an in-memory stub of the same interface.
 */

import type { EntityId, Priority, TileIndex } from '@core/types';
import type { ItemFilter, Job, TargetKind, Tool } from './state';

/** What a producer asks for. `type` is a `jobTypes` id. */
export interface JobSpec {
  readonly type: string;
  readonly priority?: Priority | number;
  readonly target: { readonly kind: TargetKind; readonly ref: number; readonly ref2?: number };
  readonly workTile: TileIndex | 'adjacent' | 'at';
  readonly inputs?: readonly { readonly filter: ItemFilter; readonly count: number }[];
  readonly tool?: Tool | null;
  readonly data?: Readonly<Record<string, unknown>>;
}

/** The sink of `JobProducer.produce(ctx, sink)`. */
export interface JobSink {
  exists(key: string): boolean;
  /** Idempotent: an existing key returns the existing job's id. */
  create(key: string, spec: JobSpec): number;
  /** Cancel a job by key (the producer's target went away). */
  cancelKey(key: string, reason: string): void;
  cancel(jobId: number, reason: string): void;
  byKey(key: string): Readonly<Job> | undefined;
  setPriority(jobId: number, priority: Priority): void;
}

/** 13's item search and item handling, as 11 uses them. */
export interface ItemSource {
  /** `findItems(filter, n, from, cls, {reservable: true})`, nearest first. */
  findItems(filter: ItemFilter, n: number, from: TileIndex): EntityId[];
  /** Craft inputs count units even when several units share a stack. */
  findUnits?(filter: ItemFilter, n: number, from: TileIndex): EntityId[];
  /** A free tool of the kind (`tag: pick`, `axe`, …) near `from`, or 0. */
  findTool(tool: Tool, from: TileIndex): EntityId;
  /** The worker already carries the tool in the weapon slot. */
  hasTool(workerId: EntityId, tool: Tool): boolean;
  reserve(itemId: EntityId, jobId: number): void;
  release(itemId: EntityId): void;
  /** Where an item is (its container's tile when inside one), or -1. */
  tileOf(itemId: EntityId): TileIndex;
  pickUp(itemId: EntityId, workerId: EntityId): void;
  dropAt(itemId: EntityId, tile: TileIndex): void;
  equip(workerId: EntityId, itemId: EntityId): void;
}

/**
 * The item seam before 13 exists (D-054): nothing can be found, and the tool is in hand. Reserving,
 * moving and equipping are never reached.
 */
export const NO_ITEMS: ItemSource = Object.freeze({
  findItems: (): EntityId[] => [],
  findTool: (): EntityId => 0,
  hasTool: (): boolean => true,
  reserve: (): void => {},
  release: (): void => {},
  tileOf: (): TileIndex => -1,
  pickUp: (): void => {},
  dropAt: (): void => {},
  equip: (): void => {},
});
