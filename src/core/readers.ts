/**
 * The reader set.
 *
 * Implements `01-architecture/module-interfaces.md` § Reader conventions and § Core readers.
 * A reader is an object of pure query functions; it never mutates and never returns mutable
 * internals.
 */

import { isSolidBottomed, type Designation, type Map3D, type TileKind } from './map3d';
import type { Calendar } from './calendar';
import type { ComponentType, EntityStore, EntityKind } from './entities';
import type { FortressState } from './components';
import type { ChunkIndex, EntityId, MovementClass, Season, TileIndex } from './types';

/** `readers.map`. */
export interface MapReader {
  readonly w: number;
  readonly h: number;
  readonly d: number;
  kindAt(i: TileIndex): TileKind;
  materialAt(i: TileIndex): number;
  flagsAt(i: TileIndex): number;
  designationAt(i: TileIndex): Designation;
  designationPriorityAt(i: TileIndex): number;
  fluidAt(i: TileIndex): number;
  fluidLevelAt(i: TileIndex): number;
  isWalkable(i: TileIndex, movementClass: MovementClass): boolean;
  isOutdoor(i: TileIndex): boolean;
  /** A fresh array of the six face neighbours that exist. */
  neighbors(i: TileIndex): TileIndex[];
  columnSurfaceZ(x: number, y: number): number;
  chunkOf(i: TileIndex): ChunkIndex;
  index(x: number, y: number, z: number): TileIndex;
  unpack(i: TileIndex): { x: number; y: number; z: number };
  inBounds(x: number, y: number, z: number): boolean;
  buildingAt(i: TileIndex): EntityId;
}

/** `readers.entities`. */
export interface EntityReader {
  get<T>(id: EntityId, component: ComponentType<T>): T | undefined;
  has<T>(id: EntityId, component: ComponentType<T>): boolean;
  alive(id: EntityId): boolean;
  kind(id: EntityId): EntityKind | undefined;
  each(kind: EntityKind, fn: (id: EntityId) => void): void;
  with(a: ComponentType<unknown>, b?: ComponentType<unknown>, c?: ComponentType<unknown>): EntityId[];
  /** Entities with a `Position` on tile `i`, through the spatial index. */
  at(i: TileIndex): readonly EntityId[];
  readonly count: number;
}

/** `readers.calendar`: the `Calendar` fields. */
export interface CalendarReader {
  readonly tick: number;
  readonly hour: number;
  readonly dayOfSeason: number;
  readonly season: Season;
  readonly seasonName: string;
  readonly year: number;
  readonly dayOfYear: number;
  readonly isDaylight: boolean;
}

/** `readers.fortress`: the fortress-level state. */
export interface FortressReader {
  readonly state: Readonly<FortressState>;
}

/** `readers.pathing`; the implementation is installed by 22 (T-M0-09). */
export interface PathingReader {
  reachable(from: TileIndex, to: TileIndex, movementClass: MovementClass): boolean;
  labelOf(i: TileIndex, movementClass: MovementClass): number;
}

/** `readers.spatial`; the implementation is installed by the spatial index (T-M0-09). */
export interface SpatialReader {
  inRadius(i: TileIndex, r: number, kind?: EntityKind): readonly EntityId[];
  inBox(from: TileIndex, to: TileIndex, kind?: EntityKind): readonly EntityId[];
  nearest(i: TileIndex, predicate: (id: EntityId) => boolean, maxRadius: number): EntityId;
}

/**
 * Walkability by tile kind alone. `22-pathfinding-and-spatial.md` adds fluid depth, buildings and
 * the movement classes; T-M0-09 installs that rule through {@link ReaderSet.setPassability}.
 */
export function defaultPassable(map: Map3D, i: TileIndex): boolean {
  return isSolidBottomed(map.kindAt(i));
}

export type PassabilityFn = (i: TileIndex, movementClass: MovementClass) => boolean;
export type TileEntitiesFn = (i: TileIndex) => readonly EntityId[];

const NO_ENTITIES: readonly EntityId[] = Object.freeze([]);

/**
 * Every system's reader plus the core readers. Core readers are properties; a system's reader is
 * registered at `init` under its system id and read with {@link of}.
 */
export class ReaderSet {
  readonly map: MapReader;
  readonly entities: EntityReader;
  readonly calendar: CalendarReader;
  readonly fortress: FortressReader;

  private readonly systemReaders = new Map<string, unknown>();
  private passability: PassabilityFn;
  private tileEntities: TileEntitiesFn = () => NO_ENTITIES;

  constructor(map: Map3D, entities: EntityStore, calendar: Calendar, fortress: FortressState) {
    this.passability = (i) => defaultPassable(map, i);
    // Bound closures, so the readers keep answering through whatever `setPassability` and
    // `setTileEntities` install later without aliasing `this`.
    const walkable: PassabilityFn = (i, mc) => this.passability(i, mc);
    const entitiesAt: TileEntitiesFn = (i) => this.tileEntities(i);

    this.map = {
      get w() {
        return map.w;
      },
      get h() {
        return map.h;
      },
      get d() {
        return map.d;
      },
      kindAt: (i) => map.kindAt(i),
      materialAt: (i) => map.materialAt(i),
      flagsAt: (i) => map.flagsAt(i),
      designationAt: (i) => map.designationAt(i),
      designationPriorityAt: (i) => map.designationPriorityAt(i),
      fluidAt: (i) => map.fluid[i] ?? 0,
      fluidLevelAt: (i) => map.fluidLevelAt(i),
      isWalkable: (i, movementClass) => walkable(i, movementClass),
      isOutdoor: (i) => map.hasFlag(i, 1 << 9),
      neighbors: (i) => map.neighbors6(i),
      columnSurfaceZ: (x, y) => map.columnSurfaceZ(x, y),
      chunkOf: (i) => map.chunkOf(i),
      index: (x, y, z) => map.index(x, y, z),
      unpack: (i) => map.unpack(i),
      inBounds: (x, y, z) => map.inBounds(x, y, z),
      buildingAt: (i) => map.buildingAtTile(i),
    };

    this.entities = {
      get: (id, component) => entities.get(id, component),
      has: (id, component) => entities.has(id, component),
      alive: (id) => entities.alive(id),
      kind: (id) => entities.kind(id),
      each: (kind, fn) => entities.each(kind, fn),
      with: (a, b, c) => entities.with(a, b, c),
      at: (i) => entitiesAt(i),
      get count() {
        return entities.count;
      },
    };

    this.calendar = {
      get tick() {
        return calendar.tick;
      },
      get hour() {
        return calendar.hour;
      },
      get dayOfSeason() {
        return calendar.dayOfSeason;
      },
      get season() {
        return calendar.season;
      },
      get seasonName() {
        return calendar.seasonName;
      },
      get year() {
        return calendar.year;
      },
      get dayOfYear() {
        return calendar.dayOfYear;
      },
      get isDaylight() {
        return calendar.isDaylight;
      },
    };

    this.fortress = {
      get state() {
        return fortress;
      },
    };
  }

  /** Installed by 22 at `init`; until then walkability is the tile kind alone. */
  setPassability(fn: PassabilityFn): void {
    this.passability = fn;
  }

  /** Installed by the spatial index at `init`; until then no tile reports entities. */
  setTileEntities(fn: TileEntitiesFn): void {
    this.tileEntities = fn;
  }

  register(systemId: string, reader: unknown): void {
    this.systemReaders.set(systemId, reader);
  }

  has(systemId: string): boolean {
    return this.systemReaders.has(systemId);
  }

  of<T>(systemId: string): T {
    const reader = this.systemReaders.get(systemId);
    if (reader === undefined) throw new RangeError(`no reader registered for system ${systemId}`);
    return reader as T;
  }

  /** `readers.pathing`, once 22 has registered it. */
  get pathing(): PathingReader {
    return this.of<PathingReader>('pathing');
  }

  /** `readers.spatial`, once the spatial index has registered it. */
  get spatial(): SpatialReader {
    return this.of<SpatialReader>('spatial');
  }

  ids(): readonly string[] {
    return Array.from(this.systemReaders.keys()).sort();
  }
}
