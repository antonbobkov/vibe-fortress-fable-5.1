/**
 * Saving and loading a running game.
 *
 * Implements `01-architecture/persistence.md` § What is saved and § Determinism and saves, and
 * `04-implementation/save-format.md` § Sections, § Serialization helpers and § Load procedure
 * steps 2 to 5: every section of a {@link HeadlessGame} is written in the documented order, and a
 * loaded game continues exactly as the uninterrupted one would (the save round-trip contract of
 * `simulation-core.md` § Determinism). The container itself is `save-manager.ts`'s.
 *
 * What is saved beyond the tables of `schemas/system-state.md` so that the contract holds is
 * listed in DECISIONS.md D-079 (slots and free list, pending events and commands, map size and
 * arrival), D-081 (22's requests, searches, walks and path cache) and D-082 (the load order).
 */

import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import type { ComponentType, EntityKind } from '@core/entities';
import { idsToStrings, referencedIds, stringsToIds } from '@core/id-fields';
import { Map3D } from '@core/map3d';
import type { MovementState } from '@core/movement';
import type { PathfinderState } from '@core/pathfinding';
import type { Command, CommandLogEntry } from '@core/commands';
import type { GameEvent } from '@core/events';
import type { RngState } from '@core/rng';
import type { Registry } from '@core/registry';
import type { FortressState } from '@core/components';
import type { ArrivalResult, LocalMapSpec } from '@systems/embark';
import type { WorldMap } from '@systems/worldgen';
import { HeadlessGame, FLAT_TEST_SPEC } from './headless';
import {
  checkContent,
  contentSourceOf,
  jsonSection,
  readJsonSection,
  readSave,
  readTypedSection,
  typedSection,
  writeSave,
  type ContentCheck,
  type LoadedSave,
  type SaveHeader,
  type SaveKind,
  type SaveSection,
  type SaveThumbnail,
} from './save-manager';
import type { Compressor } from '@platform/compress';

/** `save-format.md` § Header JSON: the game version a save names. */
export const GAME_VERSION = '0.2.0';

/** The id 22's saved state is filed under in the `systems` section. */
export const PATHING_ID = '22';

/** `schemas/system-state.md` `PathingState`, with what D-081 adds. */
export interface PathingStateV1 {
  readonly stateVersion: 1;
  readonly pathfinder: PathfinderState;
  readonly movement: MovementState;
}

/** The `world` section: `WorldMap`, the chosen `regionId`, the `LocalMapSpec` (and D-079's extras). */
export interface WorldSection {
  readonly worldMap: WorldMap | null;
  readonly regionId: number;
  readonly spec: LocalMapSpec;
  readonly mapSize: { readonly w: number; readonly h: number; readonly d: number };
  readonly arrival: ArrivalResult | null;
}

/** `EntityStoreState` of `schemas/system-state.md`, plus the free list (D-079). */
export interface EntityStoreState {
  readonly slots: { generation: number; alive: boolean; kind: EntityKind }[];
  readonly free: number[];
  /** Component tables by name (every table but `Position`), `[slot index, value]` ascending. */
  readonly components: Record<string, [number, unknown][]>;
  /** Per slot; `positionZ` is −1 for a slot without a `Position` (D-079). */
  readonly positionX: Int16Array;
  readonly positionY: Int16Array;
  readonly positionZ: Int8Array;
}

/** The `queues` section: what one tick left for the next (D-079). */
export interface QueuesSection {
  readonly events: GameEvent[];
  readonly commands: Command[];
}

export interface SaveOptions {
  readonly kind: SaveKind;
  /** The generated world of the running game, if any (`world` section). */
  readonly worldMap?: WorldMap | null;
  /** The `ui` section (`Game.uiSection()`); a headless save has none. */
  readonly ui?: SaveSection | null;
  readonly playTimeSeconds?: number;
  readonly thumbnail?: SaveThumbnail;
  readonly compress?: Compressor;
}

const GRIDS: readonly ('kind' | 'material' | 'fluid' | 'designation' | 'flags' | 'tempOverride')[] = [
  'kind',
  'material',
  'fluid',
  'designation',
  'flags',
  'tempOverride',
];

/** The spec the game's terrain system holds (the flat-test spec for the fixture map). */
function specOf(game: HeadlessGame): LocalMapSpec {
  const terrain = game.terrain;
  if (terrain === null) return FLAT_TEST_SPEC;
  return (terrain.reader().spec() ?? FLAT_TEST_SPEC) as LocalMapSpec;
}

function entitiesSection(game: HeadlessGame): EntityStoreState {
  const store = game.world.entities;
  const registry = game.registry;
  const { slots, free } = store.exportSlots();
  const n = slots.length;
  const positionX = new Int16Array(n);
  const positionY = new Int16Array(n);
  const positionZ = new Int8Array(n).fill(-1);
  const components: Record<string, [number, unknown][]> = {};
  const types = store.componentTypes();
  for (let t = 0; t < types.length; t += 1) {
    const type = types[t] as ComponentType<unknown>;
    const table = store.store(type);
    const indices = table.indices();
    if (type === C.Position) {
      for (let k = 0; k < indices.length; k += 1) {
        const index = indices[k] as number;
        const p = table.get(index) as { x: number; y: number; z: number };
        positionX[index] = p.x;
        positionY[index] = p.y;
        positionZ[index] = p.z;
      }
      continue;
    }
    if (indices.length === 0) continue;
    const rows: [number, unknown][] = [];
    for (let k = 0; k < indices.length; k += 1) {
      const index = indices[k] as number;
      rows.push([index, idsToStrings(type.name, table.get(index), registry)]);
    }
    components[type.name] = rows;
  }
  return { slots, free, components, positionX, positionY, positionZ };
}

/** Every section of `save-format.md` § Sections for a running game, in the documented order. */
export function gameSections(game: HeadlessGame, options: Pick<SaveOptions, 'worldMap' | 'ui'> = {}): SaveSection[] {
  const world = game.world;
  const map = game.map;
  const spec = specOf(game);
  const sections: SaveSection[] = [];
  const worldSection: WorldSection = {
    worldMap: options.worldMap ?? null,
    regionId: spec.regionId,
    spec,
    mapSize: { w: map.w, h: map.h, d: map.d },
    arrival: game.arrival,
  };
  sections.push(jsonSection('world', worldSection));
  for (const grid of GRIDS) sections.push(typedSection(`map.${grid}`, map[grid]));
  sections.push(jsonSection('map.buildingAt', map.buildingEntries()));
  const fluidCounts = new Uint16Array(map.chunkCount);
  for (let c = 0; c < map.chunkCount; c += 1) fluidCounts[c] = map.chunk(c)?.activeFluidCount ?? 0;
  sections.push(typedSection('map.chunkFluidCounts', fluidCounts));
  sections.push(jsonSection('entities', entitiesSection(game)));
  sections.push(jsonSection('fortress', world.fortress));
  sections.push(jsonSection('calendar', { tick: world.calendar.tick, isDaylight: world.calendar.isDaylight }));
  const rng: Record<string, [number, number, number, number]> = {};
  for (const { id, state } of world.rngState()) rng[id] = [state.s0, state.s1, state.s2, state.s3];
  sections.push(jsonSection('rng', rng));
  const systems: Record<string, { stateVersion: number; state: unknown }> = {};
  for (const system of world.scheduler.inOrder()) {
    const state = system.serialize() as { stateVersion?: number } | null;
    systems[system.id] = { stateVersion: state?.stateVersion ?? 1, state };
  }
  const pathing: PathingStateV1 = {
    stateVersion: 1,
    pathfinder: game.pathing.pathfinder.saveState(),
    movement: game.movement.saveState(),
  };
  systems[PATHING_ID] = { stateVersion: 1, state: pathing };
  sections.push(jsonSection('systems', systems));
  sections.push(jsonSection('commandLog', world.commandLog.serialize()));
  const queues: QueuesSection = { events: world.events.peek().slice(), commands: world.commands.peek().slice() };
  sections.push(jsonSection('queues', queues));
  if (options.ui) sections.push(options.ui);
  return sections;
}

/** `save-format.md` § Header JSON for a running game. */
export function gameHeader(
  game: HeadlessGame,
  kind: SaveKind,
  extras: { playTimeSeconds?: number; thumbnail?: SaveThumbnail } = {},
): Omit<SaveHeader, 'formatVersion' | 'compressed'> {
  const world = game.world;
  const calendar = world.calendar;
  const population = world.entities
    .with(C.Labors)
    .filter((id) => world.entities.get(id, C.Creature)?.faction === 'fortress').length;
  return {
    gameVersion: GAME_VERSION,
    seed: world.seed,
    fortress: world.fortress.name,
    calendar: { tick: calendar.tick, year: calendar.year, season: calendar.season, day: calendar.dayOfSeason },
    contentHash: game.registry.contentHash,
    population,
    wealth: world.fortress.wealthCached,
    playTimeSeconds: Math.trunc(extras.playTimeSeconds ?? 0),
    ...(extras.thumbnail === undefined ? {} : { thumbnail: extras.thumbnail }),
    kind,
  };
}

/** Write a running game as a save container (`persistence.md` § Container format). */
export async function saveGame(game: HeadlessGame, options: SaveOptions): Promise<Uint8Array> {
  const sections = gameSections(game, options);
  const header = gameHeader(game, options.kind, {
    ...(options.playTimeSeconds === undefined ? {} : { playTimeSeconds: options.playTimeSeconds }),
    ...(options.thumbnail === undefined ? {} : { thumbnail: options.thumbnail }),
  });
  return options.compress === undefined ? writeSave(header, sections) : writeSave(header, sections, options.compress);
}

/** Refused by the load procedure; the message names what failed (`persistence.md` § Failure handling). */
export class SaveLoadError extends Error {
  readonly section: string;
  readonly missing: readonly string[];

  constructor(section: string, message: string, missing: readonly string[] = []) {
    super(message);
    this.name = 'SaveLoadError';
    this.section = section;
    this.missing = missing;
  }
}

export interface LoadedGame {
  readonly game: HeadlessGame;
  readonly header: SaveHeader;
  /** The generated world the game belongs to, if any. */
  readonly worldMap: WorldMap | null;
  /** The saved `UiState`, or null. */
  readonly ui: unknown;
  readonly content: ContentCheck;
}

function json<T>(save: LoadedSave, name: string): T {
  const section = save.section(name);
  if (section === undefined) throw new SaveLoadError(name, `the save has no ${name} section`);
  try {
    return readJsonSection(section) as T;
  } catch (error) {
    throw new SaveLoadError(name, `section ${name} is unreadable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function typed(save: LoadedSave, name: string): ArrayLike<number> {
  const section = save.section(name);
  if (section === undefined) throw new SaveLoadError(name, `the save has no ${name} section`);
  return readTypedSection(section);
}

/** Restore the entity store from its section (ids converted back through the registry). */
function restoreEntities(game: HeadlessGame, state: EntityStoreState): void {
  const store = game.world.entities;
  const registry = game.registry;
  store.importSlots(state.slots, state.free);
  const types = store.componentTypes();
  for (let t = 0; t < types.length; t += 1) {
    const type = types[t] as ComponentType<unknown>;
    const table = store.store(type);
    if (type === C.Position) {
      for (let index = 0; index < state.slots.length; index += 1) {
        const z = state.positionZ[index] as number;
        if (z < 0 || state.slots[index]?.alive !== true) continue;
        table.set(index, { x: state.positionX[index] as number, y: state.positionY[index] as number, z });
      }
      continue;
    }
    const rows = state.components[type.name];
    if (rows === undefined) continue;
    for (let k = 0; k < rows.length; k += 1) {
      const [index, value] = rows[k] as [number, unknown];
      table.set(index, stringsToIds(type.name, value, registry));
    }
  }
}

/**
 * `save-format.md` § Load procedure: read the container, check the content (the soft match over
 * the component id fields, D-026), build the world from the saved map, deserialize the core
 * sections and every system in order, then rebuild what is derived (D-082). The loaded game is
 * paused: nothing ticks until the caller steps it.
 */
export async function loadGame(
  blob: Uint8Array,
  options: { registry?: Registry; compress?: Compressor; now?: () => number } = {},
): Promise<LoadedGame> {
  const save = options.compress === undefined ? await readSave(blob) : await readSave(blob, options.compress);
  return restoreGame(save, options.registry, options.now);
}

/**
 * `persistence.md` § Export and import: "Import reads a file, validates magic and version, checks
 * the content hash (soft match rules in `content-pipeline.md`)". Throws a {@link SaveLoadError}
 * naming what failed; returns the header of a save that may be stored.
 */
export async function validateImport(blob: Uint8Array, registry: Registry = contentRegistry()): Promise<SaveHeader> {
  const save = await readSave(blob);
  const entities = json<EntityStoreState>(save, 'entities');
  const tableHas = (table: string, id: string): boolean => registry.hasTable(table) && registry.table(table).has(id);
  const content = checkContent(save.header, contentSourceOf(registry), referencedIds(entities.components, tableHas));
  if (content.match === 'failed') {
    throw new SaveLoadError('header', `the save needs content that is missing: ${content.missing.join(', ')}`, content.missing);
  }
  return save.header;
}

/**
 * A save made of sections in memory, without the container (the scenarios and properties round
 * trip through it synchronously; the container is tested on its own).
 */
export function inMemorySave(header: SaveHeader, sections: readonly SaveSection[]): LoadedSave {
  const byName = new Map<string, SaveSection>();
  for (const section of sections) {
    byName.set(section.name, section);
    const at = section.name.indexOf(':');
    if (at >= 0) byName.set(section.name.slice(0, at), section);
  }
  return { header, sections, section: (name) => byName.get(name) };
}

/** Save and load synchronously, in memory: the same sections and the same restore as a file. */
export function roundTrip(game: HeadlessGame, options: Pick<SaveOptions, 'worldMap' | 'ui'> = {}): LoadedGame {
  const header: SaveHeader = { ...gameHeader(game, 'manual'), formatVersion: 1, compressed: false };
  return restoreGame(inMemorySave(header, gameSections(game, options)), game.registry);
}

/** `save-format.md` § Load procedure steps 2 to 6 over an opened save. */
export function restoreGame(save: LoadedSave, registryIn?: Registry, now?: () => number): LoadedGame {
  const registry = registryIn ?? contentRegistry();
  const header = save.header;

  // Step 2: the content hash, and on a mismatch the soft match over every referenced id.
  const entities = json<EntityStoreState>(save, 'entities');
  const tableHas = (table: string, id: string): boolean => registry.hasTable(table) && registry.table(table).has(id);
  const referenced = referencedIds(entities.components, tableHas);
  const content = checkContent(header, contentSourceOf(registry), referenced);
  if (content.match === 'failed') {
    throw new SaveLoadError('header', `the save needs content that is missing: ${content.missing.join(', ')}`, content.missing);
  }
  // Step 4: the world, from the saved map.
  const worldSection = json<WorldSection>(save, 'world');
  const size = worldSection.mapSize;
  const map = new Map3D(size.w, size.h, size.d);
  for (const grid of GRIDS) {
    const data = typed(save, `map.${grid}`);
    if (data.length !== map[grid].length) throw new SaveLoadError(`map.${grid}`, `map.${grid} has ${data.length} tiles, the map ${map[grid].length}`);
    (map[grid] as { set(a: ArrayLike<number>): void }).set(data);
  }
  for (const [tile, id] of json<[number, number][]>(save, 'map.buildingAt')) map.buildingAt.set(tile, id);
  const fluidCounts = typed(save, 'map.chunkFluidCounts');
  for (let c = 0; c < map.chunkCount; c += 1) {
    const rec = map.chunk(c);
    if (rec !== undefined) rec.activeFluidCount = fluidCounts[c] ?? 0;
  }

  const fortress = json<FortressState>(save, 'fortress');
  const game = new HeadlessGame({
    seed: header.seed,
    registry,
    map,
    spec: worldSection.spec,
    embark: 'none',
    fortressName: fortress.name,
    deferLabels: true,
    ...(now === undefined ? {} : { now }),
  });
  const world = game.world;

  restoreEntities(game, entities);
  const target = world.fortress as unknown as Record<string, unknown>;
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, fortress);
  const calendar = json<{ tick: number; isDaylight?: boolean }>(save, 'calendar');
  world.calendar.setTick(calendar.tick);
  if (calendar.isDaylight !== undefined) world.calendar.isDaylight = calendar.isDaylight;
  const rng = json<Record<string, [number, number, number, number]>>(save, 'rng');
  for (const id of Object.keys(rng).sort()) {
    const s = rng[id] as [number, number, number, number];
    const state: RngState = { s0: s[0], s1: s[1], s2: s[2], s3: s[3] };
    world.restoreRng(id, state);
  }
  const systems = json<Record<string, { stateVersion: number; state: unknown }>>(save, 'systems');
  world.deserializeSystems(systems);
  game.arrival = worldSection.arrival;

  // Step 5: rebuild-on-load. The spatial buckets from the positions; the labels over the restored
  // map and buildings; 22's requests, searches and walks as they were (D-081).
  game.spatial.rebuild();
  game.pathing.connectivity.rebuildAll();
  const pathing = systems[PATHING_ID]?.state as PathingStateV1 | undefined;
  if (pathing !== undefined) {
    game.pathing.pathfinder.loadState(pathing.pathfinder);
    game.movement.loadState(pathing.movement);
  }
  world.commandLog.deserialize(json<CommandLogEntry[]>(save, 'commandLog'));
  const queues = save.section('queues') === undefined ? { events: [], commands: [] } : json<QueuesSection>(save, 'queues');
  world.events.clear();
  for (const event of queues.events) world.events.emit(event);
  world.commands.clear();
  for (const command of queues.commands) world.commands.submit(command);

  // Step 6: the `UiState`, for the app to restore.
  const ui = save.section('ui') === undefined ? null : json<unknown>(save, 'ui');
  return { game, header, worldMap: worldSection.worldMap, ui, content };
}
