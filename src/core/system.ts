/**
 * The system contract.
 *
 * Implements `01-architecture/module-interfaces.md` § The system contract, in full, § Registration
 * APIs and § The spawn API. The APIs that belong to later milestones (`TerrainApi` is core in M0,
 * `JobsApi` arrives with 11 in M1, `SpawnApi` with T-M1-11) are declared here so the contract is
 * complete, with M0 implementations that either work or say plainly that they do not exist yet.
 * See DECISIONS.md D-017.
 */

import type { Command, CommandResult } from './commands';
import type { CommandType } from './command-types';
import type { EventType } from './event-types';
import type { GameEvent } from './events';
import type { Registry } from './registry';
import type { RngStream } from './rng';
import type { EntityId, MovementClass, TileIndex } from './types';
import type { Designation, Map3D, TileFlag, TileKind } from './map3d';
import type { EntityStore } from './entities';
import type { CalendarReader, EntityReader, FortressReader, MapReader, PathingReader, SpatialReader } from './readers';
import type { FortressState } from './components';

/** A system number from `02-systems/README.md` (`'03'`, `'21'`), or `'core'`. */
export type SystemId = string;

/** `data-model.md` § Terrain API: ordinary calls that validate and mutate immediately. */
export interface TerrainApi {
  setKind(i: TileIndex, kind: TileKind, material: number): void;
  setFlag(i: TileIndex, flag: TileFlag, value: boolean): void;
  setDesignation(i: TileIndex, kind: Designation, priority: number): void;
  /** `03` § Interfaces › Terrain API. Optional so the M0 core implementation stays minimal. */
  clearDesignation?(i: TileIndex): void;
  /**
   * 14 tells 03 which item a construction on a tile was built from, so `remove` and a collapse
   * return that item (`03` § Tile transitions, § Support and collapse; D-050, T-M2-05). Optional:
   * without it 03 returns by material class.
   */
  setConstructionItemSource?(source: ((tile: TileIndex) => string | null) | null): void;
  /**
   * Emit the tick's batched events (`TilesChanged`, and 03's `TilesDiscovered`). The world calls
   * this once after step 2 of the tick (`tick-order.md`), so tiles changed by any system through
   * the API land in the same tick's batch.
   */
  flush?(emit: (event: GameEvent) => void): void;
}

/** `11 jobs`. The real implementation arrives with T-M1-08 (`src/systems/jobs`). */
export interface JobsApi {
  create(key: string, spec: Readonly<Record<string, unknown>>): number;
  cancel(jobId: number, reason: string): void;
  exists(key: string): boolean;
  /**
   * The worker side (`11` § Assignment, § Job steps): 10 queues a worker during behavior selection
   * (`jobs.assign(id)`); 11 answers in its own tick of the same tick, in id order.
   */
  assign(workerId: EntityId): void;
  /** True while a worker waits in the assignment queue. */
  isQueued(workerId: EntityId): boolean;
  /** `jobs.stepWorker(id, ctx)`, called by 10 every tick for a dwarf in `work` behavior. */
  stepWorker(workerId: EntityId, ctx: TickContext): void;
  /** Interruption: the job returns to `open`, keeping its progress when `keepProgress`. */
  interrupt(workerId: EntityId, keepProgress: boolean): void;
  /** `SetBuildingPriority` and friends: a job's priority (11's sink). */
  setPriority?(jobId: number, priority: number): void;
}

/**
 * The movement helper as the brains see it (`module-interfaces.md` § The movement helper,
 * `22` § Core API). The host installs the core helper; DECISIONS.md D-049.
 */
export interface MovementApi {
  moveAlongPath(id: EntityId, ctx: { readonly tick: number; emit(event: GameEvent): void }): string;
  teleport(id: EntityId, to: TileIndex): boolean;
  fall(id: EntityId, ctx: { readonly tick: number; emit(event: GameEvent): void }): string;
  /** Point the mover at a finished path request (`Motion.pathId`), from its first step. */
  follow(id: EntityId, pathId: number): void;
  /** Drop the mover's path. */
  clearPath(id: EntityId): void;
  /** `pathing.setSpeed`: the owning brain writes `Motion.speed` (`components.md`, ownership table). */
  setSpeed(id: EntityId, speed: number): void;
  /** The tile an entity stands on, or -1. */
  tileOf(id: EntityId): TileIndex;
  /**
   * Walk toward a tile: request, follow, re-request (`jobs-and-hauling.md` `walkTo`).
   * `pending` while the path is being found, `moving`, `arrived`, or `unreachable`.
   */
  walkTo(
    id: EntityId,
    target: TileIndex,
    urgency: 'flee' | 'combat' | 'job' | 'need' | 'wander' | 'caravan',
    ctx: { readonly tick: number; emit(event: GameEvent): void },
  ): 'pending' | 'moving' | 'arrived' | 'unreachable';
  /** Forget a mover's walk and drop its path. */
  stopWalking(id: EntityId): void;
  /** The target of a mover's current walk, or -1. */
  walkTarget(id: EntityId): TileIndex;
}

/**
 * The mutation services a tick context carries. The world starts with the M0 implementations
 * (the core terrain API and the stubs of D-017); the systems and the host that own the real ones
 * install them before the first tick (03 the terrain API, 11 the jobs API, the host the spawn API
 * and the movement helper). DECISIONS.md D-049.
 */
export interface CoreServices {
  terrain: TerrainApi;
  jobs: JobsApi;
  spawn: SpawnApi;
  movement: MovementApi | null;
  /** 13's item API, installed by 13 at `init` (T-M2-01, D-068); null without an item system. */
  items: ItemsApi | null;
  /** The write side of the spatial index, installed by the host (T-M2-01, D-068). */
  spatial: SpatialWriter | null;
}

/**
 * The write side of the spatial index (`22` § Spatial index): 13 places, lifts and moves the items
 * it owns; creatures move through the movement helper. D-068.
 */
export interface SpatialWriter {
  insert(id: EntityId, tile: TileIndex): void;
  remove(id: EntityId, tile: TileIndex): void;
  move(id: EntityId, from: TileIndex, to: TileIndex): void;
}

/**
 * `13-items-and-storage.md` § Interfaces › Item API (mutation, called by 11, 12, 10, 14, 16, 20).
 * `reserve` / `release` are the two halves of "`items.setFlag(it, Reserved, …)`;
 * `Item[it].reservedBy = job.id`" of `algorithms/jobs-and-hauling.md` § Assignment.
 */
export interface ItemsApi {
  attachToCarrier(itemId: EntityId, carrierId: EntityId): void;
  dropAt(itemId: EntityId, tile: TileIndex): void;
  /** False when the container has no room. */
  putIn(itemId: EntityId, containerId: EntityId): boolean;
  takeOut(itemId: EntityId): void;
  /** Split `count` off a stack; the new stack's id. */
  split(itemId: EntityId, count: number): EntityId;
  /** Merge stack `b` into `a` when identical and within the stack size; true when merged. */
  merge(a: EntityId, b: EntityId): boolean;
  consume(itemId: EntityId, count: number): void;
  destroy(itemId: EntityId, reason: string): void;
  setFlag(itemId: EntityId, flag: number, on: boolean): void;
  setOwner(itemId: EntityId, dwarfId: EntityId): void;
  reserve(itemId: EntityId, jobId: number): void;
  release(itemId: EntityId): void;
  /** Link an item to a built piece of furniture (14 § Placement: "the furniture item is *linked*"): off the map, `Installed`. D-074. */
  install?(itemId: EntityId): void;
  /** The furniture is deconstructed: the linked item returns, on the ground at `tile`. D-074. */
  uninstall?(itemId: EntityId, tile: TileIndex): void;
}

/** `module-interfaces.md` § The spawn API. The real implementation arrives with T-M1-11. */
export interface SpawnApi {
  creature(
    species: number,
    at: TileIndex,
    faction: string,
    overrides?: Readonly<Record<string, unknown>>,
  ): EntityId;
  item(
    type: number,
    material: number,
    at: TileIndex | { containerId: EntityId },
    count?: number,
    quality?: number,
  ): EntityId;
  /** 13 installs the real item creator at `init` (T-M2-01, D-068). */
  setItemCreator?(creator: ItemCreator | null): void;
}

/** What `spawn.item` delegates to once 13 exists. */
export type ItemCreator = (
  type: number,
  material: number,
  at: TileIndex | { containerId: EntityId },
  count: number,
  quality: number,
) => EntityId;

// ---------- registration ----------

export interface JobProducer {
  readonly id: string;
  produce(ctx: TickContext, sink: unknown): void;
  onJobEvent?(event: GameEvent): void;
  /**
   * `algorithms/jobs-and-hauling.md` § Job steps, `completing`: "producer(job).onComplete(job, ctx)
   * (spawns outputs, applies tile changes, consumes inputs)". The job record is 11's.
   */
  onComplete?(job: unknown, ctx: TickContext): void;
  /** The work time of a job in hundredths of a tick, when the producer computes it (`jobs.md`). */
  workCentiTicks?(job: unknown): number | undefined;
  /** Stand tiles a job allows besides the `adjacent` 8-neighbours (D-058). */
  extraStandTiles?(job: unknown): readonly TileIndex[];
  /**
   * False while the finished work may not complete yet (14: "Constructions that become walls check
   * that no creature is on the tile (the job waits otherwise)"). T-M2-05.
   */
  canComplete?(job: unknown): boolean;
}

export interface RecipeSet {
  readonly id: string;
  readonly recipes: readonly unknown[];
}

export interface ThoughtSource {
  readonly on: readonly EventType[];
  trigger(event: GameEvent, ctx: TickContext): readonly unknown[];
}

export interface OverlaySpec {
  readonly id: string;
  readonly label: string;
  readonly defaultOn: boolean;
}

export interface PanelSpec {
  readonly id: string;
  readonly title: string;
  readonly hotkey: string;
}

export type EntityKindOrTile = 'tile' | 'creature' | 'item' | 'building' | 'zone';

export interface InspectorSection {
  readonly id: string;
  readonly order: number;
}

export interface MilestoneSpec {
  readonly id: string;
  readonly trigger: string;
}

/**
 * `module-interfaces.md` § Announcements, as data: the severity and the strings-table key whose
 * `{placeholders}` 24 fills from the event and readers; the focus is the event's `tile` (or its
 * first `tiles` entry). `once`: only the first occurrence is announced (03's `DeepsilverMined`).
 * DECISIONS.md D-065.
 */
export interface AnnouncementSpec {
  readonly severity: 'note' | 'alert' | 'danger';
  readonly stringKey: string;
  readonly once?: boolean;
}

/**
 * `module-interfaces.md` § Registration APIs. Registration is a static declaration of intent, so
 * the order in which systems `init` does not matter; the target systems read these registries
 * lazily on their first `tick`.
 */
export interface RegistrationApi {
  jobProducer(producer: JobProducer): void;
  recipeSet(set: RecipeSet): void;
  thoughtSource(source: ThoughtSource): void;
  overlay(overlay: OverlaySpec): void;
  panel(panel: PanelSpec): void;
  inspector(kind: EntityKindOrTile, section: InspectorSection): void;
  milestone(milestone: MilestoneSpec): void;
  announcement(type: EventType, spec: AnnouncementSpec): void;
}

/** The collected registrations, readable by the systems that own each table. */
export class Registrations implements RegistrationApi {
  readonly jobProducers: JobProducer[] = [];
  readonly recipeSets: RecipeSet[] = [];
  readonly thoughtSources: ThoughtSource[] = [];
  readonly overlays: OverlaySpec[] = [];
  readonly panels: PanelSpec[] = [];
  readonly inspectors: { kind: EntityKindOrTile; section: InspectorSection }[] = [];
  readonly milestones: MilestoneSpec[] = [];
  readonly announcements: { type: EventType; spec: AnnouncementSpec }[] = [];

  jobProducer(producer: JobProducer): void {
    this.jobProducers.push(producer);
  }

  recipeSet(set: RecipeSet): void {
    this.recipeSets.push(set);
  }

  thoughtSource(source: ThoughtSource): void {
    this.thoughtSources.push(source);
  }

  overlay(overlay: OverlaySpec): void {
    this.overlays.push(overlay);
  }

  panel(panel: PanelSpec): void {
    this.panels.push(panel);
  }

  inspector(kind: EntityKindOrTile, section: InspectorSection): void {
    this.inspectors.push({ kind, section });
  }

  milestone(milestone: MilestoneSpec): void {
    this.milestones.push(milestone);
  }

  announcement(type: EventType, spec: AnnouncementSpec): void {
    this.announcements.push({ type, spec });
  }

  clear(): void {
    this.jobProducers.length = 0;
    this.recipeSets.length = 0;
    this.thoughtSources.length = 0;
    this.overlays.length = 0;
    this.panels.length = 0;
    this.inspectors.length = 0;
    this.milestones.length = 0;
    this.announcements.length = 0;
  }
}

// ---------- contexts ----------

/** Set by the app (`platform`) so that `core` never reads a wall clock itself. */
export type Clock = () => number;

export interface InitContext {
  /** `World`, but typed structurally so `system.ts` does not depend on `world.ts`. */
  readonly world: WorldLike;
  readonly registry: Registry;
  /** This system's persistent stream. */
  readonly rng: RngStream;
  readonly readers: ReaderSetLike;
  readonly register: RegistrationApi;
}

export interface TickContext extends InitContext {
  readonly tick: number;
  emit(event: GameEvent): void;
  readonly terrain: TerrainApi;
  readonly jobs: JobsApi;
  readonly spawn: SpawnApi;
}

/** Structural view of the world, so the contract has no import cycle with `world.ts`. */
export interface WorldLike {
  readonly seed: string;
  rngFor(systemId: SystemId): RngStream;
  /** The installable mutation services (D-049). */
  readonly services: CoreServices;
  /** The grids. Only 03 writes `kind` and `material`; the others go through the terrain API. */
  readonly map: Map3D;
  /** The entity store; each system writes only the components it owns (`components.md`). */
  readonly entities: EntityStore;
  /** `World.fortress` (`data-model.md` § Fortress-level state). */
  readonly fortress: FortressState;
  /** The calendar's current tick. */
  readonly calendar: { readonly tick: number };
  /**
   * Queue an event, exactly as `ctx.emit` does. For services that are called from other systems'
   * ticks (the terrain API's collapse and breach events).
   */
  emit(event: GameEvent): void;
}

/** Structural view of the reader set. */
export interface ReaderSetLike {
  of<T>(systemId: SystemId): T;
  has(systemId: SystemId): boolean;
  /** The core readers of `module-interfaces.md` § Core readers. */
  readonly map: MapReader;
  readonly entities: EntityReader;
  readonly calendar: CalendarReader;
  readonly fortress: FortressReader;
  /** `readers.pathing` and `readers.spatial`, once the host has registered them. */
  readonly pathing: PathingReader;
  readonly spatial: SpatialReader;
}

export interface GameSystem<S = unknown> {
  readonly id: SystemId;
  readonly order: number;
  readonly cadence: number;
  readonly phase: number;
  readonly subscribes: readonly EventType[];
  readonly ownsCommands: readonly CommandType[];

  init(ctx: InitContext): void;
  tick(ctx: TickContext): void;
  handle(event: GameEvent, ctx: TickContext): void;
  applyCommand(cmd: Command, ctx: TickContext): CommandResult;
  /** Each system narrows this to its own reader type. */
  reader(): unknown;
  serialize(): S;
  deserialize(state: S, ctx: InitContext): void;
}

/** A base class with the no-op defaults, so a system only writes what it does. */
export abstract class BaseSystem<S = unknown> implements GameSystem<S> {
  abstract readonly id: SystemId;
  abstract readonly order: number;
  readonly cadence: number = 1;
  readonly phase: number = 0;
  readonly subscribes: readonly EventType[] = [];
  readonly ownsCommands: readonly CommandType[] = [];

  init(_ctx: InitContext): void {}
  tick(_ctx: TickContext): void {}
  handle(_event: GameEvent, _ctx: TickContext): void {}
  applyCommand(_cmd: Command, _ctx: TickContext): CommandResult {
    return { ok: false, reason: 'not_found' };
  }
  reader(): unknown {
    return {};
  }
  abstract serialize(): S;
  abstract deserialize(state: S, ctx: InitContext): void;
}

/** Thrown by the M0 stubs of the APIs that belong to later milestones. */
export class NotYetImplementedError extends Error {
  constructor(what: string, milestone: string) {
    super(`${what} arrives with ${milestone}`);
    this.name = 'NotYetImplementedError';
  }
}

export const NO_JOBS_API: JobsApi = Object.freeze({
  create(): number {
    throw new NotYetImplementedError('ctx.jobs.create', 'T-M1-08');
  },
  cancel(): void {
    throw new NotYetImplementedError('ctx.jobs.cancel', 'T-M1-08');
  },
  exists(): boolean {
    throw new NotYetImplementedError('ctx.jobs.exists', 'T-M1-08');
  },
  assign(): void {
    throw new NotYetImplementedError('ctx.jobs.assign', 'T-M1-08');
  },
  isQueued(): boolean {
    throw new NotYetImplementedError('ctx.jobs.isQueued', 'T-M1-08');
  },
  stepWorker(): void {
    throw new NotYetImplementedError('ctx.jobs.stepWorker', 'T-M1-08');
  },
  interrupt(): void {
    throw new NotYetImplementedError('ctx.jobs.interrupt', 'T-M1-08');
  },
});

export const NO_SPAWN_API: SpawnApi = Object.freeze({
  creature(): EntityId {
    throw new NotYetImplementedError('ctx.spawn.creature', 'T-M1-11');
  },
  item(): EntityId {
    throw new NotYetImplementedError('ctx.spawn.item', 'T-M1-11');
  },
});

/** Re-exported so systems can name the type without importing `types.ts` as well. */
export type { MovementClass };
