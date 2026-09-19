/**
 * The fluid simulation: `02-systems/04-fluids.md` § The four movement rules, § Step algorithm,
 * § Sources and sinks, § Mud, and `04-implementation/algorithms/fluids.md`.
 *
 * The `fluid` byte of `Map3D` holds the level (bits 0-2), the type (bit 3), `settled` (4),
 * `source` (5) and `frozen` (6). Every write of a level goes through {@link FluidSim.setLevel},
 * which keeps the other bits, marks the chunk for redraw and touches the tile.
 *
 * Decisions: D-086 (nothing is active when a game starts; a freshly activated tile starts its idle
 * count at 0), D-087 (a step of one type leaves the other type's active tiles alone), D-088 (fluid
 * does not pass through a solid-bottomed tile's bottom), D-089 (which writes dirty 22's labels),
 * D-090 (an isolated level-1 tile stays active until it evaporates).
 */

import { FLUID_DEEP_LEVEL, FLUID_MAX_LEVEL, FLUID_TICK_CADENCE_MAGMA, FLUID_TICK_CADENCE_WATER } from '@core/constants';
import { WADE_LARGE_SIZE } from '@core/path-constants';
import {
  FLUID_FROZEN_BIT,
  FLUID_LEVEL_MASK,
  FLUID_SETTLED_BIT,
  FLUID_SOURCE_BIT,
  FLUID_TYPE_BIT,
  TileFlag,
  TileKind,
  isSolidBottomed,
  type Map3D,
} from '@core/map3d';
import type { GameEvent } from '@core/events';
import type { RngStream } from '@core/rng';
import type { TerrainApi } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import {
  FLUID_SETTLE_STEPS,
  OBSIDIAN_WALL_LEVEL,
  PRESSURE_BUDGET_TILES,
  PRESSURE_SEARCH_LIMIT,
  SPREAD_EQUALIZE_PERMILLE,
  SPREAD_MAX_PER_STEP,
  WATER_EVAPORATE_PERMILLE,
} from './constants';
import { sortedInsert, sortedRemove } from './state';

/** What the simulation needs from its surroundings. */
export interface FluidHost {
  readonly map: Map3D;
  readonly rng: RngStream;
  /** The terrain API of the tick (mud, obsidian, ice). */
  terrain(): TerrainApi;
  /** 14's `blocksFluidAt(i)`: a closed floodgate or raised bridge. */
  blocksFluidAt(i: TileIndex): boolean;
  /** 14's `blocksFallAt(i)`: a locked hatch. */
  blocksFallAt(i: TileIndex): boolean;
  /** Whether a material index is of class soil or stone (mud, `04` § Mud). */
  mudMaterial(material: number): boolean;
  /** The material index of obsidian (`04` § Water and magma contact). */
  readonly obsidian: number;
  /** Entities standing on a tile (the spatial index). */
  entitiesAt(i: TileIndex): readonly EntityId[];
  /** `Creature.sizeClass` of a creature, or -1 for an entity that is not one. */
  creatureSize(id: EntityId): number;
  emit(event: GameEvent): void;
}

/**
 * The passability band of a fluid byte for 22's connectivity labels, which are built with no mover
 * (`22` § Passability, fluid row; `22` § Connectivity): water below `FLUID_DEEP_LEVEL` is passable
 * to every class exactly as an empty tile is; deep water blocks the walking classes and admits
 * `aquatic` and `amphibious`; magma blocks every class. D-089.
 */
function band(f: number): number {
  const l = f & FLUID_LEVEL_MASK;
  if (l === 0) return 0;
  if ((f & FLUID_TYPE_BIT) !== 0) return 1;
  return l < FLUID_DEEP_LEVEL ? 0 : 2;
}

/** The tile kinds fluid may enter (`04` § Concepts, "Passable for fluid"). */
function fluidKind(kind: TileKind): boolean {
  switch (kind) {
    case TileKind.Open:
    case TileKind.Floor:
    case TileKind.Ramp:
    case TileKind.StairsUp:
    case TileKind.StairsDown:
    case TileKind.StairsUpDown:
    case TileKind.Sapling:
    case TileKind.Shrub:
    case TileKind.Fortification:
      return true;
    case TileKind.Wall:
    case TileKind.Tree:
    case TileKind.Boulder:
      return false;
    default:
      return false;
  }
}

/** {@link FluidSim.bfsHead}'s answer when the step's search budget ran out. */
export const RETRY = -2;

/** The four cardinal directions, visited in the rotating order of rule 2: north, east, south, west. */
const CARDINALS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export class FluidSim {
  readonly host: FluidHost;
  /** Per chunk, the active tiles, ascending. */
  readonly active: number[][];
  /** 1 while a tile is in its chunk's active list. */
  readonly isActive: Uint8Array;
  /** Idle steps of an active tile. */
  readonly idle: Uint8Array;
  readonly waterSources: number[] = [];
  readonly magmaSources: number[] = [];
  readonly sinks: number[] = [];
  parity: 0 | 1 = 0;
  rotation: 0 | 1 | 2 | 3 = 0;
  /** Chunks touched since the last `FluidsChanged`. */
  private readonly touchedChunks = new Set<number>();
  /**
   * Source tiles whose level fell below full since their last refill, per type. The step refills
   * exactly these, ascending, which is the same as walking every source (a full source needs
   * nothing) without walking the whole Sea of Fire every magma step.
   */
  private readonly drainedWater = new Set<number>();
  private readonly drainedMagma = new Set<number>();
  /** Tiles touched during the current step (the post-step entity checks). */
  protected stepTouched: number[] = [];
  /** What is left of the step's `PRESSURE_BUDGET_TILES`. */
  budget = PRESSURE_BUDGET_TILES;
  /** The body search's visited stamps, queue and neighbour scratch. */
  private readonly seen: Int32Array;
  private searchStamp = 0;
  private readonly queue: number[] = [];
  private readonly scratch: number[] = [];
  /** Units destroyed by evaporation and steam since the simulation was built (a debug counter, not state). */
  destroyedUnits = 0;
  /** Units created by sources and destroyed by sinks, likewise. */
  sourcedUnits = 0;
  drainedUnits = 0;

  constructor(host: FluidHost) {
    this.host = host;
    const map = host.map;
    this.active = [];
    for (let c = 0; c < map.chunkCount; c += 1) this.active.push([]);
    this.isActive = new Uint8Array(map.tileCount);
    this.idle = new Uint8Array(map.tileCount);
    this.seen = new Int32Array(map.tileCount);
  }

  get map(): Map3D {
    return this.host.map;
  }

  // ---------- the fluid byte ----------

  level(i: TileIndex): number {
    return ((this.map.fluid[i] ?? 0) as number) & FLUID_LEVEL_MASK;
  }

  isMagma(i: TileIndex): boolean {
    return (((this.map.fluid[i] ?? 0) as number) & FLUID_TYPE_BIT) !== 0;
  }

  isSource(i: TileIndex): boolean {
    return (((this.map.fluid[i] ?? 0) as number) & FLUID_SOURCE_BIT) !== 0;
  }

  isFrozen(i: TileIndex): boolean {
    return (((this.map.fluid[i] ?? 0) as number) & FLUID_FROZEN_BIT) !== 0;
  }

  /** Water (not magma) at level ≥ 1 that is not frozen. */
  hasWater(i: TileIndex): boolean {
    const f = (this.map.fluid[i] ?? 0) as number;
    return (f & FLUID_LEVEL_MASK) > 0 && (f & FLUID_TYPE_BIT) === 0 && (f & FLUID_FROZEN_BIT) === 0;
  }

  /** Magma at level ≥ 1. */
  hasMagma(i: TileIndex): boolean {
    const f = (this.map.fluid[i] ?? 0) as number;
    return (f & FLUID_LEVEL_MASK) > 0 && (f & FLUID_TYPE_BIT) !== 0;
  }

  /**
   * `setLevel(i, n)`: write the level, keeping the source and frozen bits; a tile that holds fluid
   * takes the type of the fluid written; an emptied tile loses its type and settled bits. Marks the
   * chunk for redraw and touches the tile.
   */
  setLevel(i: TileIndex, n: number, magma: boolean): void {
    const map = this.map;
    const before = (map.fluid[i] ?? 0) as number;
    const keep = before & (FLUID_SOURCE_BIT | FLUID_FROZEN_BIT);
    const after = n <= 0 ? keep : keep | (before & FLUID_SETTLED_BIT) | (n & FLUID_LEVEL_MASK) | (magma ? FLUID_TYPE_BIT : 0);
    map.fluid[i] = after;
    if ((after & FLUID_SOURCE_BIT) !== 0 && (after & FLUID_LEVEL_MASK) < FLUID_MAX_LEVEL) this.noteDrained(i);
    this.levelChanged(i, before, after);
    this.touch(i);
  }

  /** A source below full waits for its type's refill. */
  noteDrained(i: TileIndex): void {
    if (this.waterSourceSet(i)) this.drainedWater.add(i);
    else this.drainedMagma.add(i);
  }

  private waterSourceSet(i: TileIndex): boolean {
    let lo = 0;
    let hi = this.waterSources.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((this.waterSources[mid] as number) < i) lo = mid + 1;
      else hi = mid;
    }
    return this.waterSources[lo] === i;
  }

  /** After a load: every source below full is waiting for its refill. */
  rescanDrained(): void {
    this.drainedWater.clear();
    this.drainedMagma.clear();
    for (const s of this.waterSources) if (this.level(s) < FLUID_MAX_LEVEL) this.drainedWater.add(s);
    for (const s of this.magmaSources) if (this.level(s) < FLUID_MAX_LEVEL) this.drainedMagma.add(s);
  }

  /**
   * Every write of a fluid byte marks its chunk for redraw; a write that moves the tile into another
   * passability band also marks it for 22's connectivity relabel (`22` § Connectivity: "Fluids: a
   * rising river dirties the chunks it touches"; D-089).
   */
  protected levelChanged(i: TileIndex, before: number, after: number): void {
    this.map.markChunkDirty(i, true, band(before) !== band(after));
  }

  // ---------- passability ----------

  /**
   * `passable(i, type)`: a fluid kind with no fluid-blocking building, empty or holding the same
   * fluid. Frozen tiles are ice (a wall or floor of ice), so the frozen bit is checked too.
   */
  passable(i: TileIndex, magma: boolean): boolean {
    if (i < 0) return false;
    const map = this.map;
    if (!fluidKind(map.kindAt(i))) return false;
    const f = (map.fluid[i] ?? 0) as number;
    if ((f & FLUID_FROZEN_BIT) !== 0) return false;
    if ((f & FLUID_LEVEL_MASK) > 0 && ((f & FLUID_TYPE_BIT) !== 0) !== magma) return false;
    return !this.host.blocksFluidAt(i);
  }

  // ---------- the active set ----------

  /** `activate(i)`: into its chunk's sorted list, the settled bit cleared, the idle count at 0 (D-086). */
  activate(i: TileIndex): void {
    if (this.isActive[i] === 1) return;
    const map = this.map;
    const c = map.chunkOf(i);
    sortedInsert(this.active[c] as number[], i);
    this.isActive[i] = 1;
    this.idle[i] = 0;
    const rec = map.chunk(c);
    if (rec !== undefined) rec.activeFluidCount += 1;
    map.fluid[i] = ((map.fluid[i] ?? 0) as number) & ~FLUID_SETTLED_BIT;
  }

  /** `deactivate(i)`: out of the list; a tile that still holds fluid is marked settled. */
  deactivate(i: TileIndex): void {
    if (this.isActive[i] !== 1) return;
    const map = this.map;
    const c = map.chunkOf(i);
    sortedRemove(this.active[c] as number[], i);
    this.isActive[i] = 0;
    this.idle[i] = 0;
    const rec = map.chunk(c);
    if (rec !== undefined) rec.activeFluidCount -= 1;
    const f = (map.fluid[i] ?? 0) as number;
    if ((f & FLUID_LEVEL_MASK) > 0) map.fluid[i] = f | FLUID_SETTLED_BIT;
  }

  /** Whether a tile could move: it holds fluid and is not frozen. Only such tiles are activated (D-086). */
  private movable(i: TileIndex): boolean {
    const f = (this.map.fluid[i] ?? 0) as number;
    return (f & FLUID_LEVEL_MASK) > 0 && (f & FLUID_FROZEN_BIT) === 0;
  }

  /** `touch(i)`: the tile and its six neighbours become active; the chunk is reported in `FluidsChanged`. */
  touch(i: TileIndex): void {
    const map = this.map;
    if (this.movable(i)) {
      this.activate(i);
      this.idle[i] = 0;
    }
    const ns = map.neighbors6(i);
    for (let k = 0; k < ns.length; k += 1) {
      const n = ns[k] as TileIndex;
      if (this.movable(n)) this.activate(n);
    }
    this.touchedChunks.add(map.chunkOf(i));
    this.stepTouched.push(i);
  }

  /** `idle(i)`: one more idle step; at `FLUID_SETTLE_STEPS` the tile settles. */
  private idleStep(i: TileIndex): void {
    const n = ((this.idle[i] ?? 0) as number) + 1;
    this.idle[i] = n > 255 ? 255 : n;
    if (n >= FLUID_SETTLE_STEPS) this.deactivate(i);
  }

  /** Number of active tiles (the reader's `activeCount`). */
  activeCount(): number {
    let n = 0;
    for (let c = 0; c < this.active.length; c += 1) n += (this.active[c] as number[]).length;
    return n;
  }

  /** The source lists from the map's `source` bits, ascending. */
  scanSources(): void {
    const map = this.map;
    this.waterSources.length = 0;
    this.magmaSources.length = 0;
    const n = map.tileCount;
    for (let i = 0; i < n; i += 1) {
      const f = map.fluid[i] as number;
      if ((f & FLUID_SOURCE_BIT) === 0) continue;
      if ((f & FLUID_TYPE_BIT) !== 0) this.magmaSources.push(i);
      else this.waterSources.push(i);
    }
  }

  // ---------- moving units ----------

  /** `move(a, b, n)`: units from `a` to `b`; water arriving on a soil or stone floor makes mud. */
  protected move(a: TileIndex, b: TileIndex, n: number, magma: boolean): void {
    this.setLevel(a, this.level(a) - n, magma);
    this.setLevel(b, this.level(b) + n, magma);
    if (!magma) this.mud(b);
  }

  /** `04` § Mud: water at level ≥ 1 on a `floor` of soil or stone sets `mud` (through the terrain API). */
  protected mud(i: TileIndex): void {
    const map = this.map;
    if (map.kindAt(i) !== TileKind.Floor || this.level(i) < 1 || map.hasFlag(i, TileFlag.Mud)) return;
    if (!this.host.mudMaterial(map.materialAt(i))) return;
    this.host.terrain().setFlag(i, TileFlag.Mud, true);
  }

  /**
   * Rule 1, fall: into the tile below when it is passable and has room. D-088: fluid leaves a tile
   * downward only through an open bottom (a tile that is not solid-bottomed); a locked hatch on the
   * tile blocks the fall (`04`: "A hatch closed over `T` blocks the fall").
   */
  protected fall(t: TileIndex, magma: boolean): boolean {
    const map = this.map;
    const b = map.below(t);
    if (b < 0 || isSolidBottomed(map.kindAt(t))) return false;
    if (this.host.blocksFallAt(t) || !this.passable(b, magma)) return false;
    const room = FLUID_MAX_LEVEL - this.level(b);
    if (room <= 0) return false;
    const n = Math.min(this.level(t), room);
    this.move(t, b, n, magma);
    this.afterFall(t, b, magma);
    return true;
  }

  /** The mist check of `04` § Mist (T-M3-07). */
  protected afterFall(_t: TileIndex, _b: TileIndex, _magma: boolean): void {}

  /**
   * Rule 2, spread: each cardinal neighbour in the rotating order; one unit to a neighbour two or
   * more below, one unit with `SPREAD_EQUALIZE_PERMILLE` to a neighbour one below; at most
   * `SPREAD_MAX_PER_STEP` units.
   */
  protected spread(t: TileIndex, magma: boolean): boolean {
    const map = this.map;
    const x = map.xOf(t);
    const y = map.yOf(t);
    const z = map.zOf(t);
    let given = 0;
    for (let k = 0; k < 4; k += 1) {
      const d = CARDINALS[(k + this.rotation) & 3] as readonly [number, number];
      const nx = x + d[0];
      const ny = y + d[1];
      if (!map.inBounds(nx, ny, z)) continue;
      const n = map.index(nx, ny, z);
      if (!this.passable(n, magma)) continue;
      const l = this.level(t);
      const ln = this.level(n);
      if (ln < l - 1) {
        this.move(t, n, 1, magma);
        given += 1;
      } else if (ln === l - 1 && this.host.rng.chance(SPREAD_EQUALIZE_PERMILLE)) {
        this.move(t, n, 1, magma);
        given += 1;
      }
      if (given === SPREAD_MAX_PER_STEP) break;
    }
    return given > 0;
  }

  /** Rules 3 and 4: `'moved'`, `'idle'`, or `'retry'` when the tile is to be tried again next step. */
  protected laterRules(t: TileIndex, magma: boolean): 'moved' | 'idle' | 'retry' {
    if (this.level(t) === FLUID_MAX_LEVEL) {
      const p = this.pressure(t, magma);
      if (p !== 'idle') return p;
    }
    return magma ? 'idle' : this.evaporate(t);
  }

  /**
   * Rule 3, pressure: a full tile whose tile above can take fluid (D-088: through its open bottom)
   * lifts one unit into it from the first full tile of its body that lies higher than it. Found by
   * {@link bfsHead}; a source head gives the unit without losing it. When the step's search budget
   * runs out the tile is tried again next step.
   */
  protected pressure(t: TileIndex, magma: boolean): 'moved' | 'idle' | 'retry' {
    const map = this.map;
    const a = map.above(t);
    if (a < 0 || isSolidBottomed(map.kindAt(a)) || !this.passable(a, magma) || this.level(a) === FLUID_MAX_LEVEL) return 'idle';
    if (this.budget <= 0) return 'retry';
    const h = this.bfsHead(t, map.zOf(a), magma);
    if (h === RETRY) return 'retry';
    if (h < 0) return 'idle';
    if (this.isSource(h)) {
      this.sourcedUnits += 1;
      this.setLevel(a, this.level(a) + 1, magma);
      if (!magma) this.mud(a);
    } else {
      this.move(h, a, 1, magma);
    }
    return 'moved';
  }

  /**
   * `bfsHead(T, targetZ)`: breadth-first over full tiles of the same type (joined vertically only
   * through an open bottom, D-088), from `T`, to the first with `z > targetZ`. At most
   * `PRESSURE_SEARCH_LIMIT` tiles, each paid from the step's `PRESSURE_BUDGET_TILES`. Returns the
   * head, -1 when the body has none within the limit, or {@link RETRY} when the budget ran out.
   */
  bfsHead(t: TileIndex, targetZ: number, magma: boolean): number {
    const map = this.map;
    this.searchStamp += 1;
    if (this.searchStamp > 0x7fffffff) {
      this.seen.fill(0);
      this.searchStamp = 1;
    }
    const stamp = this.searchStamp;
    const queue = this.queue;
    queue.length = 0;
    queue.push(t);
    this.seen[t] = stamp;
    let head = 0;
    let n = 0;
    while (head < queue.length && n < PRESSURE_SEARCH_LIMIT) {
      if (this.budget <= 0) return RETRY;
      const x = queue[head] as number;
      head += 1;
      n += 1;
      this.budget -= 1;
      if (map.zOf(x) > targetZ && this.level(x) === FLUID_MAX_LEVEL) return x;
      const up = map.above(x);
      const down = map.below(x);
      const ns = map.neighbors6(x, this.scratch);
      for (let k = 0; k < ns.length; k += 1) {
        const y = ns[k] as number;
        if (this.seen[y] === stamp) continue;
        if (this.level(y) !== FLUID_MAX_LEVEL || this.isMagma(y) !== magma || this.isFrozen(y) || !this.passable(y, magma)) continue;
        // D-088: vertical neighbours are joined through the upper tile's open bottom.
        if (y === up && isSolidBottomed(map.kindAt(y))) continue;
        if (y === down && isSolidBottomed(map.kindAt(x))) continue;
        this.seen[y] = stamp;
        queue.push(y);
      }
      this.scratch.length = 0;
    }
    return -1;
  }

  /**
   * Rule 4, evaporate (water only): a level-1 tile that is not a source and has no water among its
   * six neighbours loses its unit with `WATER_EVAPORATE_PERMILLE`. While it waits for the draw it
   * stays active (D-090).
   */
  protected evaporate(t: TileIndex): 'moved' | 'idle' | 'retry' {
    if (this.level(t) !== 1 || this.isSource(t)) return 'idle';
    const ns = this.map.neighbors6(t, this.scratch);
    let wet = false;
    for (let k = 0; k < ns.length; k += 1) if (this.hasWater(ns[k] as number)) wet = true;
    this.scratch.length = 0;
    if (wet) return 'idle';
    if (!this.host.rng.chance(WATER_EVAPORATE_PERMILLE)) return 'retry';
    this.destroyedUnits += 1;
    this.setLevel(t, 0, false);
    return 'moved';
  }

  /**
   * `04` § Water and magma contact, checked for every processed water tile against its six
   * neighbours: the magma tile becomes obsidian (`wall` from `OBSIDIAN_WALL_LEVEL`, else `floor`)
   * through the terrain API, its fluid is cleared, the water tile loses one unit (steam) and
   * `ObsidianFormed { tile }` is emitted.
   */
  protected contact(t: TileIndex): void {
    const map = this.map;
    if (this.isMagma(t) || this.level(t) === 0 || this.isFrozen(t)) return;
    const ns = map.neighbors6(t);
    for (let k = 0; k < ns.length; k += 1) {
      const y = ns[k] as number;
      if (!this.hasMagma(y)) continue;
      const level = this.level(y);
      const before = (map.fluid[y] ?? 0) as number;
      this.deactivate(y);
      map.fluid[y] = 0;
      if ((before & FLUID_SOURCE_BIT) !== 0) {
        sortedRemove(this.magmaSources, y);
        this.drainedMagma.delete(y);
      }
      this.levelChanged(y, before, 0);
      this.host.terrain().setKind(y, level >= OBSIDIAN_WALL_LEVEL ? TileKind.Wall : TileKind.Floor, this.host.obsidian);
      this.touch(y);
      this.destroyedUnits += 1;
      this.setLevel(t, this.level(t) - 1, false);
      this.host.emit({ type: 'ObsidianFormed', tile: y });
      if (this.level(t) === 0) return;
    }
  }

  /** Called before each step: the pressure search budget is refilled. */
  protected beginStep(): void {
    this.budget = PRESSURE_BUDGET_TILES;
  }

  /**
   * `04` § Creatures and items in fluid, after each step, for each touched tile with entities: deep
   * water submerges every creature on it (`CreatureSubmerged`), except one of `WADE_LARGE_SIZE` or
   * more below level 7 (`algorithms/fluids.md`); magma touches everything on it (`MagmaContact`).
   */
  protected endStep(touched: readonly TileIndex[]): void {
    if (touched.length === 0) return;
    const tiles = Array.from(new Set(touched)).sort((a, b) => a - b);
    for (let k = 0; k < tiles.length; k += 1) this.checkEntities(tiles[k] as TileIndex, null);
  }

  /** The entity checks of one tile, for every entity on it or only for `only`. */
  checkEntities(t: TileIndex, only: EntityId | null): void {
    const level = this.level(t);
    if (level === 0 || this.isFrozen(t)) return;
    const here = this.host.entitiesAt(t);
    if (here.length === 0) return;
    const ids = only === null ? here.slice() : here.filter((id) => id === only);
    if (ids.length === 0) return;
    if (this.isMagma(t)) {
      this.host.emit({ type: 'MagmaContact', tile: t, entities: ids });
      return;
    }
    if (level < FLUID_DEEP_LEVEL) return;
    for (const id of ids) {
      const size = this.host.creatureSize(id);
      if (size < 0) continue;
      if (size >= WADE_LARGE_SIZE && level < FLUID_MAX_LEVEL) continue;
      this.host.emit({ type: 'CreatureSubmerged', id, tile: t });
    }
  }

  // ---------- the step ----------

  /**
   * One step of one fluid type: every chunk with active tiles in ascending chunk order, its tiles
   * ascending or, on odd parity, descending; then the sources refill and the sinks drain.
   */
  step(magma: boolean): void {
    this.parity = this.parity === 0 ? 1 : 0;
    this.rotation = ((this.rotation + 1) & 3) as 0 | 1 | 2 | 3;
    this.stepTouched = [];
    this.beginStep();
    const map = this.map;
    for (let c = 0; c < this.active.length; c += 1) {
      const list = this.active[c] as number[];
      if (list.length === 0) continue;
      const tiles = list.slice();
      const descending = this.parity === 1;
      for (let k = 0; k < tiles.length; k += 1) {
        const t = tiles[descending ? tiles.length - 1 - k : k] as TileIndex;
        if (this.isActive[t] !== 1) continue;
        const f = (map.fluid[t] ?? 0) as number;
        if ((f & FLUID_FROZEN_BIT) !== 0 || (f & FLUID_LEVEL_MASK) === 0) {
          this.deactivate(t);
          continue;
        }
        // D-087: the other type's tiles wait for their own step.
        if (((f & FLUID_TYPE_BIT) !== 0) !== magma) continue;
        let outcome: 'moved' | 'idle' | 'retry' = 'idle';
        if (this.fall(t, magma) || this.spread(t, magma)) outcome = 'moved';
        else outcome = this.laterRules(t, magma);
        if (outcome === 'idle') this.idleStep(t);
        this.contact(t);
      }
    }
    const sources = magma ? this.magmaSources : this.waterSources;
    const drained = magma ? this.drainedMagma : this.drainedWater;
    if (drained.size > 0) {
      const due = Array.from(drained).sort((a, b) => a - b);
      drained.clear();
      let lost = false;
      for (let k = 0; k < due.length; k += 1) {
        const s = due[k] as TileIndex;
        const f = (map.fluid[s] ?? 0) as number;
        if ((f & FLUID_SOURCE_BIT) === 0) {
          lost = true;
          continue;
        }
        if ((f & FLUID_FROZEN_BIT) !== 0) continue;
        const l = f & FLUID_LEVEL_MASK;
        if (l < FLUID_MAX_LEVEL && (l === 0 || ((f & FLUID_TYPE_BIT) !== 0) === magma)) {
          this.sourcedUnits += FLUID_MAX_LEVEL - l;
          this.setLevel(s, FLUID_MAX_LEVEL, magma);
        }
      }
      // A source whose tile was turned to rock (obsidian) is no longer a source.
      if (lost) {
        const keep = sources.filter((s) => (((map.fluid[s] ?? 0) as number) & FLUID_SOURCE_BIT) !== 0);
        sources.length = 0;
        sources.push(...keep);
      }
    }
    for (let k = 0; k < this.sinks.length; k += 1) {
      const s = this.sinks[k] as TileIndex;
      const l = this.level(s);
      if (l > 0 && !this.isFrozen(s)) {
        this.drainedUnits += l;
        this.setLevel(s, 0, this.isMagma(s));
      }
    }
    this.endStep(this.stepTouched);
  }

  /** `04` § Step algorithm cadence: water every `FLUID_TICK_CADENCE_WATER` ticks, magma every `FLUID_TICK_CADENCE_MAGMA`. */
  run(tick: number): void {
    if (tick % FLUID_TICK_CADENCE_WATER === 0) this.step(false);
    if (tick % FLUID_TICK_CADENCE_MAGMA === 0) this.step(true);
  }

  /** The chunks touched since the last call, ascending, and forget them. */
  takeTouchedChunks(): number[] {
    const out = Array.from(this.touchedChunks).sort((a, b) => a - b);
    this.touchedChunks.clear();
    return out;
  }

  /**
   * Put fluid on a tile (setup, tests and debug): the level and type, optionally the source bit,
   * and touch it so the simulation picks it up.
   */
  pour(i: TileIndex, level: number, magma = false, source = false): void {
    const map = this.map;
    const f = (map.fluid[i] ?? 0) as number;
    map.fluid[i] = source ? f | FLUID_SOURCE_BIT : f & ~FLUID_SOURCE_BIT;
    const list = magma ? this.magmaSources : this.waterSources;
    if (source) sortedInsert(list, i);
    else {
      sortedRemove(this.waterSources, i);
      sortedRemove(this.magmaSources, i);
    }
    this.setLevel(i, level, magma);
  }
}
