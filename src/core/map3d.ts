/**
 * The tile grids.
 *
 * Implements `01-architecture/data-model.md` § Map3D: the linear index, the six dense grids,
 * the `buildingAt` map, the tile-kind / designation / flag tables, the designation nibble
 * packing, the fluid byte layout and the chunk records.
 *
 * Enums are transcribed from `04-implementation/schemas/components.md` § Map3D.
 */

import { CHUNK_SIZE, LOCAL_MAP_H, LOCAL_MAP_W, LOCAL_MAP_Z } from './constants';
import type { ChunkIndex, EntityId, TileIndex } from './types';

/** `data-model.md` § Tile kinds. */
export enum TileKind {
  Open = 0,
  Wall = 1,
  Floor = 2,
  Ramp = 3,
  StairsUp = 4,
  StairsDown = 5,
  StairsUpDown = 6,
  Fortification = 7,
  Tree = 8,
  Sapling = 9,
  Shrub = 10,
  Boulder = 11,
}

/** `data-model.md` § Designations. */
export enum Designation {
  None = 0,
  Dig = 1,
  Channel = 2,
  StairsUp = 3,
  StairsDown = 4,
  StairsUpDown = 5,
  Ramp = 6,
  Smooth = 7,
  Engrave = 8,
  Remove = 9,
  Chop = 10,
  Gather = 11,
  Harvest = 12,
}

/** `data-model.md` § Flags. Bits 14-15 are reserved. */
export enum TileFlag {
  Discovered = 1 << 0,
  Constructed = 1 << 1,
  Smoothed = 1 << 2,
  Engraved = 1 << 3,
  Mud = 1 << 4,
  Snow = 1 << 5,
  Grass = 1 << 6,
  Ash = 1 << 7,
  Burning = 1 << 8,
  Outdoor = 1 << 9,
  Lit = 1 << 10,
  Restricted = 1 << 11,
  Web = 1 << 12,
  Wet = 1 << 13,
}

/** Every flag bit that is defined; bits 14-15 are reserved and always clear. */
export const TILE_FLAG_MASK = 0x3fff;

/** Fluid type, the fluid byte's bit 3. */
export enum FluidType {
  Water = 0,
  Magma = 1,
}

/** Fluid byte layout: bits 0-2 level, 3 type, 4 settled, 5 source, 6 frozen, 7 reserved. */
export const FLUID_LEVEL_MASK = 0b0000_0111;
export const FLUID_TYPE_BIT = 0b0000_1000;
export const FLUID_SETTLED_BIT = 0b0001_0000;
export const FLUID_SOURCE_BIT = 0b0010_0000;
export const FLUID_FROZEN_BIT = 0b0100_0000;

/**
 * `data-model.md` § Tile kinds: "A tile with `kind` in {floor, ramp, stairs_*, sapling, shrub}
 * is solid-bottomed: things rest on it."
 */
export function isSolidBottomed(kind: TileKind): boolean {
  switch (kind) {
    case TileKind.Floor:
    case TileKind.Ramp:
    case TileKind.StairsUp:
    case TileKind.StairsDown:
    case TileKind.StairsUpDown:
    case TileKind.Sapling:
    case TileKind.Shrub:
      return true;
    case TileKind.Open:
    case TileKind.Wall:
    case TileKind.Fortification:
    case TileKind.Tree:
    case TileKind.Boulder:
      return false;
    default:
      return false;
  }
}

/** `data-model.md` § Chunks. */
export interface ChunkRecord {
  /** The compositor may cache the chunk's cells until this is set. */
  dirtyRender: boolean;
  /** The pathfinder's connectivity labels for this chunk must be recomputed. */
  dirtyPath: boolean;
  /** Number of unsettled fluid tiles; chunks with zero are skipped by 04 fluids. */
  activeFluidCount: number;
  /** The spatial index bucket, kept sorted ascending. */
  entities: EntityId[];
}

/** Offsets of the six face neighbours, in the fixed order -x, +x, -y, +y, -z, +z. */
const N6: readonly (readonly [number, number, number])[] = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1],
];

/** Offsets of the eight neighbours on the same z-level, clockwise from north-west. */
const N8: readonly (readonly [number, number, number])[] = [
  [-1, -1, 0],
  [0, -1, 0],
  [1, -1, 0],
  [-1, 0, 0],
  [1, 0, 0],
  [-1, 1, 0],
  [0, 1, 0],
  [1, 1, 0],
];

/** Offsets of all 26 surrounding tiles, in ascending (dz, dy, dx) order. */
const N26: readonly (readonly [number, number, number])[] = (() => {
  const out: [number, number, number][] = [];
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        out.push([dx, dy, dz]);
      }
    }
  }
  return out;
})();

/**
 * The dense tile state of one local map.
 *
 * All grids share the linear index `(z * h + y) * w + x`. Only 03 terrain writes `kind` and
 * `material`; the other writers are listed per grid in `data-model.md`.
 */
export class Map3D {
  readonly w: number;
  readonly h: number;
  readonly d: number;

  readonly kind: Uint8Array;
  readonly material: Uint16Array;
  readonly fluid: Uint8Array;
  /** Low nibble {@link Designation}, high nibble priority 1-9. */
  readonly designation: Uint8Array;
  readonly flags: Uint16Array;
  /** 0 = none; otherwise a local temperature contribution in units of 5 degrees C. */
  readonly tempOverride: Int8Array;
  readonly buildingAt: Map<TileIndex, EntityId>;
  readonly chunks: ChunkRecord[];

  readonly chunksPerRow: number;
  readonly chunksPerCol: number;
  readonly chunkLayers: number;

  private readonly wh: number;

  /**
   * Maps smaller than the standard size are used by tests and by the hand-built fixtures of
   * `01-testing-strategy.md`; the chunk grid is rounded up so a partial chunk still exists. At
   * the specified `LOCAL_MAP_W` / `LOCAL_MAP_H` this is exactly the formula in `data-model.md`.
   */
  constructor(w: number = LOCAL_MAP_W, h: number = LOCAL_MAP_H, d: number = LOCAL_MAP_Z) {
    if (w <= 0 || h <= 0 || d <= 0) throw new RangeError(`Map3D dimensions must be positive: ${w}x${h}x${d}`);
    this.w = w;
    this.h = h;
    this.d = d;
    this.wh = w * h;
    const n = w * h * d;
    this.kind = new Uint8Array(n);
    this.material = new Uint16Array(n);
    this.fluid = new Uint8Array(n);
    this.designation = new Uint8Array(n);
    this.flags = new Uint16Array(n);
    this.tempOverride = new Int8Array(n);
    this.buildingAt = new Map<TileIndex, EntityId>();
    this.chunksPerRow = Math.ceil(w / CHUNK_SIZE);
    this.chunksPerCol = Math.ceil(h / CHUNK_SIZE);
    this.chunkLayers = d;
    const chunkCount = this.chunksPerRow * this.chunksPerCol * d;
    this.chunks = new Array<ChunkRecord>(chunkCount);
    for (let c = 0; c < chunkCount; c += 1) {
      this.chunks[c] = { dirtyRender: true, dirtyPath: true, activeFluidCount: 0, entities: [] };
    }
  }

  /** Number of tiles. */
  get tileCount(): number {
    return this.wh * this.d;
  }

  // ---------- index math ----------

  /** `i = (z * h + y) * w + x`. No bounds check; use {@link inBounds} first when unsure. */
  index(x: number, y: number, z: number): TileIndex {
    return (z * this.h + y) * this.w + x;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < this.w && y >= 0 && y < this.h && z >= 0 && z < this.d;
  }

  /** True when `i` is a valid linear index. */
  validIndex(i: TileIndex): boolean {
    return Number.isInteger(i) && i >= 0 && i < this.tileCount;
  }

  xOf(i: TileIndex): number {
    return i % this.w;
  }

  yOf(i: TileIndex): number {
    return ((i / this.w) | 0) % this.h;
  }

  zOf(i: TileIndex): number {
    return (i / this.wh) | 0;
  }

  unpack(i: TileIndex): { x: number; y: number; z: number } {
    return { x: this.xOf(i), y: this.yOf(i), z: this.zOf(i) };
  }

  /** The index one tile in the given direction, or -1 if that tile is off the map. */
  offset(i: TileIndex, dx: number, dy: number, dz: number): TileIndex {
    const x = this.xOf(i) + dx;
    const y = this.yOf(i) + dy;
    const z = this.zOf(i) + dz;
    return this.inBounds(x, y, z) ? this.index(x, y, z) : -1;
  }

  /** The tile directly below, or -1 at z = 0. */
  below(i: TileIndex): TileIndex {
    return this.zOf(i) === 0 ? -1 : i - this.wh;
  }

  /** The tile directly above, or -1 at the top z-level. */
  above(i: TileIndex): TileIndex {
    return this.zOf(i) === this.d - 1 ? -1 : i + this.wh;
  }

  // ---------- neighbours ----------

  private collect(
    i: TileIndex,
    offsets: readonly (readonly [number, number, number])[],
    out: TileIndex[],
  ): TileIndex[] {
    const x = this.xOf(i);
    const y = this.yOf(i);
    const z = this.zOf(i);
    for (let k = 0; k < offsets.length; k += 1) {
      const o = offsets[k] as readonly [number, number, number];
      const nx = x + o[0];
      const ny = y + o[1];
      const nz = z + o[2];
      if (this.inBounds(nx, ny, nz)) out.push(this.index(nx, ny, nz));
    }
    return out;
  }

  /** The six face neighbours that exist, in the order -x, +x, -y, +y, -z, +z. */
  neighbors6(i: TileIndex, out: TileIndex[] = []): TileIndex[] {
    return this.collect(i, N6, out);
  }

  /** The eight neighbours on the same z-level that exist. */
  neighbors8(i: TileIndex, out: TileIndex[] = []): TileIndex[] {
    return this.collect(i, N8, out);
  }

  /** All 26 surrounding tiles that exist. */
  neighbors26(i: TileIndex, out: TileIndex[] = []): TileIndex[] {
    return this.collect(i, N26, out);
  }

  /** `readers.map.neighbors(i)`: the six face neighbours. */
  neighbors(i: TileIndex, out: TileIndex[] = []): TileIndex[] {
    return this.neighbors6(i, out);
  }

  // ---------- kind and material ----------

  kindAt(i: TileIndex): TileKind {
    return this.kind[i] as TileKind;
  }

  materialAt(i: TileIndex): number {
    return this.material[i] ?? 0;
  }

  /**
   * Raw tile write. Marks the chunk dirty for render and for pathing. Systems other than
   * 03 terrain go through the terrain API, which calls this.
   */
  setKind(i: TileIndex, kind: TileKind, material: number): void {
    this.kind[i] = kind;
    this.material[i] = material;
    const c = this.chunkOf(i);
    const rec = this.chunks[c];
    if (rec !== undefined) {
      rec.dirtyRender = true;
      rec.dirtyPath = true;
    }
  }

  setMaterial(i: TileIndex, material: number): void {
    this.material[i] = material;
    const rec = this.chunks[this.chunkOf(i)];
    if (rec !== undefined) rec.dirtyRender = true;
  }

  /**
   * The z of the ground in a column: the highest tile whose kind is not `open`
   * (`data-model.md` § Tile kinds, "Clarification of the surface"). -1 when the column is
   * open all the way down.
   */
  columnSurfaceZ(x: number, y: number): number {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return -1;
    for (let z = this.d - 1; z >= 0; z -= 1) {
      if (this.kind[this.index(x, y, z)] !== TileKind.Open) return z;
    }
    return -1;
  }

  // ---------- flags ----------

  flagsAt(i: TileIndex): number {
    return this.flags[i] ?? 0;
  }

  hasFlag(i: TileIndex, flag: TileFlag): boolean {
    return (((this.flags[i] ?? 0) as number) & flag) !== 0;
  }

  setFlag(i: TileIndex, flag: TileFlag, value: boolean): void {
    const before = (this.flags[i] ?? 0) as number;
    const after = value ? before | flag : before & ~flag & 0xffff;
    if (after === before) return;
    this.flags[i] = after;
    const rec = this.chunks[this.chunkOf(i)];
    if (rec !== undefined) rec.dirtyRender = true;
  }

  clearFlags(i: TileIndex): void {
    this.flags[i] = 0;
  }

  // ---------- designations ----------

  /** The low nibble of the designation byte. */
  designationAt(i: TileIndex): Designation {
    return (((this.designation[i] ?? 0) as number) & 0x0f) as Designation;
  }

  /** The high nibble of the designation byte; 0 when there is no designation. */
  designationPriorityAt(i: TileIndex): number {
    return (((this.designation[i] ?? 0) as number) >> 4) & 0x0f;
  }

  /**
   * Pack a designation and its priority into one byte. `Designation.None` clears the priority
   * too, so an undesignated tile is always byte 0.
   */
  setDesignation(i: TileIndex, designation: Designation, priority: number): void {
    if (designation === Designation.None) {
      this.designation[i] = 0;
    } else {
      if (priority < 1 || priority > 9 || !Number.isInteger(priority)) {
        throw new RangeError(`designation priority out of range 1-9: ${priority}`);
      }
      this.designation[i] = ((priority & 0x0f) << 4) | (designation & 0x0f);
    }
    const rec = this.chunks[this.chunkOf(i)];
    if (rec !== undefined) rec.dirtyRender = true;
  }

  // ---------- fluid byte ----------

  fluidLevelAt(i: TileIndex): number {
    return ((this.fluid[i] ?? 0) as number) & FLUID_LEVEL_MASK;
  }

  fluidTypeAt(i: TileIndex): FluidType {
    return (((this.fluid[i] ?? 0) as number) & FLUID_TYPE_BIT) !== 0 ? FluidType.Magma : FluidType.Water;
  }

  fluidSettledAt(i: TileIndex): boolean {
    return (((this.fluid[i] ?? 0) as number) & FLUID_SETTLED_BIT) !== 0;
  }

  fluidSourceAt(i: TileIndex): boolean {
    return (((this.fluid[i] ?? 0) as number) & FLUID_SOURCE_BIT) !== 0;
  }

  fluidFrozenAt(i: TileIndex): boolean {
    return (((this.fluid[i] ?? 0) as number) & FLUID_FROZEN_BIT) !== 0;
  }

  /** Pack a fluid byte. Level is clamped to 0-7. */
  static packFluid(
    level: number,
    type: FluidType = FluidType.Water,
    settled = false,
    source = false,
    frozen = false,
  ): number {
    const lv = level < 0 ? 0 : level > FLUID_LEVEL_MASK ? FLUID_LEVEL_MASK : level | 0;
    return (
      lv |
      (type === FluidType.Magma ? FLUID_TYPE_BIT : 0) |
      (settled ? FLUID_SETTLED_BIT : 0) |
      (source ? FLUID_SOURCE_BIT : 0) |
      (frozen ? FLUID_FROZEN_BIT : 0)
    );
  }

  // ---------- chunks ----------

  /** `c = (z * chunksPerCol + cy) * chunksPerRow + cx`. */
  chunkAt(cx: number, cy: number, z: number): ChunkIndex {
    return (z * this.chunksPerCol + cy) * this.chunksPerRow + cx;
  }

  /** The chunk a tile belongs to. */
  chunkOf(i: TileIndex): ChunkIndex {
    const cx = (this.xOf(i) / CHUNK_SIZE) | 0;
    const cy = (this.yOf(i) / CHUNK_SIZE) | 0;
    return this.chunkAt(cx, cy, this.zOf(i));
  }

  chunk(c: ChunkIndex): ChunkRecord | undefined {
    return this.chunks[c];
  }

  get chunkCount(): number {
    return this.chunks.length;
  }

  markChunkDirty(i: TileIndex, render = true, path = false): void {
    const rec = this.chunks[this.chunkOf(i)];
    if (rec === undefined) return;
    if (render) rec.dirtyRender = true;
    if (path) rec.dirtyPath = true;
  }

  /** Clear every `dirtyRender` flag; the compositor calls this after a full redraw. */
  clearRenderDirty(): void {
    for (let c = 0; c < this.chunks.length; c += 1) {
      const rec = this.chunks[c];
      if (rec !== undefined) rec.dirtyRender = false;
    }
  }

  /** Add an entity to a chunk bucket, keeping it sorted ascending. */
  addEntityToChunk(c: ChunkIndex, id: EntityId): void {
    const rec = this.chunks[c];
    if (rec === undefined) return;
    const list = rec.entities;
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((list[mid] as number) < id) lo = mid + 1;
      else hi = mid;
    }
    if (list[lo] === id) return;
    list.splice(lo, 0, id);
  }

  /** Remove an entity from a chunk bucket. Returns true when it was present. */
  removeEntityFromChunk(c: ChunkIndex, id: EntityId): boolean {
    const rec = this.chunks[c];
    if (rec === undefined) return false;
    const list = rec.entities;
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((list[mid] as number) < id) lo = mid + 1;
      else hi = mid;
    }
    if (list[lo] !== id) return false;
    list.splice(lo, 1);
    return true;
  }

  // ---------- buildings ----------

  buildingAtTile(i: TileIndex): EntityId {
    return this.buildingAt.get(i) ?? 0;
  }

  setBuildingAt(i: TileIndex, id: EntityId): void {
    if (id === 0) this.buildingAt.delete(i);
    else this.buildingAt.set(i, id);
    this.markChunkDirty(i, true, true);
  }

  /** `buildingAt` as a canonical, ascending-by-tile array; the form saves and hashes use. */
  buildingEntries(): [TileIndex, EntityId][] {
    const out = Array.from(this.buildingAt) as [TileIndex, EntityId][];
    out.sort((a, b) => a[0] - b[0]);
    return out;
  }

  /** Reset every grid to zero and every chunk to empty and dirty. */
  clear(): void {
    this.kind.fill(0);
    this.material.fill(0);
    this.fluid.fill(0);
    this.designation.fill(0);
    this.flags.fill(0);
    this.tempOverride.fill(0);
    this.buildingAt.clear();
    for (let c = 0; c < this.chunks.length; c += 1) {
      const rec = this.chunks[c];
      if (rec === undefined) continue;
      rec.dirtyRender = true;
      rec.dirtyPath = true;
      rec.activeFluidCount = 0;
      rec.entities.length = 0;
    }
  }
}
