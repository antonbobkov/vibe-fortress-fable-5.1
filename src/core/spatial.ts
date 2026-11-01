/**
 * The spatial index.
 *
 * Implements `02-systems/22-pathfinding-and-spatial.md` § Spatial index: per chunk a sorted
 * `EntityId[]` of the entities with a `Position` inside it, plus the queries `at`, `inRadius`,
 * `inBox` and `nearest`. The buckets themselves live on the `ChunkRecord`s of `Map3D`
 * (`data-model.md` § Chunks), so nothing else has to be kept in step with them.
 *
 * Distances are Chebyshev, the metric the A* heuristic and the rest of 22 use.
 */

import { C, type Position } from './components';
import { CHUNK_SIZE } from './constants';
import { NO_ENTITY } from './entities';
import type { EntityKind, EntityStore } from './entities';
import type { Map3D } from './map3d';
import type { ChunkIndex, EntityId, TileIndex } from './types';

export type EntityPredicate = (id: EntityId) => boolean;

const EMPTY: readonly EntityId[] = Object.freeze([]);

/** Chebyshev distance between two tiles of the same map. */
export function chebyshev(map: Map3D, a: TileIndex, b: TileIndex): number {
  const dx = Math.abs(map.xOf(a) - map.xOf(b));
  const dy = Math.abs(map.yOf(a) - map.yOf(b));
  const dz = Math.abs(map.zOf(a) - map.zOf(b));
  return Math.max(dx, dy, dz);
}

export class SpatialIndex {
  private readonly map: Map3D;
  private readonly entities: EntityStore;
  private readonly tiles = new Map<TileIndex, Set<EntityId>>();
  private readonly kinds = new Map<ChunkIndex, Map<EntityKind, Set<EntityId>>>();

  private index(id: EntityId, tile: TileIndex, add: boolean): void {
    if (!this.map.validIndex(tile)) return;
    const chunk = this.map.chunkOf(tile);
    const kind = this.entities.kind(id);
    if (add) {
      let at = this.tiles.get(tile);
      if (at === undefined) { at = new Set(); this.tiles.set(tile, at); }
      at.add(id);
      if (kind === undefined) return;
      let byKind = this.kinds.get(chunk);
      if (byKind === undefined) { byKind = new Map(); this.kinds.set(chunk, byKind); }
      let ids = byKind.get(kind);
      if (ids === undefined) { ids = new Set(); byKind.set(kind, ids); }
      ids.add(id);
    } else {
      const at = this.tiles.get(tile);
      at?.delete(id);
      if (at?.size === 0) this.tiles.delete(tile);
      // Removal can follow entity destruction, when the kind is no longer available.
      for (const ids of this.kinds.get(chunk)?.values() ?? []) ids.delete(id);
    }
  }

  constructor(map: Map3D, entities: EntityStore) {
    this.map = map;
    this.entities = entities;
  }

  /** The tile an entity's `Position` names, or -1 when it has none. */
  tileOf(id: EntityId): TileIndex {
    const p = this.entities.get<Position>(id, C.Position);
    if (p === undefined) return -1;
    if (!this.map.inBounds(p.x, p.y, p.z)) return -1;
    return this.map.index(p.x, p.y, p.z);
  }

  /** Add an entity to the bucket of `tile`'s chunk. Idempotent. */
  insert(id: EntityId, tile: TileIndex): void {
    if (!this.map.validIndex(tile)) return;
    this.map.addEntityToChunk(this.map.chunkOf(tile), id);
    this.index(id, tile, true);
  }

  /** Remove an entity from the bucket of `tile`'s chunk. */
  remove(id: EntityId, tile: TileIndex): void {
    if (!this.map.validIndex(tile)) return;
    this.map.removeEntityFromChunk(this.map.chunkOf(tile), id);
    this.index(id, tile, false);
  }

  /** `spatial.move(id, a, b)` touches two buckets, and only when the chunk differs. */
  move(id: EntityId, from: TileIndex, to: TileIndex): void {
    this.index(id, from, false);
    this.index(id, to, true);
    const a = this.map.validIndex(from) ? this.map.chunkOf(from) : -1;
    const b = this.map.validIndex(to) ? this.map.chunkOf(to) : -1;
    if (a === b) return;
    if (a >= 0) this.map.removeEntityFromChunk(a, id);
    if (b >= 0) this.map.addEntityToChunk(b, id);
  }

  /** Rebuild every bucket from the entity store; used after a load. */
  rebuild(): void {
    this.tiles.clear();
    this.kinds.clear();
    for (let c = 0; c < this.map.chunkCount; c += 1) {
      const rec = this.map.chunk(c);
      if (rec !== undefined) rec.entities.length = 0;
    }
    const ids = this.entities.with(C.Position);
    for (let k = 0; k < ids.length; k += 1) {
      const id = ids[k] as EntityId;
      const tile = this.tileOf(id);
      if (tile >= 0) this.insert(id, tile);
    }
  }

  /** The entities standing on exactly this tile, ascending by id. */
  at(i: TileIndex): readonly EntityId[] {
    if (!this.map.validIndex(i)) return EMPTY;
    return Array.from(this.tiles.get(i) ?? []).filter((id) => this.tileOf(id) === i).sort((a, b) => a - b);
  }

  /** How many entities this tile's bucket holds: at least as many as stand on the tile. */
  bucketSize(i: TileIndex): number {
    return this.tiles.get(i)?.size ?? 0;
  }

  /**
   * How many of this tile's entities pass `test`, stopping at nothing and allocating nothing: the mover
   * asks on every tick of every walk (22 § Crowding). The count does not depend on the bucket's order.
   */
  countAt(i: TileIndex, test: (id: EntityId) => boolean): number {
    const bucket = this.tiles.get(i);
    if (bucket === undefined || bucket.size === 0) return 0;
    let n = 0;
    for (const id of bucket) if (this.tileOf(id) === i && test(id)) n += 1;
    return n;
  }

  /** Every chunk index whose tiles intersect the given inclusive tile box. */
  private chunksIn(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): ChunkIndex[] {
    const out: ChunkIndex[] = [];
    const cx0 = Math.max(0, Math.floor(x0 / CHUNK_SIZE));
    const cx1 = Math.min(this.map.chunksPerRow - 1, Math.floor(x1 / CHUNK_SIZE));
    const cy0 = Math.max(0, Math.floor(y0 / CHUNK_SIZE));
    const cy1 = Math.min(this.map.chunksPerCol - 1, Math.floor(y1 / CHUNK_SIZE));
    const zz0 = Math.max(0, z0);
    const zz1 = Math.min(this.map.d - 1, z1);
    for (let z = zz0; z <= zz1; z += 1) {
      for (let cy = cy0; cy <= cy1; cy += 1) {
        for (let cx = cx0; cx <= cx1; cx += 1) out.push(this.map.chunkAt(cx, cy, z));
      }
    }
    return out;
  }

  /**
   * Entities whose position lies in the inclusive box spanned by two tiles, ascending by id.
   * The scan visits the chunks the box touches and filters by the real position.
   */
  inBox(from: TileIndex, to: TileIndex, predicate?: EntityPredicate): readonly EntityId[] {
    if (!this.map.validIndex(from) || !this.map.validIndex(to)) return EMPTY;
    const x0 = Math.min(this.map.xOf(from), this.map.xOf(to));
    const x1 = Math.max(this.map.xOf(from), this.map.xOf(to));
    const y0 = Math.min(this.map.yOf(from), this.map.yOf(to));
    const y1 = Math.max(this.map.yOf(from), this.map.yOf(to));
    const z0 = Math.min(this.map.zOf(from), this.map.zOf(to));
    const z1 = Math.max(this.map.zOf(from), this.map.zOf(to));
    return this.collect(x0, y0, z0, x1, y1, z1, predicate);
  }

  /** Entities within Chebyshev radius `r` of tile `i`, ascending by id. */
  inRadius(i: TileIndex, r: number, predicate?: EntityPredicate, kind?: EntityKind): readonly EntityId[] {
    if (!this.map.validIndex(i) || r < 0) return EMPTY;
    const x = this.map.xOf(i);
    const y = this.map.yOf(i);
    const z = this.map.zOf(i);
    return this.collect(x - r, y - r, z - r, x + r, y + r, z + r, predicate, kind);
  }

  private collect(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    predicate?: EntityPredicate,
    kind?: EntityKind,
  ): readonly EntityId[] {
    const chunks = this.chunksIn(x0, y0, z0, x1, y1, z1);
    const out: EntityId[] = [];
    const seen = new Set<EntityId>();
    for (let k = 0; k < chunks.length; k += 1) {
      const rec = this.map.chunk(chunks[k] as ChunkIndex);
      if (rec === undefined) continue;
      const ids = kind === undefined ? rec.entities : this.kinds.get(chunks[k] as ChunkIndex)?.get(kind) ?? [];
      for (const id of ids) {
        if (seen.has(id)) continue;
        const p = this.entities.get<Position>(id, C.Position);
        if (p === undefined) continue;
        if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1 || p.z < z0 || p.z > z1) continue;
        if (predicate !== undefined && !predicate(id)) continue;
        seen.add(id);
        out.push(id);
      }
    }
    out.sort((a, b) => a - b);
    return out;
  }

  /**
   * The matching entity closest to `i` within `maxRadius`, ties broken by the lower id;
   * {@link NO_ENTITY} when there is none.
   */
  nearest(i: TileIndex, predicate: EntityPredicate, maxRadius: number): EntityId {
    const candidates = this.inRadius(i, maxRadius, predicate);
    let best: EntityId = NO_ENTITY;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let k = 0; k < candidates.length; k += 1) {
      const id = candidates[k] as EntityId;
      const tile = this.tileOf(id);
      if (tile < 0) continue;
      const d = chebyshev(this.map, i, tile);
      if (d < bestDistance) {
        bestDistance = d;
        best = id;
      }
    }
    return best;
  }

  /** `readers.spatial` of `22` § Interfaces. */
  reader(): SpatialIndexReader {
    const kindFilter = (kind?: EntityKind): EntityPredicate | undefined =>
      kind === undefined ? undefined : (id: EntityId): boolean => this.entities.kind(id) === kind;
    return {
      at: (i) => this.at(i),
      inRadius: (i, r, kind) => this.inRadius(i, r, kindFilter(kind), kind),
      inBox: (a, b, kind) => this.inBox(a, b, kindFilter(kind)),
      nearest: (i, predicate, maxRadius) => this.nearest(i, predicate, maxRadius),
      inRadiusWhere: (i, r, predicate) => this.inRadius(i, r, predicate),
      inBoxWhere: (a, b, predicate) => this.inBox(a, b, predicate),
    };
  }
}

/** The shape `readers.spatial` exposes. */
export interface SpatialIndexReader {
  at(i: TileIndex): readonly EntityId[];
  inRadius(i: TileIndex, r: number, kind?: EntityKind): readonly EntityId[];
  inBox(from: TileIndex, to: TileIndex, kind?: EntityKind): readonly EntityId[];
  nearest(i: TileIndex, predicate: EntityPredicate, maxRadius: number): EntityId;
  inRadiusWhere(i: TileIndex, r: number, predicate: EntityPredicate): readonly EntityId[];
  inBoxWhere(from: TileIndex, to: TileIndex, predicate: EntityPredicate): readonly EntityId[];
}
