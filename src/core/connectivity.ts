/**
 * Connectivity labels.
 *
 * Implements `02-systems/22-pathfinding-and-spatial.md` § Connectivity labels and
 * `04-implementation/algorithms/pathfinding-and-connectivity.md` § Connectivity labels: the
 * two-level scheme of per-chunk local components joined by portals through a union-find, rebuilt
 * for the chunks marked `dirtyPath` at the end of every tick, so that `label(tile)` is exact at
 * the start of every tick.
 *
 * `amphibious` gets its own label set, computed with amphibious passability, exactly as the
 * algorithm document prescribes.
 *
 * Portals are stored as the tile pair that forms the crossing edge, not as the pair of local
 * labels: a chunk's neighbours are not rebuilt when it changes, so a stored local label can go
 * stale. Resolving the labels (and re-checking the edge) at global-rebuild time is exact.
 * See DECISIONS.md D-020.
 */

import { CHUNK_SIZE } from './constants';
import { MOVEMENT_CLASSES, movementClassCode } from './components';
import type { Map3D } from './map3d';
import type { ChunkIndex, MovementClass, TileIndex } from './types';

/** The part of the tile graph connectivity needs. Implemented by `TileGraph` in `pathfinding.ts`. */
export interface ConnectivityGraph {
  passable(i: TileIndex, cls: MovementClass): boolean;
  /** Every edge leaving `i`, horizontal and vertical. */
  forEachEdge(i: TileIndex, cls: MovementClass, fn: (to: TileIndex, stepCost: number) => void): void;
  /** Only the eight same-level edges, used by the within-chunk flood fill. */
  forEachHorizontalEdge(
    i: TileIndex,
    cls: MovementClass,
    fn: (to: TileIndex, stepCost: number) => void,
  ): void;
  /** True when an edge from `a` to `b` exists for the class. */
  hasEdge(a: TileIndex, b: TileIndex, cls: MovementClass): boolean;
}

/** A union-find over the chunk components of one movement class. */
class UnionFind {
  private readonly parent: Int32Array;

  constructor(size: number) {
    this.parent = new Int32Array(size);
    for (let i = 0; i < size; i += 1) this.parent[i] = i;
  }

  find(a: number): number {
    let root = a;
    while ((this.parent[root] as number) !== root) root = this.parent[root] as number;
    let walk = a;
    while ((this.parent[walk] as number) !== walk) {
      const next = this.parent[walk] as number;
      this.parent[walk] = root;
      walk = next;
    }
    return root;
  }

  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    // The smaller root wins, so the labels do not depend on the order of the unions.
    if (ra < rb) this.parent[rb] = ra;
    else this.parent[ra] = rb;
  }
}

/** Per-class label state. */
interface ClassLabels {
  /** Component number within its chunk, 1-based; 0 means impassable. */
  readonly local: Uint16Array;
  /** Component count per chunk. */
  readonly counts: Uint16Array;
  /** Flat `[tileA, tileB, ...]` per chunk of the edges that leave it. */
  readonly portals: number[][];
  /** Start of a chunk's component block in the global arrays. */
  offsets: Int32Array;
  /** Global label per component, 1-based; index `offsets[chunk] + local - 1`. */
  globals: Int32Array;
}

export class Connectivity {
  private readonly map: Map3D;
  private readonly graph: ConnectivityGraph;
  private readonly classes: readonly MovementClass[];
  private readonly labels: ClassLabels[];
  /** Chunks rebuilt by the most recent {@link rebuildDirty}; consumed by the path cache. */
  private lastDirty: ChunkIndex[] = [];

  constructor(map: Map3D, graph: ConnectivityGraph, classes: readonly MovementClass[] = MOVEMENT_CLASSES) {
    this.map = map;
    this.graph = graph;
    this.classes = classes;
    const tiles = map.tileCount;
    const chunks = map.chunkCount;
    this.labels = MOVEMENT_CLASSES.map(() => ({
      local: new Uint16Array(tiles),
      counts: new Uint16Array(chunks),
      portals: Array.from({ length: chunks }, () => [] as number[]),
      offsets: new Int32Array(chunks),
      globals: new Int32Array(0),
    }));
  }

  private stateOf(cls: MovementClass): ClassLabels {
    return this.labels[movementClassCode(cls)] as ClassLabels;
  }

  /** The chunks rebuilt by the last {@link rebuildDirty}, ascending. */
  lastRebuilt(): readonly ChunkIndex[] {
    return this.lastDirty;
  }

  /** Recompute one chunk's local components and its outgoing portals for one class. */
  rebuildChunk(c: ChunkIndex, cls: MovementClass): void {
    const state = this.stateOf(cls);
    const tiles = this.tilesOf(c);
    for (let k = 0; k < tiles.length; k += 1) state.local[tiles[k] as TileIndex] = 0;
    let count = 0;
    const stack: TileIndex[] = [];
    for (let k = 0; k < tiles.length; k += 1) {
      const start = tiles[k] as TileIndex;
      if (state.local[start] !== 0) continue;
      if (!this.graph.passable(start, cls)) continue;
      count += 1;
      state.local[start] = count;
      stack.length = 0;
      stack.push(start);
      while (stack.length > 0) {
        const cur = stack.pop() as TileIndex;
        this.graph.forEachHorizontalEdge(cur, cls, (to) => {
          if (this.map.chunkOf(to) !== c) return;
          if (state.local[to] !== 0) return;
          state.local[to] = count;
          stack.push(to);
        });
      }
    }
    state.counts[c] = count;
    const portals = state.portals[c] as number[];
    portals.length = 0;
    for (let k = 0; k < tiles.length; k += 1) {
      const i = tiles[k] as TileIndex;
      if (state.local[i] === 0) continue;
      this.graph.forEachEdge(i, cls, (to) => {
        if (this.map.chunkOf(to) === c) return;
        portals.push(i, to);
      });
    }
  }

  /** Rebuild the union-find of one class over every chunk's components and portals. */
  rebuildGlobal(cls: MovementClass): void {
    const state = this.stateOf(cls);
    const chunks = this.map.chunkCount;
    let total = 0;
    for (let c = 0; c < chunks; c += 1) {
      state.offsets[c] = total;
      total += state.counts[c] as number;
    }
    const uf = new UnionFind(total);
    for (let c = 0; c < chunks; c += 1) {
      const portals = state.portals[c] as number[];
      for (let p = 0; p < portals.length; p += 2) {
        const a = portals[p] as TileIndex;
        const b = portals[p + 1] as TileIndex;
        const la = state.local[a] as number;
        const lb = state.local[b] as number;
        if (la === 0 || lb === 0) continue;
        if (!this.graph.hasEdge(a, b, cls)) continue;
        uf.union(this.gid(state, a, la), this.gid(state, b, lb));
      }
    }
    const globals = new Int32Array(total);
    for (let g = 0; g < total; g += 1) globals[g] = uf.find(g) + 1;
    state.globals = globals;
  }

  private gid(state: ClassLabels, tile: TileIndex, local: number): number {
    return (state.offsets[this.map.chunkOf(tile)] as number) + local - 1;
  }

  /** Recompute everything, for every class. */
  rebuildAll(): void {
    for (let k = 0; k < this.classes.length; k += 1) {
      const cls = this.classes[k] as MovementClass;
      for (let c = 0; c < this.map.chunkCount; c += 1) this.rebuildChunk(c, cls);
      this.rebuildGlobal(cls);
    }
    for (let c = 0; c < this.map.chunkCount; c += 1) {
      const rec = this.map.chunk(c);
      if (rec !== undefined) rec.dirtyPath = false;
    }
    this.lastDirty = [];
  }

  /**
   * `onTickEnd()` of the algorithm document: rebuild every chunk marked `dirtyPath`, then the
   * union-find of every class. Returns the number of chunks rebuilt.
   */
  rebuildDirty(): number {
    const dirty: ChunkIndex[] = [];
    for (let c = 0; c < this.map.chunkCount; c += 1) {
      if (this.map.chunk(c)?.dirtyPath === true) dirty.push(c);
    }
    this.lastDirty = dirty;
    if (dirty.length === 0) return 0;
    for (let k = 0; k < this.classes.length; k += 1) {
      const cls = this.classes[k] as MovementClass;
      for (let d = 0; d < dirty.length; d += 1) this.rebuildChunk(dirty[d] as ChunkIndex, cls);
    }
    for (let k = 0; k < this.classes.length; k += 1) this.rebuildGlobal(this.classes[k] as MovementClass);
    for (let d = 0; d < dirty.length; d += 1) {
      const rec = this.map.chunk(dirty[d] as ChunkIndex);
      if (rec !== undefined) rec.dirtyPath = false;
    }
    return dirty.length;
  }

  /** The global label of a tile, or 0 when it is impassable for the class. */
  label(i: TileIndex, cls: MovementClass): number {
    if (!this.map.validIndex(i)) return 0;
    const state = this.stateOf(cls);
    const local = state.local[i] as number;
    if (local === 0) return 0;
    return state.globals[this.gid(state, i, local)] ?? 0;
  }

  /** Label equality, the whole of `reachable` (`22` § Connectivity labels). */
  reachable(from: TileIndex, to: TileIndex, cls: MovementClass): boolean {
    const a = this.label(from, cls);
    if (a === 0) return false;
    return a === this.label(to, cls);
  }

  /**
   * BFS outward from `target` over passable tiles until one shares `from`'s label, bounded by
   * `limit` visited tiles. -1 when none is found inside the bound.
   */
  nearestReachable(from: TileIndex, target: TileIndex, cls: MovementClass, limit: number): TileIndex {
    const want = this.label(from, cls);
    if (want === 0) return -1;
    if (this.label(target, cls) === want) return target;
    const seen = new Set<TileIndex>([target]);
    let frontier: TileIndex[] = [target];
    let visited = 0;
    while (frontier.length > 0 && visited < limit) {
      const next: TileIndex[] = [];
      for (let k = 0; k < frontier.length && visited < limit; k += 1) {
        const cur = frontier[k] as TileIndex;
        visited += 1;
        const neighbours = this.map.neighbors26(cur);
        neighbours.sort((a, b) => a - b);
        for (let n = 0; n < neighbours.length; n += 1) {
          const j = neighbours[n] as TileIndex;
          if (seen.has(j)) continue;
          seen.add(j);
          if (!this.graph.passable(j, cls)) continue;
          if (this.label(j, cls) === want) return j;
          next.push(j);
        }
      }
      frontier = next;
    }
    return -1;
  }

  /** Number of local components in a chunk, for tests and the debug overlay. */
  componentCount(c: ChunkIndex, cls: MovementClass): number {
    return this.stateOf(cls).counts[c] as number;
  }

  /** The tiles of a chunk in ascending index order. */
  private tilesOf(c: ChunkIndex): TileIndex[] {
    const perLayer = this.map.chunksPerRow * this.map.chunksPerCol;
    const z = Math.floor(c / perLayer);
    const within = c % perLayer;
    const cy = Math.floor(within / this.map.chunksPerRow);
    const cx = within % this.map.chunksPerRow;
    const x0 = cx * CHUNK_SIZE;
    const y0 = cy * CHUNK_SIZE;
    const x1 = Math.min(this.map.w, x0 + CHUNK_SIZE);
    const y1 = Math.min(this.map.h, y0 + CHUNK_SIZE);
    const out: TileIndex[] = [];
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) out.push(this.map.index(x, y, z));
    }
    return out;
  }
}
