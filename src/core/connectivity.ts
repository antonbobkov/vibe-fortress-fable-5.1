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
 * Portals (DECISIONS.md D-100, superseding the re-check of D-020). A chunk keeps every edge that
 * leaves it as the tile pair that forms it, and, resolved from those, its component links
 * `(localA, chunkB, localB)` of the algorithm document, sorted and without repeats. Every fact an
 * edge depends on (both tiles, the corner tiles of a diagonal, the tiles a ramp or stair reads)
 * lies within one tile (in x, y and z) of the edge's source tile, so a change inside chunk `X`
 * can alter only the edges that leave a tile within one tile of `X`. When `X` is dirty, `X` is
 * rebuilt whole, the edges leaving the tiles of its 26 neighbours that lie within one tile of `X`
 * are recomputed, and the links of `X` and its neighbours are resolved again (their local labels
 * may have changed). The portals and links are then exactly what a full rebuild would produce, and
 * the union-find over the links (a few thousand entries, `22`: "well under 1 ms") runs only for
 * the classes whose component graph changed. The labels are those of a full rebuild: a component's
 * global label is one more than the smallest global component number of its set, and both the
 * numbering (chunk order, then local label) and the sets depend only on the counts and links.
 */

import { CHUNK_SIZE } from './constants';
import { MOVEMENT_CLASSES, movementClassCode } from './components';
import type { Map3D } from './map3d';
import type { ChunkIndex, MovementClass, TileIndex } from './types';

/** The part of the tile graph connectivity needs. Implemented by `TileGraph` in `pathfinding.ts`. */
export interface ConnectivityGraph {
  passable(i: TileIndex, cls: MovementClass): boolean;
  /**
   * `22` § Edges: a tile a diagonal step may not cut past (`wall`, `tree`, `boulder`,
   * `fortification`). A diagonal between two passable tiles exists when neither of its two corner
   * tiles is one.
   */
  cornerBlocks(i: TileIndex): boolean;
  /** Only the stairs and ramp edges (every one of them leaves the tile's chunk). */
  forEachVerticalLink(i: TileIndex, cls: MovementClass, fn: (to: TileIndex) => void): void;
}

/** The chunk edge, as a module constant for the inner loops. */
const SIZE = CHUNK_SIZE;

/** Local labels are 1-based and a chunk holds at most `CHUNK_SIZE²` tiles. */
const LOCAL_STRIDE = CHUNK_SIZE * CHUNK_SIZE;

/** Per-class label state. */
interface ClassLabels {
  /** Component number within its chunk, 1-based; 0 means impassable. */
  readonly local: Uint16Array;
  /** Component count per chunk. */
  readonly counts: Uint16Array;
  /** Flat `[tileA, tileB, ...]` per chunk: every edge that leaves it. */
  readonly portals: number[][];
  /**
   * Per chunk, the sorted distinct component links `localA × linkBase + chunkB × LOCAL_STRIDE +
   * localB − 1` resolved from its portals.
   */
  readonly links: number[][];
  /** Start of a chunk's component block in the global arrays. */
  readonly offsets: Int32Array;
  /** Global label per component, 1-based; index `offsets[chunk] + local - 1`. */
  globals: Int32Array;
}

/** How much of a clean neighbour's portal list a dirty chunk can change, per tile. */
const NEAR_NONE = 0;
/** The tile lies on another level than the dirty chunk: only its stairs and ramp edges. */
const NEAR_VERTICAL = 1;
/** The tile lies on the dirty chunk's level: every edge. */
const NEAR_ALL = 2;

export class Connectivity {
  private readonly map: Map3D;
  private readonly graph: ConnectivityGraph;
  private readonly classes: readonly MovementClass[];
  private readonly labels: ClassLabels[];
  /** `localA` is multiplied by this in a link; every `chunkB × LOCAL_STRIDE + localB − 1` is below it. */
  private readonly linkBase: number;
  /** Chunks rebuilt by the most recent {@link rebuildDirty}; consumed by the path cache. */
  private lastDirty: ChunkIndex[] = [];
  /** How many times each class's union-find has run, for tests and the debug panel. */
  private readonly globalRuns = new Array<number>(MOVEMENT_CLASSES.length).fill(0);

  // Scratch space, reused by every rebuild.
  private readonly stack: TileIndex[] = [];
  private masks = new Uint8Array(0);
  private readonly pass = new Uint8Array(LOCAL_STRIDE);
  private readonly solid = new Uint8Array(LOCAL_STRIDE);
  private linkSort = new Float64Array(64);
  private parent = new Int32Array(0);
  private readonly dirtyStamp: Uint32Array;
  private readonly hoodStamp: Uint32Array;
  private stamp = 0;
  // The portal scan's current list and source tile, read by the edge callback below.
  private portalOut: number[] = [];
  private portalFrom = 0;

  constructor(map: Map3D, graph: ConnectivityGraph, classes: readonly MovementClass[] = MOVEMENT_CLASSES) {
    this.map = map;
    this.graph = graph;
    this.classes = classes;
    const tiles = map.tileCount;
    const chunks = map.chunkCount;
    this.linkBase = chunks * LOCAL_STRIDE;
    this.labels = MOVEMENT_CLASSES.map(() => ({
      local: new Uint16Array(tiles),
      counts: new Uint16Array(chunks),
      portals: Array.from({ length: chunks }, () => [] as number[]),
      links: Array.from({ length: chunks }, () => [] as number[]),
      offsets: new Int32Array(chunks),
      globals: new Int32Array(0),
    }));
    this.dirtyStamp = new Uint32Array(chunks);
    this.hoodStamp = new Uint32Array(chunks);
  }

  private stateOf(cls: MovementClass): ClassLabels {
    return this.labels[movementClassCode(cls)] as ClassLabels;
  }

  /** The chunks rebuilt by the last {@link rebuildDirty}, ascending. */
  lastRebuilt(): readonly ChunkIndex[] {
    return this.lastDirty;
  }

  // ---------- chunk geometry ----------

  private chunkX0(c: ChunkIndex): number {
    return (c % this.map.chunksPerRow) * SIZE;
  }

  private chunkY0(c: ChunkIndex): number {
    return (Math.floor(c / this.map.chunksPerRow) % this.map.chunksPerCol) * SIZE;
  }

  private chunkZ(c: ChunkIndex): number {
    return Math.floor(c / (this.map.chunksPerRow * this.map.chunksPerCol));
  }

  // ---------- per-chunk rebuild ----------

  private readonly portalEdge = (to: TileIndex): void => {
    this.portalOut.push(this.portalFrom, to);
  };

  /**
   * Recompute one chunk's local components: a flood fill over the eight same-level edges that stay
   * inside the chunk (`22` § Edges), with each tile's passability read once.
   */
  private rebuildLocal(c: ChunkIndex, cls: MovementClass, state: ClassLabels): void {
    const map = this.map;
    const graph = this.graph;
    const x0 = this.chunkX0(c);
    const y0 = this.chunkY0(c);
    const z = this.chunkZ(c);
    const pw = Math.min(map.w, x0 + SIZE) - x0;
    const ph = Math.min(map.h, y0 + SIZE) - y0;
    const local = state.local;
    const pass = this.pass;
    const solid = this.solid;
    for (let ly = 0; ly < ph; ly += 1) {
      const row = map.index(x0, y0 + ly, z);
      for (let lx = 0; lx < pw; lx += 1) {
        local[row + lx] = 0;
        pass[ly * SIZE + lx] = graph.passable(row + lx, cls) ? 1 : 0;
        solid[ly * SIZE + lx] = graph.cornerBlocks(row + lx) ? 1 : 0;
      }
    }
    let count = 0;
    const stack = this.stack;
    for (let ly = 0; ly < ph; ly += 1) {
      for (let lx = 0; lx < pw; lx += 1) {
        if (pass[ly * SIZE + lx] === 0) continue;
        const start = map.index(x0 + lx, y0 + ly, z);
        if (local[start] !== 0) continue;
        count += 1;
        local[start] = count;
        stack.length = 0;
        stack.push(start);
        while (stack.length > 0) {
          const cur = stack.pop() as TileIndex;
          const cx = map.xOf(cur) - x0;
          const cy = map.yOf(cur) - y0;
          for (let dy = -1; dy <= 1; dy += 1) {
            const ny = cy + dy;
            if (ny < 0 || ny >= ph) continue;
            for (let dx = -1; dx <= 1; dx += 1) {
              if (dx === 0 && dy === 0) continue;
              const nx = cx + dx;
              if (nx < 0 || nx >= pw) continue;
              if (pass[ny * SIZE + nx] === 0) continue;
              const j = cur + dy * map.w + dx;
              if (local[j] !== 0) continue;
              // A diagonal's two corner tiles lie inside the chunk too.
              if (dx !== 0 && dy !== 0 && (solid[cy * SIZE + nx] === 1 || solid[ny * SIZE + cx] === 1)) continue;
              local[j] = count;
              stack.push(j);
            }
          }
        }
      }
    }
    state.counts[c] = count;
  }

  /**
   * The edges of one passable tile that leave its chunk, appended to `out`: its same-level edges
   * into other chunks (`horizontal`, only for a tile on the chunk's rim) and its stairs and ramp
   * edges.
   */
  private scanTile(i: TileIndex, c: ChunkIndex, cls: MovementClass, horizontal: boolean, out: number[]): void {
    const map = this.map;
    const graph = this.graph;
    if (horizontal) {
      const x = map.xOf(i);
      const y = map.yOf(i);
      const z = map.zOf(i);
      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= map.h) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= map.w) continue;
          const j = map.index(nx, ny, z);
          if (map.chunkOf(j) === c) continue;
          if (!graph.passable(j, cls)) continue;
          if (dx !== 0 && dy !== 0 && (graph.cornerBlocks(map.index(nx, y, z)) || graph.cornerBlocks(map.index(x, ny, z)))) continue;
          out.push(i, j);
        }
      }
    }
    this.portalOut = out;
    this.portalFrom = i;
    graph.forEachVerticalLink(i, cls, this.portalEdge);
  }

  /** Recompute every edge that leaves one chunk. */
  private rebuildPortals(c: ChunkIndex, cls: MovementClass, state: ClassLabels): void {
    const map = this.map;
    const x0 = this.chunkX0(c);
    const y0 = this.chunkY0(c);
    const z = this.chunkZ(c);
    const x1 = Math.min(map.w, x0 + SIZE);
    const y1 = Math.min(map.h, y0 + SIZE);
    const portals = state.portals[c] as number[];
    portals.length = 0;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = map.index(x, y, z);
        if (state.local[i] === 0) continue;
        // Only a tile on the chunk's rim has same-level neighbours in another chunk.
        const rim = x === x0 || y === y0 || x === x1 - 1 || y === y1 - 1;
        this.scanTile(i, c, cls, rim, portals);
      }
    }
  }

  /**
   * Recompute the edges of a clean chunk `p` that leave a tile within one tile of a dirty chunk;
   * the rest of its portal list cannot have changed.
   */
  private refreshPortalsNear(p: ChunkIndex, cls: MovementClass, state: ClassLabels, mask: Uint8Array): void {
    const map = this.map;
    const x0 = this.chunkX0(p);
    const y0 = this.chunkY0(p);
    const z = this.chunkZ(p);
    const pw = Math.min(map.w, x0 + SIZE) - x0;
    const portals = state.portals[p] as number[];
    const wh = map.w * map.h;
    // Keep the edges whose source is not near, and a near-vertical source's same-level edges.
    let kept = 0;
    for (let k = 0; k < portals.length; k += 2) {
      const a = portals[k] as number;
      const b = portals[k + 1] as number;
      const m = mask[(map.yOf(a) - y0) * SIZE + (map.xOf(a) - x0)] as number;
      if (m === NEAR_ALL) continue;
      if (m === NEAR_VERTICAL && Math.floor(b / wh) !== z) continue;
      portals[kept] = a;
      portals[kept + 1] = b;
      kept += 2;
    }
    portals.length = kept;
    const ph = Math.min(map.h, y0 + SIZE) - y0;
    for (let ly = 0; ly < ph; ly += 1) {
      for (let lx = 0; lx < pw; lx += 1) {
        const m = mask[ly * SIZE + lx] as number;
        if (m === NEAR_NONE) continue;
        const i = map.index(x0 + lx, y0 + ly, z);
        if (state.local[i] === 0) continue;
        this.scanTile(i, p, cls, m === NEAR_ALL, portals);
      }
    }
  }

  /** Resolve a chunk's portals to its sorted distinct component links; true when they changed. */
  private resolveLinks(c: ChunkIndex, state: ClassLabels): boolean {
    const portals = state.portals[c] as number[];
    if (this.linkSort.length < portals.length) this.linkSort = new Float64Array(portals.length * 2);
    const scratch = this.linkSort;
    let m = 0;
    for (let k = 0; k < portals.length; k += 2) {
      const a = portals[k] as number;
      const b = portals[k + 1] as number;
      const la = state.local[a] as number;
      const lb = state.local[b] as number;
      if (la === 0 || lb === 0) continue;
      scratch[m] = la * this.linkBase + this.map.chunkOf(b) * LOCAL_STRIDE + lb - 1;
      m += 1;
    }
    const sorted = scratch.subarray(0, m).sort();
    const links = state.links[c] as number[];
    let n = 0;
    let changed = false;
    for (let k = 0; k < m; k += 1) {
      const v = sorted[k] as number;
      if (n > 0 && links[n - 1] === v) continue;
      if (n >= links.length || links[n] !== v) changed = true;
      links[n] = v;
      n += 1;
    }
    if (links.length !== n) {
      changed = true;
      links.length = n;
    }
    return changed;
  }

  /** Recompute one chunk's local components and its outgoing portals for one class. */
  rebuildChunk(c: ChunkIndex, cls: MovementClass): void {
    const state = this.stateOf(cls);
    this.rebuildLocal(c, cls, state);
    this.rebuildPortals(c, cls, state);
    this.resolveLinks(c, state);
  }

  /** Rebuild the union-find of one class over every chunk's components and links. */
  rebuildGlobal(cls: MovementClass): void {
    const state = this.stateOf(cls);
    this.globalRuns[movementClassCode(cls)] = (this.globalRuns[movementClassCode(cls)] as number) + 1;
    const chunks = this.map.chunkCount;
    let total = 0;
    for (let c = 0; c < chunks; c += 1) {
      state.offsets[c] = total;
      total += state.counts[c] as number;
    }
    if (this.parent.length < total) this.parent = new Int32Array(Math.max(total, this.parent.length * 2));
    const parent = this.parent;
    for (let g = 0; g < total; g += 1) parent[g] = g;
    const find = (a: number): number => {
      let root = a;
      while ((parent[root] as number) !== root) root = parent[root] as number;
      let walk = a;
      while ((parent[walk] as number) !== root) {
        const next = parent[walk] as number;
        parent[walk] = root;
        walk = next;
      }
      return root;
    };
    const base = this.linkBase;
    for (let c = 0; c < chunks; c += 1) {
      const links = state.links[c] as number[];
      if (links.length === 0) continue;
      const offset = state.offsets[c] as number;
      for (let k = 0; k < links.length; k += 1) {
        const v = links[k] as number;
        const la = Math.floor(v / base);
        const key = v - la * base;
        const cb = Math.floor(key / LOCAL_STRIDE);
        const ra = find(offset + la - 1);
        const rb = find((state.offsets[cb] as number) + (key - cb * LOCAL_STRIDE));
        if (ra === rb) continue;
        // The smaller root wins, so the labels do not depend on the order of the unions.
        if (ra < rb) parent[rb] = ra;
        else parent[ra] = rb;
      }
    }
    if (state.globals.length < total) state.globals = new Int32Array(Math.max(total, state.globals.length * 2));
    const globals = state.globals;
    for (let g = 0; g < total; g += 1) globals[g] = find(g) + 1;
  }

  /** Recompute everything, for every class. */
  rebuildAll(): void {
    const chunks = this.map.chunkCount;
    for (let k = 0; k < this.classes.length; k += 1) {
      const cls = this.classes[k] as MovementClass;
      const state = this.stateOf(cls);
      for (let c = 0; c < chunks; c += 1) this.rebuildLocal(c, cls, state);
      for (let c = 0; c < chunks; c += 1) this.rebuildPortals(c, cls, state);
      for (let c = 0; c < chunks; c += 1) this.resolveLinks(c, state);
      this.rebuildGlobal(cls);
    }
    for (let c = 0; c < chunks; c += 1) {
      const rec = this.map.chunk(c);
      if (rec !== undefined) rec.dirtyPath = false;
    }
    this.lastDirty = [];
  }

  /**
   * `onTickEnd()` of the algorithm document: rebuild every chunk marked `dirtyPath` (with the
   * edges its neighbours send into it), then the union-find of every class whose component graph
   * changed. Returns the number of chunks rebuilt.
   */
  rebuildDirty(): number {
    const map = this.map;
    const dirty: ChunkIndex[] = [];
    for (let c = 0; c < map.chunkCount; c += 1) {
      if (map.chunk(c)?.dirtyPath === true) dirty.push(c);
    }
    this.lastDirty = dirty;
    if (dirty.length === 0) return 0;
    this.stamp += 1;
    const stamp = this.stamp;
    for (let d = 0; d < dirty.length; d += 1) this.dirtyStamp[dirty[d] as ChunkIndex] = stamp;
    const hood = this.neighbourhood(dirty, stamp);
    const cells = LOCAL_STRIDE;
    if (this.masks.length < hood.length * cells) this.masks = new Uint8Array(hood.length * cells * 2);
    for (let h = 0; h < hood.length; h += 1) {
      const p = hood[h] as ChunkIndex;
      if (this.dirtyStamp[p] !== stamp) this.nearMask(p, stamp, this.masks.subarray(h * cells, (h + 1) * cells));
    }

    for (let k = 0; k < this.classes.length; k += 1) {
      const cls = this.classes[k] as MovementClass;
      const state = this.stateOf(cls);
      let changed = false;
      for (let d = 0; d < dirty.length; d += 1) {
        const c = dirty[d] as ChunkIndex;
        const before = state.counts[c] as number;
        this.rebuildLocal(c, cls, state);
        if (state.counts[c] !== before) changed = true;
      }
      for (let d = 0; d < dirty.length; d += 1) this.rebuildPortals(dirty[d] as ChunkIndex, cls, state);
      for (let h = 0; h < hood.length; h += 1) {
        const p = hood[h] as ChunkIndex;
        if (this.dirtyStamp[p] === stamp) continue;
        this.refreshPortalsNear(p, cls, state, this.masks.subarray(h * cells, (h + 1) * cells));
      }
      for (let h = 0; h < hood.length; h += 1) {
        if (this.resolveLinks(hood[h] as ChunkIndex, state)) changed = true;
      }
      if (changed) this.rebuildGlobal(cls);
    }
    for (let d = 0; d < dirty.length; d += 1) {
      const rec = map.chunk(dirty[d] as ChunkIndex);
      if (rec !== undefined) rec.dirtyPath = false;
    }
    return dirty.length;
  }

  /** The dirty chunks and every chunk within one chunk of one (26-neighbourhood), ascending. */
  private neighbourhood(dirty: readonly ChunkIndex[], stamp: number): ChunkIndex[] {
    const map = this.map;
    const out: ChunkIndex[] = [];
    const perLayer = map.chunksPerRow * map.chunksPerCol;
    for (let d = 0; d < dirty.length; d += 1) {
      const c = dirty[d] as ChunkIndex;
      const cx = c % map.chunksPerRow;
      const cy = Math.floor(c / map.chunksPerRow) % map.chunksPerCol;
      const cz = Math.floor(c / perLayer);
      for (let dz = -1; dz <= 1; dz += 1) {
        const z = cz + dz;
        if (z < 0 || z >= map.d) continue;
        for (let dy = -1; dy <= 1; dy += 1) {
          const y = cy + dy;
          if (y < 0 || y >= map.chunksPerCol) continue;
          for (let dx = -1; dx <= 1; dx += 1) {
            const x = cx + dx;
            if (x < 0 || x >= map.chunksPerRow) continue;
            const n = (z * map.chunksPerCol + y) * map.chunksPerRow + x;
            if (this.hoodStamp[n] === stamp) continue;
            this.hoodStamp[n] = stamp;
            out.push(n);
          }
        }
      }
    }
    out.sort((a, b) => a - b);
    return out;
  }

  /**
   * Which tiles of the clean chunk `p` lie within one tile of a dirty chunk (`NEAR_ALL` on the
   * dirty chunk's level, `NEAR_VERTICAL` a level above or below it), as a 16 × 16 mask.
   */
  private nearMask(p: ChunkIndex, stamp: number, mask: Uint8Array): void {
    const map = this.map;
    mask.fill(NEAR_NONE);
    const perLayer = map.chunksPerRow * map.chunksPerCol;
    const px = p % map.chunksPerRow;
    const py = Math.floor(p / map.chunksPerRow) % map.chunksPerCol;
    const pz = Math.floor(p / perLayer);
    const x0 = px * SIZE;
    const y0 = py * SIZE;
    const pw = Math.min(map.w, x0 + SIZE) - x0;
    const ph = Math.min(map.h, y0 + SIZE) - y0;
    for (let dz = -1; dz <= 1; dz += 1) {
      const z = pz + dz;
      if (z < 0 || z >= map.d) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        const y = py + dy;
        if (y < 0 || y >= map.chunksPerCol) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const x = px + dx;
          if (x < 0 || x >= map.chunksPerRow) continue;
          const n = (z * map.chunksPerCol + y) * map.chunksPerRow + x;
          if (this.dirtyStamp[n] !== stamp) continue;
          // The dirty chunk's box grown by one tile, in `p`'s local coordinates.
          const nx0 = x * SIZE - 1 - x0;
          const ny0 = y * SIZE - 1 - y0;
          const nx1 = Math.min(map.w, (x + 1) * SIZE) - x0; // inclusive after the grow
          const ny1 = Math.min(map.h, (y + 1) * SIZE) - y0;
          const value = dz === 0 ? NEAR_ALL : NEAR_VERTICAL;
          for (let ly = Math.max(0, ny0); ly <= Math.min(ph - 1, ny1); ly += 1) {
            for (let lx = Math.max(0, nx0); lx <= Math.min(pw - 1, nx1); lx += 1) {
              const at = ly * SIZE + lx;
              if ((mask[at] as number) < value) mask[at] = value;
            }
          }
        }
      }
    }
  }

  /** The global label of a tile, or 0 when it is impassable for the class. */
  label(i: TileIndex, cls: MovementClass): number {
    if (!this.map.validIndex(i)) return 0;
    const state = this.stateOf(cls);
    const local = state.local[i] as number;
    if (local === 0) return 0;
    return state.globals[(state.offsets[this.map.chunkOf(i)] as number) + local - 1] ?? 0;
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

  /** How many times each class's union-find has run since construction. */
  globalRebuilds(): Record<MovementClass, number> {
    const out = {} as Record<MovementClass, number>;
    for (let k = 0; k < MOVEMENT_CLASSES.length; k += 1) out[MOVEMENT_CLASSES[k] as MovementClass] = this.globalRuns[k] as number;
    return out;
  }

  /** Number of local components in a chunk, for tests and the debug overlay. */
  componentCount(c: ChunkIndex, cls: MovementClass): number {
    return this.stateOf(cls).counts[c] as number;
  }
}
