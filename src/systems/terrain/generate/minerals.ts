/**
 * Stage 7: veins and clusters. `03-terrain-and-mining.md` § Local map generation stage 7;
 * `algorithms/local-map-generation.md` step 5; `03-content/minerals-and-metals.md` § Ores, § Gems,
 * § Wealth multiplier (with the trait adjustments listed under it).
 */

import { DEEPSILVER_Z_MAX, MAGMA_SEA_TOP_Z, SURFACE_Z_MAX } from '@core/constants';
import { FIXED_SCALE, type Fixed } from '@core/fixed';
import { FluidType, TileKind, type Map3D } from '@core/map3d';
import type { RngStream } from '@core/rng';
import type { TileIndex } from '@core/types';
import {
  DEEPSILVER_MAGMA_DISTANCE,
  DEEPSILVER_VEIN_LENGTH,
  DEEPSILVER_VEIN_RADIUS,
  GEM_RADIUS_MAX,
  GEM_RADIUS_MIN,
  GEMSPRINGS_NEAR_SURFACE_LEVELS,
  IRONHEART_HEMATITE,
  IRONHEART_MAGNETITE,
  MINERAL_START_TRIES,
  VEIN_PAINT_RADIUS_MAX,
  VEIN_PAINT_RADIUS_MIN,
} from '../constants';
import { cavernBand } from './caverns';
import { hasTrait, stageStream, type LocalGen } from './common';

interface MineralRow {
  readonly id: string;
  readonly hosts: readonly string[];
  readonly shape: 'vein' | 'cluster';
  readonly count: number;
  readonly length?: number;
  readonly radius?: number;
  readonly deepsilver?: boolean;
  readonly tags?: readonly string[];
}

interface GemRow {
  readonly id: string;
  readonly hosts: readonly string[];
  readonly count: number;
  readonly cavernOnly?: boolean;
  readonly zMax?: number;
}

interface WealthRow {
  readonly wealth: number;
  readonly ore: Fixed;
  readonly gem: Fixed;
  readonly deepsilverVeins: number;
}

type TilePredicate = (i: TileIndex) => boolean;

/** Six-direction steps "biased horizontally": ±x 3, ±y 3, ±z 1. */
const VEIN_STEPS: readonly (readonly [readonly [number, number, number], number])[] = [
  [[1, 0, 0], 3],
  [[-1, 0, 0], 3],
  [[0, 1, 0], 3],
  [[0, -1, 0], 3],
  [[0, 0, 1], 1],
  [[0, 0, -1], 1],
];

/** `count = floor(n) + (st.fixed() < frac(n) ? 1 : 0)` for an expected count `n` in `Fixed`. */
export function rollCount(st: RngStream, expected: Fixed): number {
  const whole = Math.floor(expected / FIXED_SCALE);
  return whole + (st.fixed() < expected - whole * FIXED_SCALE ? 1 : 0);
}

/** Paint a ball of radius r around `center` with `material` where `ok` holds. Returns tiles painted. */
export function paintBall(map: Map3D, center: TileIndex, radius: number, material: number, ok: TilePredicate): number {
  const cx = map.xOf(center);
  const cy = map.yOf(center);
  const cz = map.zOf(center);
  let n = 0;
  for (let dz = -radius; dz <= radius; dz += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
        if (!map.inBounds(cx + dx, cy + dy, cz + dz)) continue;
        const i = map.index(cx + dx, cy + dy, cz + dz);
        if (!ok(i)) continue;
        map.material[i] = material;
        n += 1;
      }
    }
  }
  return n;
}

/** A random-walk vein of `length` steps, painting a ball of `radius()` at each step. */
export function paintVein(
  map: Map3D,
  st: RngStream,
  start: TileIndex,
  length: number,
  radius: () => number,
  material: number,
  ok: TilePredicate,
): void {
  let x = map.xOf(start);
  let y = map.yOf(start);
  let z = map.zOf(start);
  for (let s = 0; s < length; s += 1) {
    paintBall(map, map.index(x, y, z), radius(), material, ok);
    const [dx, dy, dz] = st.weighted(VEIN_STEPS);
    x += dx;
    y += dy;
    z += dz;
    if (!map.inBounds(x, y, z)) break;
    const i = map.index(x, y, z);
    if (!ok(i) && map.materialAt(i) !== material) break;
  }
}

/** `randomWallTile(st, hosts)`: up to 50 draws of a rock tile whose material the test accepts. */
export function randomWallTile(g: LocalGen, st: RngStream, accept: TilePredicate, zLo: number, zHi: number): TileIndex {
  for (let k = 0; k < MINERAL_START_TRIES; k += 1) {
    const x = st.int(0, g.w - 1);
    const y = st.int(0, g.h - 1);
    const z = st.int(zLo, zHi);
    const i = g.map.index(x, y, z);
    if (g.map.kindAt(i) === TileKind.Wall && accept(i)) return i;
  }
  return -1;
}

/** Tiles within Chebyshev distance `r` of magma, for `z ≤ zMax + r` (a separable dilation). */
export function nearMagma(map: Map3D, r: number, zMax: number): Uint8Array {
  const near = new Uint8Array(map.tileCount);
  const top = Math.min(map.d - 1, zMax + r);
  for (let z = 0; z <= top; z += 1) {
    for (let y = 0; y < map.h; y += 1) {
      for (let x = 0; x < map.w; x += 1) {
        const i = map.index(x, y, z);
        if (map.fluidLevelAt(i) > 0 && map.fluidTypeAt(i) === FluidType.Magma) near[i] = 1;
      }
    }
  }
  const pass = (dx: number, dy: number, dz: number): void => {
    const src = Uint8Array.from(near);
    for (let z = 0; z <= top; z += 1) {
      for (let y = 0; y < map.h; y += 1) {
        for (let x = 0; x < map.w; x += 1) {
          if (src[map.index(x, y, z)] !== 1) continue;
          for (let k = -r; k <= r; k += 1) {
            const nx = x + dx * k;
            const ny = y + dy * k;
            const nz = z + dz * k;
            if (nz <= top && map.inBounds(nx, ny, nz)) near[map.index(nx, ny, nz)] = 1;
          }
        }
      }
    }
  };
  pass(1, 0, 0);
  pass(0, 1, 0);
  pass(0, 0, 1);
  return near;
}

/**
 * A deepsilver vein (`length 6, radius 1`) from `start`, painted only on rock at
 * `z ≤ DEEPSILVER_Z_MAX` within `DEEPSILVER_MAGMA_DISTANCE` of magma.
 */
export function paintDeepsilver(g: LocalGen, st: RngStream, start: TileIndex, near: Uint8Array): void {
  const map = g.map;
  const ore = g.registry.table('materials').index('deepsilver_ore');
  const ok: TilePredicate = (i) => map.kindAt(i) === TileKind.Wall && map.zOf(i) <= DEEPSILVER_Z_MAX && near[i] === 1;
  paintVein(map, st, start, DEEPSILVER_VEIN_LENGTH, () => DEEPSILVER_VEIN_RADIUS, ore, ok);
}

/**
 * The expected number of veins or clusters of one ore row (`Fixed`): its count × the wealth
 * multiplier, with the `ironheart` and `glasslands` adjustments.
 */
export function expectedOreCount(
  m: { readonly id: string; readonly count: number; readonly tags?: readonly string[] },
  oreMultiplier: Fixed,
  traits: readonly string[],
): Fixed {
  let expected = Math.floor((m.count * oreMultiplier) / 100); // count is ×100; mult is Fixed
  if (traits.includes('ironheart') && m.id === 'hematite') expected = IRONHEART_HEMATITE * FIXED_SCALE;
  if (traits.includes('ironheart') && m.id === 'magnetite') expected = IRONHEART_MAGNETITE * FIXED_SCALE;
  if (traits.includes('glasslands') && m.id === 'native_copper') expected += FIXED_SCALE;
  if (traits.includes('glasslands') && (m.tags ?? []).includes('fuel')) expected = Math.floor(expected / 2);
  return expected;
}

export function stageMinerals(g: LocalGen): void {
  const st = stageStream(g.s, 'terrain.minerals');
  const map = g.map;
  const materials = g.registry.table('materials');
  const mult = g.registry.derived<readonly WealthRow[]>('wealthMultipliers').find((w) => w.wealth === g.spec.wealth);
  if (mult === undefined) throw new RangeError(`no wealth multiplier row for wealth ${g.spec.wealth}`);
  const zLo = MAGMA_SEA_TOP_Z + 2;
  let zHi = 0;
  for (const h of g.heights) zHi = Math.max(zHi, h);
  zHi = Math.min(zHi, SURFACE_Z_MAX);
  const surfaceAt = (i: TileIndex): number => g.heights[map.yOf(i) * g.w + map.xOf(i)] as number;

  // Ores, in id order.
  const minerals = g.registry.table<MineralRow>('minerals');
  for (const id of minerals.ids()) {
    const m = minerals.byId(id) as MineralRow;
    if (m.deepsilver === true) continue;
    const expected = expectedOreCount(m, mult.ore, g.spec.traits);
    const record = { mineral: id, expected, placed: 0 };
    g.veins.push(record);
    const hosts = new Set(m.hosts.map((h) => materials.index(h)));
    const material = materials.index(id);
    const ok: TilePredicate = (i) => map.kindAt(i) === TileKind.Wall && hosts.has(map.materialAt(i));
    const count = rollCount(st, expected);
    for (let k = 0; k < count; k += 1) {
      const start = randomWallTile(g, st, ok, zLo, zHi);
      if (start < 0) continue;
      record.placed += 1;
      if (m.shape === 'vein') {
        paintVein(map, st, start, m.length ?? 1, () => st.int(VEIN_PAINT_RADIUS_MIN, VEIN_PAINT_RADIUS_MAX), material, ok);
      } else {
        paintBall(map, start, m.radius ?? 1, material, ok);
      }
    }
  }

  // Gems: clusters of radius 1-2; gemsprings doubles them and puts half near the surface.
  const gems = g.registry.table<GemRow>('gems');
  const springs = hasTrait(g, 'gemsprings');
  for (const id of gems.ids()) {
    const gem = gems.byId(id) as GemRow;
    const expected = Math.floor((gem.count * mult.gem) / 100) * (springs ? 2 : 1);
    const record = { mineral: id, expected, placed: 0 };
    g.veins.push(record);
    const material = materials.index(id);
    const hosts = new Set(gem.hosts.map((h) => materials.index(h)));
    const zMax = gem.zMax ?? zHi;
    const cavernWall: TilePredicate = (i) => {
      if (map.kindAt(i) !== TileKind.Wall) return false;
      const z = map.zOf(i);
      if (![1, 2, 3].some((t) => z >= cavernBand(t)[0] - 1 && z <= cavernBand(t)[1])) return false;
      const x = map.xOf(i);
      const y = map.yOf(i);
      return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(
        ([dx, dy, dz]) =>
          map.inBounds(x + (dx as number), y + (dy as number), z + (dz as number)) &&
          map.kindAt(map.index(x + (dx as number), y + (dy as number), z + (dz as number))) !== TileKind.Wall,
      );
    };
    const hostOk: TilePredicate = (i) => map.kindAt(i) === TileKind.Wall && hosts.has(map.materialAt(i)) && map.zOf(i) <= zMax;
    const ok = gem.cavernOnly === true ? cavernWall : hostOk;
    const count = rollCount(st, expected);
    for (let k = 0; k < count; k += 1) {
      const near = springs && k < Math.floor(count / 2);
      const accept: TilePredicate = near ? (i) => ok(i) && map.zOf(i) >= surfaceAt(i) - GEMSPRINGS_NEAR_SURFACE_LEVELS : ok;
      const start = randomWallTile(g, st, accept, zLo, Math.min(zHi, zMax));
      if (start < 0) continue;
      record.placed += 1;
      paintBall(map, start, st.int(GEM_RADIUS_MIN, GEM_RADIUS_MAX), material, ok);
    }
  }

  // Deepsilver: by wealth only (0 at wealth 0-1), next to the Sea of Fire rim or a magma pool.
  const near = nearMagma(map, DEEPSILVER_MAGMA_DISTANCE, DEEPSILVER_Z_MAX);
  const deepOk: TilePredicate = (i) => map.zOf(i) <= DEEPSILVER_Z_MAX && near[i] === 1;
  const record = { mineral: 'deepsilver_ore', expected: mult.deepsilverVeins * FIXED_SCALE, placed: 0 };
  g.veins.push(record);
  for (let k = 0; k < mult.deepsilverVeins; k += 1) {
    const start = randomWallTile(g, st, deepOk, 0, DEEPSILVER_Z_MAX);
    if (start < 0) continue;
    record.placed += 1;
    paintDeepsilver(g, st, start, near);
  }
}
