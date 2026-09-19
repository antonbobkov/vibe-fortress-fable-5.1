/**
 * `TestWorld`: the scenario-facing wrapper of `01-testing-strategy.md` § The scenario runner.
 *
 * It calls only public APIs of the headless game. Helpers whose subsystem has not been built yet
 * throw `NotYetImplementedError` naming the task that provides them, the same way the M0 stubs of
 * `ctx.jobs` and `ctx.spawn` do (DECISIONS.md D-017), so a scenario that reaches for one fails
 * loudly instead of quietly doing nothing.
 */

import { HeadlessGame, type HeadlessOptions } from '@app/headless';
import type { BuildingsSystem } from '@systems/buildings';
import type { ItemsSystem } from '@systems/items';
import type { FluidsSystem } from '@systems/fluids';
import type { MaterialsSystem } from '@systems/materials';
import { NotYetImplementedError } from '@core/system';
import { C } from '@core/components';
import { cumulativeXp } from '@systems/dwarves/rules/skills';
import { dwarfComponents } from '@systems/dwarves/rules/components';
import { makeDwarf } from '@systems/dwarves/rules/make-dwarf';
import { ADULT_AGE_YEARS } from '@systems/dwarves/constants';
import { TICKS_PER_YEAR } from '@core/constants';
import { TileFlag, TileKind, type Map3D } from '@core/map3d';
import type { Command } from '@core/commands';
import type { GameEvent } from '@core/events';
import type { EventType } from '@core/event-types';
import type { EntityId, MovementClass, TileIndex } from '@core/types';

export class TestWorld {
  readonly game: HeadlessGame;
  private readonly seen: GameEvent[] = [];
  /** Tiles a building blocks; the M2 hook of `22` § Passability, driven by the scenario. */
  private readonly blocking = new Set<TileIndex>();
  /** Tiles a door stands on. */
  private readonly doors = new Set<TileIndex>();

  constructor(options: HeadlessOptions) {
    this.game = new HeadlessGame({
      ...options,
      hooks: {
        blocksMovementAt: (i) => this.blocking.has(i),
        doorAt: (i) => this.doors.has(i),
        ...(options.hooks ?? {}),
      },
    });
    this.game.world.onEvents((batch) => {
      for (let k = 0; k < batch.length; k += 1) this.seen.push(batch[k] as GameEvent);
    });
  }

  get map(): Map3D {
    return this.game.map;
  }

  get readers(): HeadlessGame['world']['readers'] {
    return this.game.world.readers;
  }

  get pathing(): HeadlessGame['pathing'] {
    return this.game.pathing;
  }

  get spatial(): HeadlessGame['spatial'] {
    return this.game.spatial;
  }

  get movement(): HeadlessGame['movement'] {
    return this.game.movement;
  }

  get tick(): number {
    return this.game.tick;
  }

  index(x: number, y: number, z: number): TileIndex {
    return this.map.index(x, y, z);
  }

  // ---------- driving ----------

  step(n = 1): void {
    this.game.step(n);
  }

  /** Step until the predicate holds, at most `maxTicks` times. Returns the ticks spent. */
  until(predicate: (w: TestWorld) => boolean, maxTicks: number): number {
    let spent = 0;
    while (spent < maxTicks) {
      if (predicate(this)) return spent;
      this.step(1);
      spent += 1;
    }
    if (!predicate(this)) throw new Error(`until: the predicate did not hold within ${maxTicks} ticks`);
    return spent;
  }

  submit(command: Command): void {
    this.game.world.submit(command);
  }

  /** Every event of a type seen since tick 0. */
  events(type: EventType): readonly GameEvent[] {
    return this.seen.filter((event) => event.type === type);
  }

  /** Every event seen since tick 0, in order. */
  allEvents(): readonly GameEvent[] {
    return this.seen;
  }

  hash(): string {
    return this.game.hash();
  }

  // ---------- setup helpers that M0 can honour ----------

  /** Turn a solid box into floor, the shape a finished dig leaves behind. */
  digRoom(x: number, y: number, z: number, w: number, h: number): void {
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) {
        const i = this.map.index(x + dx, y + dy, z);
        this.map.setKind(i, TileKind.Floor, this.map.materialAt(i));
      }
    }
  }

  /** Lay floor over open space, the shape a built floor construction leaves behind. */
  placeFloorSlab(x: number, y: number, z: number, w: number, h: number, material = 1): void {
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) {
        this.map.setKind(this.map.index(x + dx, y + dy, z), TileKind.Floor, material);
      }
    }
  }

  /**
   * Mark a tile discovered, the state 03 terrain gives a tile the dwarves have opened
   * (`03-terrain-and-mining.md` § Discovery, T-M1-07). Until that system exists the render
   * scenarios set the flag themselves, through the map's public API.
   */
  discover(i: TileIndex, value = true): void {
    this.map.setFlag(i, TileFlag.Discovered, value);
  }

  /** Set one tile's kind, keeping its material unless one is given. */
  carve(i: TileIndex, kind: TileKind, material?: number): void {
    this.map.setKind(i, kind, material ?? this.map.materialAt(i));
  }

  /** Stand a blocking building on a tile, or take it away; dirties the chunk as 14 would. */
  setBuildingBlock(i: TileIndex, blocked: boolean): void {
    if (blocked) this.blocking.add(i);
    else this.blocking.delete(i);
    this.map.markChunkDirty(i, true, true);
  }

  /** Put a door on a tile, or take it away. */
  setDoor(i: TileIndex, isDoor: boolean): void {
    if (isDoor) this.doors.add(i);
    else this.doors.delete(i);
    this.map.markChunkDirty(i, true, true);
  }

  /** `readers.pathing.reachable` through the labels the world rebuilt at the last tick end. */
  reachable(from: TileIndex, to: TileIndex, movementClass: MovementClass = 'walker'): boolean {
    return this.game.pathing.connectivity.reachable(from, to, movementClass);
  }

  /** A complete search, for the scenarios that only ask whether a route exists. */
  findPath(
    from: TileIndex,
    to: TileIndex,
    movementClass: MovementClass = 'walker',
  ): readonly TileIndex[] | null {
    return this.game.pathing.pathfinder.searchImmediate(from, to, movementClass);
  }

  // ---------- helpers whose subsystem arrives later ----------

  /**
   * `spawnDwarf(opts)`: a new dwarf from `makeDwarf` (this world's own `testworld` stream), through
   * the spawn API, on `at` (the first surface floor of column (48, 48) by default). T-M1-11.
   */
  spawnDwarf(opts: { at?: TileIndex; skills?: Record<string, number>; name?: string; ageYears?: number } = {}): EntityId {
    const game = this.game;
    const registry = game.registry;
    const taken = new Set<string>();
    for (const id of game.world.entities.with(C.Brain, C.Creature)) taken.add(game.world.entities.get(id, C.Creature)?.name ?? '');
    const record = makeDwarf(game.world.rngFor('testworld'), registry, { taken, skills: opts.skills ?? {} });
    if (opts.name !== undefined) record.name = opts.name;
    if (opts.ageYears !== undefined) record.ageYears = opts.ageYears;
    const at = opts.at ?? this.map.index(48, 48, this.map.columnSurfaceZ(48, 48));
    return game.world.services.spawn.creature(registry.table('creatures').index('dwarf'), at, 'fortress', {
      name: record.name,
      sex: record.sex,
      ageTicks: record.ageYears * TICKS_PER_YEAR,
      child: record.ageYears < ADULT_AGE_YEARS,
      dwarf: dwarfComponents(record, registry, game.world.rngFor('10'), 'none'),
    });
  }

  /** `spawnCreature(species, at, faction)` through the spawn API. T-M1-11. */
  spawnCreature(species: string, at: TileIndex, faction: string): EntityId {
    return this.game.world.services.spawn.creature(this.game.registry.table('creatures').index(species), at, faction);
  }

  /**
   * `spawnItem(type, material, at, count)` through the spawn API (T-M2-01): content ids or registry
   * indices; `at` a tile or `{ containerId }`. Returns the (first) item id.
   */
  spawnItem(
    type: string | number,
    material: string | number,
    at: TileIndex | { containerId: EntityId },
    count = 1,
    quality = 1,
  ): EntityId {
    const registry = this.game.registry;
    const t = typeof type === 'number' ? type : registry.table('items').index(type);
    const m = typeof material === 'number' ? material : registry.table('materials').index(material);
    return this.game.world.services.spawn.item(t, m, at, count, quality);
  }

  /** 04 fluids (T-M3-01). */
  get fluids(): FluidsSystem {
    const system = this.game.world.scheduler.byId('04') as FluidsSystem | undefined;
    if (system === undefined) throw new Error('TestWorld.fluids: no fluid system in this world');
    return system;
  }

  /**
   * Put fluid on a tile through 04's `pour` (the level, the type, optionally the `source` bit), so the
   * simulation picks it up at its next step (T-M3-01).
   */
  setFluid(i: TileIndex, level: number, type: 'water' | 'magma' = 'water', source = false): void {
    this.fluids.sim.pour(i, level, type === 'magma', source);
  }

  /** Σ levels of the fluid of a type over the given tiles. */
  fluidSum(tiles: readonly TileIndex[], type: 'water' | 'magma' = 'water'): number {
    const sim = this.fluids.sim;
    let n = 0;
    for (const t of tiles) if (sim.level(t) > 0 && sim.isMagma(t) === (type === 'magma')) n += sim.level(t);
    return n;
  }

  /** The item API of 13 (`world.services.items`). */
  get items(): NonNullable<HeadlessGame['world']['services']['items']> {
    const api = this.game.world.services.items;
    if (api === null) throw new Error('TestWorld.items: no item system in this world');
    return api;
  }

  /**
   * `build(type, at, materialChoice)`: a `PlaceBuilding` applied now and completed at once through
   * the build job's completion path, for setup only (T-M2-05). A piece of furniture links `linked`
   * when given, else a fresh item of the material (T-M2-06). Returns the building's id.
   */
  build(type: string, at: TileIndex, materialChoice: string | number = 0, orientation = 0, linked: EntityId = 0): EntityId {
    const world = this.game.world;
    const r = world.applyCommand({ type: 'PlaceBuilding', buildingType: type, origin: at, orientation, materialChoice });
    if (!r.ok) throw new Error(`build(${type}): ${r.reason}`);
    const system = world.scheduler.byId('14') as BuildingsSystem;
    const id = system.lastPlacedBuilding;
    const m = typeof materialChoice === 'number' ? materialChoice : this.game.registry.table('materials').index(materialChoice);
    system.completeNow(id, m, linked);
    return id;
  }

  /**
   * `zone(type, tiles)`: a `CreateZone` applied now (T-M2-03); returns the new zone's id. A stockpile
   * gets 13's `Stockpile` component at once (it would otherwise arrive with the tick's `ZoneChanged`).
   */
  zone(type: string, tiles: readonly TileIndex[]): EntityId {
    const world = this.game.world;
    const r = world.applyCommand({ type: 'CreateZone', zoneType: type, tiles: [...tiles] });
    if (!r.ok) throw new Error(`zone(${type}): ${r.reason}`);
    const buildings = world.scheduler.byId('14') as BuildingsSystem;
    const id = buildings.lastCreatedZone;
    if (type === 'stockpile') (world.scheduler.byId('13') as ItemsSystem).stockpiles.ensure(id);
    return id;
  }

  setNeed(): never {
    throw new NotYetImplementedError('TestWorld.setNeed', 'T-M4-05');
  }

  /** Set a dwarf's skill level, with the cumulative xp of that level (T-M1-09). */
  setSkill(id: EntityId, skill: string, level: number): void {
    const entities = this.game.world.entities;
    const skills = entities.get(id, C.Skills);
    if (skills === undefined) throw new Error(`setSkill: ${id} has no Skills`);
    const s = this.game.registry.table('skills').index(skill);
    const levels = skills.level.slice();
    const xp = skills.xp.slice();
    levels[s] = level;
    xp[s] = cumulativeXp(level);
    entities.add(id, C.Skills, { ...skills, level: levels, xp });
  }

  forceWeather(): never {
    throw new NotYetImplementedError('TestWorld.forceWeather', 'T-M3-06');
  }

  /** 05 materials (T-M3-03). */
  get materials(): MaterialsSystem {
    const system = this.game.world.scheduler.byId('05') as MaterialsSystem | undefined;
    if (system === undefined) throw new Error('TestWorld.materials: no materials system in this world');
    return system;
  }

  /** `forceTemperature(tile, c)`: pin a tile's temperature in 05 (null releases it). D-093. */
  forceTemperature(tile: TileIndex, c: number | null): void {
    this.materials.forceTemperature(tile, c);
  }
}
