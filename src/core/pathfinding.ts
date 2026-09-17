/**
 * Passability, edges, A* and the path cache.
 *
 * Implements `02-systems/22-pathfinding-and-spatial.md` § Passability, § Costs, § Edges, § A*,
 * § Path cache and § Line of sight, following the pseudo-code of
 * `04-implementation/algorithms/pathfinding-and-connectivity.md` § Passability and cost and § A*.
 *
 * Building-dependent passability is a hook (`TerrainHooks`) that answers "no building here" until
 * 14 buildings arrives in M2, exactly as T-M0-09 prescribes. The same shape carries 03's forbidden
 * set (M1) and 16's hostility test (M6).
 */

import { FLUID_DEEP_LEVEL, FLUID_WADE_LEVEL } from './constants';
import { Connectivity, type ConnectivityGraph } from './connectivity';
import { FluidType, Map3D, TileFlag, TileKind } from './map3d';
import {
  DIAGONAL_COST_NUMERATOR,
  DOOR_COST_PENALTY,
  FLUID_MAX_LEVEL,
  LOS_MAX,
  PATH_CACHE_SIZE,
  PATH_CACHE_SPLICE_NODE_LIMIT,
  PATH_CONCURRENT,
  PATH_NODES_PER_TICK,
  PATH_NODE_LIMIT,
  RESTRICTED_COST_MULTIPLIER,
  SNOW_MOVE_COST_PERCENT,
  STEP_COST,
  WADE_COST_MULTIPLIER,
  WADE_LARGE_SIZE,
  WEB_COST_MULTIPLIER,
  Z_HEURISTIC_COST,
} from './path-constants';
import type { ChunkIndex, EntityId, MovementClass, TileIndex } from './types';

// ---------- hooks for the parts that belong to later milestones ----------

/**
 * The queries the tile graph delegates to systems that do not exist yet. Every default is the
 * "nothing is there" answer, which is the state M0 actually has.
 */
export interface TerrainHooks {
  /** 14 buildings: `blocksMovementAt(i, cls, faction)`. Arrives with T-M2-05. */
  blocksMovementAt(i: TileIndex, cls: MovementClass, faction: string | undefined): boolean;
  /** A door building stands on the tile: +`DOOR_COST_PENALTY`, and creatures block there. T-M2-06. */
  doorAt(i: TileIndex): boolean;
  /** A locked hatch removes the stairs edge through its tile. T-M2-06. */
  lockedHatchAt(i: TileIndex): boolean;
  /** Blocks line of sight: a closed door, a raised drawbridge, a closed floodgate. T-M2-06. */
  blocksSightAt(i: TileIndex): boolean;
  /** 03 terrain's forbidden-tile set, which blocks fortress creatures. Arrives with T-M1-07. */
  forbidden(i: TileIndex): boolean;
  /** 16 combat's hostility test between two creatures. Arrives with T-M6-02. */
  hostile(a: EntityId, b: EntityId): boolean;
}

export const DEFAULT_TERRAIN_HOOKS: TerrainHooks = Object.freeze({
  blocksMovementAt: (): boolean => false,
  doorAt: (): boolean => false,
  lockedHatchAt: (): boolean => false,
  blocksSightAt: (): boolean => false,
  forbidden: (): boolean => false,
  hostile: (): boolean => false,
});

/** The per-creature facts `passable` needs beyond the movement class. */
export interface MoverOptions {
  /** `'fortress'`, `'wild'`, a `hostile:<civ>` and so on; only `fortress` is restricted. */
  readonly faction?: string | undefined;
  /** The species flag of `03-content/creatures.md`; magma blocks everyone else. */
  readonly magmaSafe?: boolean | undefined;
  /** `Creature.sizeClass`; `size >= WADE_LARGE_SIZE` wades until level 7. */
  readonly size?: number | undefined;
}

const NO_MOVER: MoverOptions = Object.freeze({});

const FORTRESS = 'fortress';

/** The kinds a diagonal may not cut past and a ramp may lean on. */
function isSolidObstacle(kind: TileKind): boolean {
  return (
    kind === TileKind.Wall ||
    kind === TileKind.Tree ||
    kind === TileKind.Boulder ||
    kind === TileKind.Fortification
  );
}

/** The four cardinal offsets, in the fixed order -x, +x, -y, +y. */
const CARDINALS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** The eight horizontal offsets, in ascending (dy, dx) order so edge order is fixed. */
const HORIZONTALS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

export type EdgeSink = (to: TileIndex, stepCost: number) => void;

// ---------- the tile graph ----------

/** Passability, cost, edges and line of sight over one `Map3D`. */
export class TileGraph implements ConnectivityGraph {
  readonly map: Map3D;
  hooks: TerrainHooks;

  constructor(map: Map3D, hooks: Partial<TerrainHooks> = {}) {
    this.map = map;
    this.hooks = { ...DEFAULT_TERRAIN_HOOKS, ...hooks };
  }

  /** `passable(i, cls, faction)` of the algorithm document. */
  passable(i: TileIndex, cls: MovementClass, mover: MoverOptions = NO_MOVER): boolean {
    const map = this.map;
    if (!map.validIndex(i)) return false;
    const kind = map.kindAt(i);
    if (
      kind === TileKind.Wall ||
      kind === TileKind.Tree ||
      kind === TileKind.Boulder ||
      kind === TileKind.Open
    ) {
      return false;
    }
    if (kind === TileKind.Fortification && cls !== 'small') return false;
    if (this.hooks.blocksMovementAt(i, cls, mover.faction)) return false;
    // `22` § Passability lists `burning` and the forbidden set as blocking "all"; they are checked
    // before the class-specific answers so that no class slips past them.
    if (map.hasFlag(i, TileFlag.Burning)) return false;
    if (mover.faction === FORTRESS && this.hooks.forbidden(i)) return false;
    const level = map.fluidLevelAt(i);
    const magma = map.fluidTypeAt(i) === FluidType.Magma;
    if (magma && level > 0 && mover.magmaSafe !== true) return false;
    if (cls === 'aquatic') return !magma && level >= FLUID_DEEP_LEVEL;
    if (level >= FLUID_DEEP_LEVEL && !magma && cls !== 'amphibious') {
      const wades = cls === 'large' && (mover.size ?? 0) >= WADE_LARGE_SIZE && level < FLUID_MAX_LEVEL;
      if (!wades) return false;
    }
    return true;
  }

  /** `cost(i, cls, faction)` of the algorithm document, in the 1000-per-step scale. */
  cost(i: TileIndex, cls: MovementClass, mover: MoverOptions = NO_MOVER): number {
    const map = this.map;
    let c = STEP_COST;
    const level = map.fluidLevelAt(i);
    if (level >= 1 && level <= FLUID_WADE_LEVEL && cls !== 'aquatic') c *= WADE_COST_MULTIPLIER;
    if (map.hasFlag(i, TileFlag.Snow)) c = Math.trunc((c * SNOW_MOVE_COST_PERCENT) / 100);
    if (map.hasFlag(i, TileFlag.Restricted) && mover.faction === FORTRESS) {
      c *= RESTRICTED_COST_MULTIPLIER;
    }
    if (map.hasFlag(i, TileFlag.Web)) c *= WEB_COST_MULTIPLIER;
    if (this.hooks.doorAt(i)) c += DOOR_COST_PENALTY;
    return c;
  }

  /** The eight same-level edges, with the no-cutting-corners rule. */
  forEachHorizontalEdge(
    i: TileIndex,
    cls: MovementClass,
    fn: EdgeSink,
    mover: MoverOptions = NO_MOVER,
  ): void {
    const map = this.map;
    if (!map.validIndex(i)) return;
    const x = map.xOf(i);
    const y = map.yOf(i);
    const z = map.zOf(i);
    for (let k = 0; k < HORIZONTALS.length; k += 1) {
      const d = HORIZONTALS[k] as readonly [number, number];
      const nx = x + d[0];
      const ny = y + d[1];
      if (!map.inBounds(nx, ny, z)) continue;
      const j = map.index(nx, ny, z);
      if (!this.passable(j, cls, mover)) continue;
      if (d[0] !== 0 && d[1] !== 0) {
        const a = map.index(nx, y, z);
        const b = map.index(x, ny, z);
        if (isSolidObstacle(map.kindAt(a)) || isSolidObstacle(map.kindAt(b))) continue;
        fn(j, Math.trunc((this.cost(j, cls, mover) * DIAGONAL_COST_NUMERATOR) / STEP_COST));
      } else {
        fn(j, this.cost(j, cls, mover));
      }
    }
  }

  /** The stairs and ramp edges leaving `i`. */
  forEachVerticalEdge(
    i: TileIndex,
    cls: MovementClass,
    fn: EdgeSink,
    mover: MoverOptions = NO_MOVER,
  ): void {
    const map = this.map;
    if (!map.validIndex(i)) return;
    const kind = map.kindAt(i);
    // Stairs. `large` creatures cannot use them; ramps are their only vertical route.
    if (cls !== 'large' && (kind === TileKind.StairsUp || kind === TileKind.StairsUpDown)) {
      const up = map.above(i);
      if (up >= 0) {
        const k = map.kindAt(up);
        if (
          (k === TileKind.StairsDown || k === TileKind.StairsUpDown) &&
          this.passable(up, cls, mover) &&
          !this.hooks.lockedHatchAt(up)
        ) {
          fn(up, this.cost(up, cls, mover));
        }
      }
    }
    if (cls !== 'large' && (kind === TileKind.StairsDown || kind === TileKind.StairsUpDown)) {
      const down = map.below(i);
      if (down >= 0) {
        const k = map.kindAt(down);
        if (
          (k === TileKind.StairsUp || k === TileKind.StairsUpDown) &&
          this.passable(down, cls, mover) &&
          !this.hooks.lockedHatchAt(i)
        ) {
          fn(down, this.cost(down, cls, mover));
        }
      }
    }
    const x = map.xOf(i);
    const y = map.yOf(i);
    const z = map.zOf(i);
    // Up: standing on the ramp, leave over the solid tile it leans on.
    if (kind === TileKind.Ramp) {
      const over = map.above(i);
      if (over >= 0 && map.kindAt(over) === TileKind.Open) {
        for (let k = 0; k < CARDINALS.length; k += 1) {
          const d = CARDINALS[k] as readonly [number, number];
          if (!map.inBounds(x + d[0], y + d[1], z)) continue;
          const w = map.index(x + d[0], y + d[1], z);
          if (!isSolidObstacle(map.kindAt(w))) continue;
          const u = map.above(w);
          if (u < 0 || !this.passable(u, cls, mover)) continue;
          fn(u, this.cost(u, cls, mover));
        }
      }
    }
    // Down: the tile below is the solid a ramp on the level below may lean on.
    const below = map.below(i);
    if (below >= 0 && isSolidObstacle(map.kindAt(below))) {
      const bz = z - 1;
      for (let k = 0; k < CARDINALS.length; k += 1) {
        const d = CARDINALS[k] as readonly [number, number];
        if (!map.inBounds(x + d[0], y + d[1], bz)) continue;
        const r = map.index(x + d[0], y + d[1], bz);
        if (map.kindAt(r) !== TileKind.Ramp) continue;
        if (!this.passable(r, cls, mover)) continue;
        const over = map.above(r);
        if (over < 0 || map.kindAt(over) !== TileKind.Open) continue;
        fn(r, this.cost(r, cls, mover));
      }
    }
  }

  /** Every edge leaving `i`: the eight horizontal ones, then the vertical ones. */
  forEachEdge(i: TileIndex, cls: MovementClass, fn: EdgeSink, mover: MoverOptions = NO_MOVER): void {
    this.forEachHorizontalEdge(i, cls, fn, mover);
    this.forEachVerticalEdge(i, cls, fn, mover);
  }

  /** The edges leaving `i` as a flat `[to, cost, ...]` list; for tests and the inspector. */
  edges(i: TileIndex, cls: MovementClass, mover: MoverOptions = NO_MOVER): [TileIndex, number][] {
    const out: [TileIndex, number][] = [];
    this.forEachEdge(i, cls, (to, stepCost) => out.push([to, stepCost]), mover);
    return out;
  }

  hasEdge(a: TileIndex, b: TileIndex, cls: MovementClass, mover: MoverOptions = NO_MOVER): boolean {
    let found = false;
    this.forEachEdge(
      a,
      cls,
      (to) => {
        if (to === b) found = true;
      },
      mover,
    );
    return found;
  }

  /**
   * `22` § Line of sight: Bresenham on one z-level. The tiles strictly between `a` and `b` are the
   * ones that may block; the endpoints never block their own sight line.
   */
  lineOfSight(a: TileIndex, b: TileIndex): boolean {
    const map = this.map;
    if (!map.validIndex(a) || !map.validIndex(b)) return false;
    const z = map.zOf(a);
    if (map.zOf(b) !== z) return false;
    if (a === b) return true;
    let x = map.xOf(a);
    let y = map.yOf(a);
    const x1 = map.xOf(b);
    const y1 = map.yOf(b);
    if (Math.max(Math.abs(x1 - x), Math.abs(y1 - y)) > LOS_MAX) return false;
    const dx = Math.abs(x1 - x);
    const dy = -Math.abs(y1 - y);
    const sx = x < x1 ? 1 : -1;
    const sy = y < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
      if (x === x1 && y === y1) return true;
      const i = map.index(x, y, z);
      const kind = map.kindAt(i);
      if (kind === TileKind.Wall || kind === TileKind.Tree || kind === TileKind.Boulder) return false;
      if (this.hooks.blocksSightAt(i)) return false;
      if (kind === TileKind.Fortification) {
        const nearA = chebyshevBetween(map, i, a) <= 1;
        const nearB = chebyshevBetween(map, i, b) <= 1;
        if (!nearA && !nearB) return false;
      }
    }
  }
}

function chebyshevBetween(map: Map3D, a: TileIndex, b: TileIndex): number {
  return Math.max(
    Math.abs(map.xOf(a) - map.xOf(b)),
    Math.abs(map.yOf(a) - map.yOf(b)),
    Math.abs(map.zOf(a) - map.zOf(b)),
  );
}

// ---------- A* ----------

/** `22` § A*: the urgency ranks the request queue is ordered by. */
export type PathUrgency = 'flee' | 'combat' | 'job' | 'need' | 'wander' | 'caravan';

export const URGENCY_RANK: Readonly<Record<PathUrgency, number>> = Object.freeze({
  flee: 0,
  combat: 1,
  job: 2,
  need: 2,
  wander: 3,
  caravan: 3,
});

export type PathFailure = 'unreachable' | 'too_far';

export type PathResult =
  | { readonly state: 'pending' }
  | { readonly state: 'ready'; readonly path: readonly TileIndex[] }
  | { readonly state: 'failed'; readonly reason: PathFailure };

export interface PathOptions {
  /** On failure return the closest node reached instead of failing. */
  readonly nearest?: boolean | undefined;
  /** Reserved for 16; the planner ignores dynamic obstacles (`22` § Passability). */
  readonly avoidHostiles?: boolean | undefined;
}

const PENDING: PathResult = Object.freeze({ state: 'pending' });

/** A binary min-heap keyed by `f`, ties broken by the lower tile index. */
class OpenSet {
  private readonly tiles: number[] = [];
  private readonly keys: number[] = [];

  get size(): number {
    return this.tiles.length;
  }

  push(tile: TileIndex, key: number): void {
    this.tiles.push(tile);
    this.keys.push(key);
    let i = this.tiles.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.less(i, parent)) {
        this.swap(i, parent);
        i = parent;
      } else break;
    }
  }

  pop(): TileIndex {
    const top = this.tiles[0] as number;
    const lastTile = this.tiles.pop() as number;
    const lastKey = this.keys.pop() as number;
    if (this.tiles.length > 0) {
      this.tiles[0] = lastTile;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let best = i;
        if (l < this.tiles.length && this.less(l, best)) best = l;
        if (r < this.tiles.length && this.less(r, best)) best = r;
        if (best === i) break;
        this.swap(i, best);
        i = best;
      }
    }
    return top;
  }

  private less(a: number, b: number): boolean {
    const ka = this.keys[a] as number;
    const kb = this.keys[b] as number;
    if (ka !== kb) return ka < kb;
    return (this.tiles[a] as number) < (this.tiles[b] as number);
  }

  private swap(a: number, b: number): void {
    const t = this.tiles[a] as number;
    this.tiles[a] = this.tiles[b] as number;
    this.tiles[b] = t;
    const k = this.keys[a] as number;
    this.keys[a] = this.keys[b] as number;
    this.keys[b] = k;
  }
}

/**
 * Generation-stamped scratch arrays sized to the map, so a search never clears them
 * (`04-implementation/algorithms/pathfinding-and-connectivity.md` § A*). They are pooled; at most
 * `PATH_CONCURRENT` exist, and one is only allocated when a search actually starts.
 */
class Scratch {
  readonly g: Int32Array;
  readonly parent: Int32Array;
  readonly stamp: Int32Array;
  readonly closed: Int32Array;
  gen = 0;

  constructor(tiles: number) {
    this.g = new Int32Array(tiles);
    this.parent = new Int32Array(tiles);
    this.stamp = new Int32Array(tiles);
    this.closed = new Int32Array(tiles);
  }

  begin(): void {
    this.gen += 1;
  }

  gOf(i: TileIndex): number {
    return this.stamp[i] === this.gen ? (this.g[i] as number) : Number.MAX_SAFE_INTEGER;
  }

  relax(i: TileIndex, g: number, parent: TileIndex): void {
    this.stamp[i] = this.gen;
    this.g[i] = g;
    this.parent[i] = parent;
  }

  parentOf(i: TileIndex): TileIndex {
    return this.parent[i] as number;
  }

  isClosed(i: TileIndex): boolean {
    return this.closed[i] === this.gen;
  }

  close(i: TileIndex): void {
    this.closed[i] = this.gen;
  }
}

interface PathRequest {
  readonly id: number;
  readonly entity: EntityId;
  readonly from: TileIndex;
  readonly to: TileIndex;
  readonly cls: MovementClass;
  readonly urgency: PathUrgency;
  readonly opts: PathOptions;
  readonly mover: MoverOptions;
  state: 'pending' | 'running' | 'ready' | 'failed';
  reason: PathFailure | null;
  path: TileIndex[] | null;
  scratch: Scratch | null;
  open: OpenSet | null;
  expanded: number;
  bestNode: TileIndex;
  bestH: number;
}

function isSettled(r: PathRequest): boolean {
  return r.state === 'ready' || r.state === 'failed';
}

interface CacheEntry {
  readonly path: readonly TileIndex[];
  readonly chunks: readonly ChunkIndex[];
}

/** Label lookup, satisfied by {@link Connectivity}. */
export interface LabelSource {
  label(i: TileIndex, cls: MovementClass): number;
  reachable(from: TileIndex, to: TileIndex, cls: MovementClass): boolean;
}

export interface PathfinderOptions {
  /**
   * Turn the route cache of `22` § Path cache on. It is off by default: the cache is not part of
   * a save, so a spliced cached path would make a loaded game answer differently from an
   * uninterrupted run, which `simulation-core.md` § Determinism forbids. See DECISIONS.md D-021.
   */
  readonly cache?: boolean | undefined;
}

export class Pathfinder {
  readonly graph: TileGraph;
  private readonly map: Map3D;
  private labels: LabelSource | null;
  private readonly cacheEnabled: boolean;

  private nextId = 1;
  private readonly queue: PathRequest[] = [];
  private readonly byId = new Map<number, PathRequest>();
  private readonly pool: Scratch[] = [];
  private readonly cache = new Map<string, CacheEntry>();
  /** Nodes expanded during the most recent {@link tick}. */
  lastTickNodes = 0;

  constructor(map: Map3D, graph: TileGraph, labels: LabelSource | null = null, options: PathfinderOptions = {}) {
    this.map = map;
    this.graph = graph;
    this.labels = labels;
    this.cacheEnabled = options.cache === true;
  }

  setLabels(labels: LabelSource | null): void {
    this.labels = labels;
  }

  /** Requests waiting or in progress. */
  get openRequests(): number {
    return this.queue.length;
  }

  /** `pathing.requestPath`. Returns the request id, which is also the path id. */
  requestPath(
    entity: EntityId,
    from: TileIndex,
    to: TileIndex,
    cls: MovementClass,
    urgency: PathUrgency = 'job',
    opts: PathOptions = {},
    mover: MoverOptions = NO_MOVER,
  ): number {
    const id = this.nextId;
    this.nextId += 1;
    const request: PathRequest = {
      id,
      entity,
      from,
      to,
      cls,
      urgency,
      opts,
      mover,
      state: 'pending',
      reason: null,
      path: null,
      scratch: null,
      open: null,
      expanded: 0,
      bestNode: from,
      bestH: this.heuristic(from, to),
    };
    this.byId.set(id, request);
    // Ordered by (urgency rank, request id); ids ascend, so appending inside the rank suffices.
    let at = this.queue.length;
    const rank = URGENCY_RANK[urgency];
    while (at > 0 && URGENCY_RANK[(this.queue[at - 1] as PathRequest).urgency] > rank) at -= 1;
    this.queue.splice(at, 0, request);
    return id;
  }

  pathResult(id: number): PathResult {
    const r = this.byId.get(id);
    if (r === undefined) return PENDING;
    if (r.state === 'ready') return { state: 'ready', path: r.path ?? [] };
    if (r.state === 'failed') return { state: 'failed', reason: r.reason ?? 'unreachable' };
    return PENDING;
  }

  /** The finished path of a request, or null. */
  path(id: number): readonly TileIndex[] | null {
    const r = this.byId.get(id);
    return r?.state === 'ready' ? (r.path ?? []) : null;
  }

  /** Forget a request. The mover calls this once it has copied the path. */
  release(id: number): void {
    const r = this.byId.get(id);
    if (r === undefined) return;
    this.finish(r);
    this.byId.delete(id);
  }

  cancel(id: number): void {
    this.release(id);
  }

  /** Drop the scratch buffers and take the request out of the queue. */
  private finish(r: PathRequest): void {
    if (r.scratch !== null) {
      this.pool.push(r.scratch);
      r.scratch = null;
    }
    r.open = null;
    const at = this.queue.indexOf(r);
    if (at >= 0) this.queue.splice(at, 1);
  }

  private takeScratch(): Scratch {
    const reused = this.pool.pop();
    if (reused !== undefined) return reused;
    return new Scratch(this.map.tileCount);
  }

  private heuristic(from: TileIndex, to: TileIndex): number {
    const map = this.map;
    if (!map.validIndex(from) || !map.validIndex(to)) return 0;
    const dx = Math.abs(map.xOf(from) - map.xOf(to));
    const dy = Math.abs(map.yOf(from) - map.yOf(to));
    const dz = Math.abs(map.zOf(from) - map.zOf(to));
    return Math.max(dx, dy) * STEP_COST + dz * Z_HEURISTIC_COST;
  }

  /**
   * Serve the request queue within one tick's node budget. Returns the nodes expanded.
   * `22` § A*: requests are served by urgency then id; an unfinished request keeps its open set
   * and resumes next tick; at most `PATH_CONCURRENT` searches are in progress at once.
   */
  tick(budget: number = PATH_NODES_PER_TICK): number {
    let left = budget;
    let running = 0;
    for (let k = 0; k < this.queue.length; k += 1) {
      if ((this.queue[k] as PathRequest).state === 'running') running += 1;
    }
    // A copy: finished requests leave the queue while we walk it.
    const order = this.queue.slice();
    for (let k = 0; k < order.length && left > 0; k += 1) {
      const r = order[k] as PathRequest;
      if (isSettled(r)) continue;
      if (r.state === 'pending') {
        if (running >= PATH_CONCURRENT) continue;
        if (!this.start(r)) continue;
        running += 1;
      }
      left -= this.advance(r, left);
      if (isSettled(r)) running -= 1;
    }
    this.lastTickNodes = budget - left;
    return this.lastTickNodes;
  }

  /**
   * Move a pending request to running. Returns false when it settled immediately (trivial path,
   * a label mismatch, or a cache hit).
   */
  private start(r: PathRequest): boolean {
    if (!this.map.validIndex(r.from) || !this.map.validIndex(r.to)) {
      this.fail(r, 'unreachable');
      return false;
    }
    if (r.from === r.to) {
      this.succeed(r, []);
      return false;
    }
    if (r.opts.nearest !== true && this.labels !== null) {
      if (!this.labels.reachable(r.from, r.to, r.cls)) {
        this.fail(r, 'unreachable');
        return false;
      }
    }
    const cached = this.cacheLookup(r);
    if (cached !== null) {
      this.succeed(r, cached, false);
      return false;
    }
    r.scratch = this.takeScratch();
    r.scratch.begin();
    r.scratch.relax(r.from, 0, -1);
    r.open = new OpenSet();
    r.open.push(r.from, this.heuristic(r.from, r.to));
    r.state = 'running';
    r.expanded = 0;
    r.bestNode = r.from;
    r.bestH = this.heuristic(r.from, r.to);
    return true;
  }

  /** Expand at most `budget` nodes of a running request. Returns the nodes actually expanded. */
  private advance(r: PathRequest, budget: number): number {
    const scratch = r.scratch;
    const open = r.open;
    if (scratch === null || open === null) return 0;
    let used = 0;
    while (used < budget && open.size > 0) {
      const cur = open.pop();
      if (cur === r.to) {
        this.succeed(r, this.reconstruct(r, cur));
        return used;
      }
      if (scratch.isClosed(cur)) continue;
      scratch.close(cur);
      r.expanded += 1;
      used += 1;
      if (r.expanded >= PATH_NODE_LIMIT) {
        if (r.opts.nearest === true) this.succeed(r, this.reconstruct(r, r.bestNode));
        else this.fail(r, 'too_far');
        return used;
      }
      const g = scratch.gOf(cur);
      this.graph.forEachEdge(
        cur,
        r.cls,
        (to, stepCost) => {
          const ng = g + stepCost;
          if (ng >= scratch.gOf(to)) return;
          scratch.relax(to, ng, cur);
          open.push(to, ng + this.heuristic(to, r.to));
          const h = this.heuristic(to, r.to);
          if (h < r.bestH || (h === r.bestH && to < r.bestNode)) {
            r.bestH = h;
            r.bestNode = to;
          }
        },
        r.mover,
      );
    }
    if (open.size === 0) {
      if (r.opts.nearest === true) this.succeed(r, this.reconstruct(r, r.bestNode));
      else this.fail(r, 'unreachable');
    }
    return used;
  }

  private reconstruct(r: PathRequest, end: TileIndex): TileIndex[] {
    const scratch = r.scratch;
    if (scratch === null) return [];
    const reversed: TileIndex[] = [];
    let cur = end;
    while (cur !== r.from && cur >= 0) {
      reversed.push(cur);
      cur = scratch.parentOf(cur);
      if (reversed.length > this.map.tileCount) break;
    }
    reversed.reverse();
    return reversed;
  }

  private succeed(r: PathRequest, path: TileIndex[] | readonly TileIndex[], store = true): void {
    r.state = 'ready';
    r.path = path.slice();
    if (store && this.cacheEnabled && r.path.length > 0) this.cacheStore(r, r.path);
    this.finish(r);
  }

  private fail(r: PathRequest, reason: PathFailure): void {
    r.state = 'failed';
    r.reason = reason;
    r.path = null;
    this.finish(r);
  }

  // ---------- the path cache ----------

  private cacheKey(from: TileIndex, to: TileIndex, cls: MovementClass): string {
    return `${this.map.chunkOf(from)}|${to}|${cls}`;
  }

  private cacheStore(r: PathRequest, path: readonly TileIndex[]): void {
    const chunks = new Set<ChunkIndex>([this.map.chunkOf(r.from)]);
    for (let k = 0; k < path.length; k += 1) chunks.add(this.map.chunkOf(path[k] as TileIndex));
    const key = this.cacheKey(r.from, r.to, r.cls);
    this.cache.delete(key);
    this.cache.set(key, { path: path.slice(), chunks: Array.from(chunks).sort((a, b) => a - b) });
    while (this.cache.size > PATH_CACHE_SIZE) {
      const oldest = this.cache.keys().next();
      if (oldest.done === true) break;
      this.cache.delete(oldest.value);
    }
  }

  /**
   * `22` § Path cache: a hit is spliced with a short A* from the requester's tile to the cached
   * path's first tile. Returns the spliced path, or null when there is no usable entry.
   */
  private cacheLookup(r: PathRequest): TileIndex[] | null {
    if (!this.cacheEnabled) return null;
    const entry = this.cache.get(this.cacheKey(r.from, r.to, r.cls));
    if (entry === undefined || entry.path.length === 0) return null;
    // Refresh the LRU order.
    const key = this.cacheKey(r.from, r.to, r.cls);
    this.cache.delete(key);
    this.cache.set(key, entry);
    const head = entry.path[0] as TileIndex;
    if (r.from === head) return entry.path.slice();
    const splice = this.searchImmediate(
      r.from,
      head,
      r.cls,
      PATH_CACHE_SPLICE_NODE_LIMIT,
      r.mover,
    );
    if (splice === null) return null;
    return splice.concat(entry.path.slice(1));
  }

  /** Drop every cached route that crosses one of the given chunks. */
  invalidateChunks(chunks: readonly ChunkIndex[]): void {
    if (chunks.length === 0 || this.cache.size === 0) return;
    const dirty = new Set(chunks);
    const doomed: string[] = [];
    this.cache.forEach((entry, key) => {
      for (let k = 0; k < entry.chunks.length; k += 1) {
        if (dirty.has(entry.chunks[k] as ChunkIndex)) {
          doomed.push(key);
          return;
        }
      }
    });
    for (let k = 0; k < doomed.length; k += 1) this.cache.delete(doomed[k] as string);
  }

  /** Number of cached routes; for tests and the debug panel. */
  get cacheSize(): number {
    return this.cache.size;
  }

  /**
   * A complete A* inside one call, bounded by `nodeLimit`. Used for the cache splice and by tests;
   * the request queue is the path every creature takes.
   */
  searchImmediate(
    from: TileIndex,
    to: TileIndex,
    cls: MovementClass,
    nodeLimit: number = PATH_NODE_LIMIT,
    mover: MoverOptions = NO_MOVER,
  ): TileIndex[] | null {
    if (!this.map.validIndex(from) || !this.map.validIndex(to)) return null;
    if (from === to) return [];
    const scratch = this.takeScratch();
    scratch.begin();
    scratch.relax(from, 0, -1);
    const open = new OpenSet();
    open.push(from, this.heuristic(from, to));
    let expanded = 0;
    let result: TileIndex[] | null = null;
    while (open.size > 0) {
      const cur = open.pop();
      if (cur === to) {
        const reversed: TileIndex[] = [];
        let walk = cur;
        while (walk !== from && walk >= 0) {
          reversed.push(walk);
          walk = scratch.parentOf(walk);
        }
        reversed.reverse();
        result = reversed;
        break;
      }
      if (scratch.isClosed(cur)) continue;
      scratch.close(cur);
      expanded += 1;
      if (expanded >= nodeLimit) break;
      const g = scratch.gOf(cur);
      this.graph.forEachEdge(
        cur,
        cls,
        (next, stepCost) => {
          const ng = g + stepCost;
          if (ng >= scratch.gOf(next)) return;
          scratch.relax(next, ng, cur);
          open.push(next, ng + this.heuristic(next, to));
        },
        mover,
      );
    }
    this.pool.push(scratch);
    return result;
  }
}

/**
 * The connectivity, graph and pathfinder of one map, wired together: the pathfinder consults the
 * labels, and the tick-end rebuild invalidates the routes whose chunks changed.
 */
export class PathingCore {
  readonly graph: TileGraph;
  readonly connectivity: Connectivity;
  readonly pathfinder: Pathfinder;

  constructor(map: Map3D, hooks: Partial<TerrainHooks> = {}, options: PathfinderOptions = {}) {
    this.graph = new TileGraph(map, hooks);
    this.connectivity = new Connectivity(map, this.graph);
    this.pathfinder = new Pathfinder(map, this.graph, this.connectivity, options);
    this.connectivity.rebuildAll();
  }

  /** `22` § Connectivity labels: the core phase between steps 2 and 3 of the tick. */
  onTickEnd(): void {
    const rebuilt = this.connectivity.rebuildDirty();
    if (rebuilt > 0) this.pathfinder.invalidateChunks(this.connectivity.lastRebuilt());
  }

  /** `readers.pathing` of `22` § Interfaces. */
  reader(): PathingCoreReader {
    return {
      reachable: (from, to, cls) => this.connectivity.reachable(from, to, cls),
      nearestReachable: (from, target, cls, limit) =>
        this.connectivity.nearestReachable(from, target, cls, limit),
      labelOf: (i, cls) => this.connectivity.label(i, cls),
      passable: (i, cls, mover) => this.graph.passable(i, cls, mover),
      cost: (i, cls, mover) => this.graph.cost(i, cls, mover),
      lineOfSight: (a, b) => this.graph.lineOfSight(a, b),
      requestPath: (entity, from, to, cls, urgency, opts, mover) =>
        this.pathfinder.requestPath(entity, from, to, cls, urgency, opts, mover),
      pathResult: (id) => this.pathfinder.pathResult(id),
    };
  }
}

/** The shape `readers.pathing` exposes (`22` § Interfaces). */
export interface PathingCoreReader {
  reachable(from: TileIndex, to: TileIndex, cls: MovementClass): boolean;
  nearestReachable(from: TileIndex, target: TileIndex, cls: MovementClass, limit: number): TileIndex;
  labelOf(i: TileIndex, cls: MovementClass): number;
  passable(i: TileIndex, cls: MovementClass, mover?: MoverOptions): boolean;
  cost(i: TileIndex, cls: MovementClass, mover?: MoverOptions): number;
  lineOfSight(a: TileIndex, b: TileIndex): boolean;
  requestPath(
    entity: EntityId,
    from: TileIndex,
    to: TileIndex,
    cls: MovementClass,
    urgency?: PathUrgency,
    opts?: PathOptions,
    mover?: MoverOptions,
  ): number;
  pathResult(id: number): PathResult;
}
