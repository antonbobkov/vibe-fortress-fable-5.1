/**
 * Temperature: `02-systems/05-materials-and-temperature.md` § Temperature model, § Warm springs, and
 * `04-implementation/algorithms/environment.md` § Temperature.
 *
 * `temperatureAt` is computed on demand; only the `tempOverride` grid (units of 5 °C) is stored,
 * and it is recomputed per chunk from the sources near the chunk. D-093, D-095.
 */

import { CHUNK_SIZE } from '@core/constants';
import { FLUID_LEVEL_MASK, FLUID_TYPE_BIT, TileFlag, type Map3D } from '@core/map3d';
import type { ChunkIndex, TileIndex } from '@core/types';
import {
  DEEP_HEAT_PER_Z,
  DEEP_HEAT_START_Z,
  FIRE_OVERRIDE,
  MAGMA_OVERRIDE,
  NEAR_SURFACE_DEPTH,
  SNOW_OVERRIDE,
  SPRING_OVERRIDE,
  TEMP_OVERRIDE_LIMIT,
  UNDERGROUND_BASE_C,
} from './constants';

/**
 * `temperatureAt(i)` without the override: the surface temperature outdoors or in the light;
 * underground, blended into `UNDERGROUND_BASE_C` over `NEAR_SURFACE_DEPTH` levels (truncating),
 * then rising by `DEEP_HEAT_PER_Z` per level below `DEEP_HEAT_START_Z`.
 */
export function baseTemperature(map: Map3D, i: TileIndex, surfaceC: number): number {
  const f = map.flagsAt(i);
  if ((f & (TileFlag.Outdoor | TileFlag.Lit)) !== 0) return surfaceC;
  const x = map.xOf(i);
  const y = map.yOf(i);
  const z = map.zOf(i);
  const depth = Math.max(0, map.columnSurfaceZ(x, y) - z);
  if (depth <= NEAR_SURFACE_DEPTH) return surfaceC + Math.trunc(((UNDERGROUND_BASE_C - surfaceC) * depth) / NEAR_SURFACE_DEPTH);
  return UNDERGROUND_BASE_C + Math.max(0, DEEP_HEAT_START_Z - z) * DEEP_HEAT_PER_Z;
}

/** `base + tempOverride(i) × 5`. */
export function temperatureOf(map: Map3D, i: TileIndex, surfaceC: number): number {
  return baseTemperature(map, i, surfaceC) + ((map.tempOverride[i] ?? 0) as number) * 5;
}

/** What the override recompute reads besides the map. */
export interface OverrideSources {
  isBurning(i: TileIndex): boolean;
  isWarmSpring(i: TileIndex): boolean;
}

function isMagma(map: Map3D, i: TileIndex): boolean {
  const f = (map.fluid[i] ?? 0) as number;
  return (f & FLUID_LEVEL_MASK) > 0 && (f & FLUID_TYPE_BIT) !== 0;
}

/** Magma contributes `MAGMA_OVERRIDE` at distance 0, half at 1, a quarter at 2. */
const MAGMA_BY_DISTANCE: readonly number[] = [MAGMA_OVERRIDE, MAGMA_OVERRIDE / 2, MAGMA_OVERRIDE / 4];
/** Fire contributes `FIRE_OVERRIDE` at the tile, half at distance 1 (`05` § Temperature model). */
const FIRE_BY_DISTANCE: readonly number[] = [FIRE_OVERRIDE, FIRE_OVERRIDE / 2];

/**
 * The override of one tile: the sum over magma tiles within Chebyshev 2 (in x and y) on its own
 * level and the level below (a source warms "the same level and the level above"), burning tiles
 * within 1 likewise, a warm spring on the tile and snow on the tile, clamped to ±24.
 */
export function overrideAt(map: Map3D, i: TileIndex, sources: OverrideSources): number {
  const x = map.xOf(i);
  const y = map.yOf(i);
  const z = map.zOf(i);
  let sum = 0;
  for (let dz = -1; dz <= 0; dz += 1) {
    const zz = z + dz;
    if (zz < 0) continue;
    for (let dy = -2; dy <= 2; dy += 1) {
      const yy = y + dy;
      if (yy < 0 || yy >= map.h) continue;
      for (let dx = -2; dx <= 2; dx += 1) {
        const xx = x + dx;
        if (xx < 0 || xx >= map.w) continue;
        const j = map.index(xx, yy, zz);
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (isMagma(map, j)) sum += MAGMA_BY_DISTANCE[d] as number;
        if (d <= 1 && sources.isBurning(j)) sum += FIRE_BY_DISTANCE[d] as number;
      }
    }
  }
  if (sources.isWarmSpring(i)) sum += SPRING_OVERRIDE;
  if (map.hasFlag(i, TileFlag.Snow)) sum -= SNOW_OVERRIDE;
  return sum > TEMP_OVERRIDE_LIMIT ? TEMP_OVERRIDE_LIMIT : sum < -TEMP_OVERRIDE_LIMIT ? -TEMP_OVERRIDE_LIMIT : sum;
}

/** The tiles of a chunk, ascending. */
export function chunkTiles(map: Map3D, c: ChunkIndex): TileIndex[] {
  const perLevel = map.chunksPerRow * map.chunksPerCol;
  const z = Math.floor(c / perLevel);
  const rest = c % perLevel;
  const cy = Math.floor(rest / map.chunksPerRow);
  const cx = rest % map.chunksPerRow;
  const out: TileIndex[] = [];
  for (let y = cy * CHUNK_SIZE; y < Math.min(map.h, (cy + 1) * CHUNK_SIZE); y += 1) {
    for (let x = cx * CHUNK_SIZE; x < Math.min(map.w, (cx + 1) * CHUNK_SIZE); x += 1) out.push(map.index(x, y, z));
  }
  return out;
}

/**
 * The chunks whose overrides a source change in chunk `c` can reach: `c`, its eight neighbours on
 * the level, and the same nine one level up (D-095).
 */
export function reachOf(map: Map3D, c: ChunkIndex, out: Set<ChunkIndex>): void {
  const perLevel = map.chunksPerRow * map.chunksPerCol;
  const z = Math.floor(c / perLevel);
  const rest = c % perLevel;
  const cy = Math.floor(rest / map.chunksPerRow);
  const cx = rest % map.chunksPerRow;
  for (let dz = 0; dz <= 1; dz += 1) {
    if (z + dz >= map.d) continue;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= map.chunksPerRow || y >= map.chunksPerCol) continue;
        out.add(map.chunkAt(x, y, z + dz));
      }
    }
  }
}

/** Recompute one chunk's overrides: clear, then re-add every contribution. Marks it for redraw when it changed. */
export function recomputeChunk(map: Map3D, c: ChunkIndex, sources: OverrideSources): void {
  let changed = false;
  for (const i of chunkTiles(map, c)) {
    const v = overrideAt(map, i, sources);
    if (map.tempOverride[i] !== v) {
      map.tempOverride[i] = v;
      changed = true;
    }
  }
  const rec = map.chunk(c);
  if (changed && rec !== undefined) rec.dirtyRender = true;
}

/**
 * A signature of where a chunk's magma lies (FNV-1a over the magma tiles' indices, ascending), 0
 * when it has none. The override depends only on which tiles hold magma, not on their levels.
 */
export function magmaSignature(map: Map3D, c: ChunkIndex): number {
  let h = 0x811c9dc5;
  let any = false;
  for (const i of chunkTiles(map, c)) {
    if (!isMagma(map, i)) continue;
    any = true;
    h = Math.imul(h ^ (i & 0xffff), 0x01000193) >>> 0;
    h = Math.imul(h ^ (i >>> 16), 0x01000193) >>> 0;
  }
  return any ? h || 1 : 0;
}
