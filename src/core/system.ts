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
import type { Designation, TileFlag, TileKind } from './map3d';

/** A system number from `02-systems/README.md` (`'03'`, `'21'`), or `'core'`. */
export type SystemId = string;

/** `data-model.md` § Terrain API: ordinary calls that validate and mutate immediately. */
export interface TerrainApi {
  setKind(i: TileIndex, kind: TileKind, material: number): void;
  setFlag(i: TileIndex, flag: TileFlag, value: boolean): void;
  setDesignation(i: TileIndex, kind: Designation, priority: number): void;
}

/** `11 jobs`. The real implementation arrives with T-M1-08. */
export interface JobsApi {
  create(key: string, spec: Readonly<Record<string, unknown>>): number;
  cancel(jobId: number, reason: string): void;
  exists(key: string): boolean;
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
}

// ---------- registration ----------

export interface JobProducer {
  readonly id: string;
  produce(ctx: TickContext, sink: unknown): void;
  onJobEvent?(event: GameEvent): void;
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

export interface AnnouncementSpec {
  readonly severity: 'note' | 'alert' | 'danger';
  readonly stringKey: string;
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
}

/** Structural view of the reader set. */
export interface ReaderSetLike {
  of<T>(systemId: SystemId): T;
  has(systemId: SystemId): boolean;
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
