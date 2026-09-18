/**
 * `TestWorld`: the scenario-facing wrapper of `01-testing-strategy.md` § The scenario runner.
 *
 * It calls only public APIs of the headless game. Helpers whose subsystem has not been built yet
 * throw `NotYetImplementedError` naming the task that provides them, the same way the M0 stubs of
 * `ctx.jobs` and `ctx.spawn` do (DECISIONS.md D-017), so a scenario that reaches for one fails
 * loudly instead of quietly doing nothing.
 */

import { HeadlessGame, type HeadlessOptions } from '@app/headless';
import { NotYetImplementedError } from '@core/system';
import { C } from '@core/components';
import { cumulativeXp } from '@systems/dwarves/rules/skills';
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

  spawnDwarf(): never {
    throw new NotYetImplementedError('TestWorld.spawnDwarf', 'T-M1-11');
  }

  spawnCreature(): never {
    throw new NotYetImplementedError('TestWorld.spawnCreature', 'T-M1-11');
  }

  spawnItem(): never {
    throw new NotYetImplementedError('TestWorld.spawnItem', 'T-M2-01');
  }

  build(): never {
    throw new NotYetImplementedError('TestWorld.build', 'T-M2-05');
  }

  zone(): never {
    throw new NotYetImplementedError('TestWorld.zone', 'T-M2-03');
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

  forceTemperature(): never {
    throw new NotYetImplementedError('TestWorld.forceTemperature', 'T-M3-03');
  }
}
