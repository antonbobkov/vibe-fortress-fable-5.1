/**
 * Stage 10: trait features. `03-terrain-and-mining.md` § Local map generation stage 10;
 * `algorithms/local-map-generation.md` step 8; the hooks of `regions-biomes-and-traits.md`
 * § Region traits. Anything that needs an entity is recorded as a spawn entry for the arrival.
 */

import { CAVERN_3_Z_MIN, DEEPSILVER_Z_MAX, FLUID_MAX_LEVEL } from '@core/constants';
import { FluidType, Map3D, TileKind } from '@core/map3d';
import type { RngStream } from '@core/rng';
import type { TileIndex } from '@core/types';
import {
  BATTLEFIELD_BAND_MAX,
  BATTLEFIELD_BAND_MIN,
  BATTLEFIELD_BONE_PILES,
  BATTLEFIELD_ITEM_COUNT,
  BATTLEFIELD_SKULLS,
  DEEPSILVER_MAGMA_DISTANCE,
  HALL_FURNITURE_COUNT,
  VAULT_TREASURE,
  WARM_SPRING_COUNT,
  WYRM_CHAMBER_SIZE,
} from '../constants';
import { COL_LAKE, COL_RIVER, hasTrait, stageStream, type LocalGen, type SpawnEntry } from './common';
import { nearMagma, paintDeepsilver } from './minerals';
import { SEA_RIM } from './sea';

interface ArmsRow {
  readonly id: string;
  readonly materials?: readonly string[];
}

/** Inward distance of a column from an edge. */
function inward(g: LocalGen, x: number, y: number): number {
  const e = g.spec.arrivalEdge;
  return e === 'n' ? y : e === 's' ? g.h - 1 - y : e === 'w' ? x : g.w - 1 - x;
}

/** A dry `Floor` surface tile of a column, or -1. */
function dryFloor(g: LocalGen, c: number): TileIndex {
  if (((g.colFlags[c] as number) & (COL_RIVER | COL_LAKE)) !== 0) return -1;
  const i = g.map.index(c % g.w, Math.floor(c / g.w), g.heights[c] as number);
  return g.map.kindAt(i) === TileKind.Floor && g.map.fluidLevelAt(i) === 0 ? i : -1;
}

/**
 * `old_battlefield`: `BATTLEFIELD_ITEM_COUNT` rusted (poor quality) iron weapons and armor, 40
 * `bone_pile` and 6 `skull`, on dry surface floors 15–40 tiles from the arrival edge. The weapon
 * or armor type is uniform over the metal-made rows of `weapons` and `armor` (D-048).
 */
function battlefield(g: LocalGen, st: RngStream): void {
  const band: TileIndex[] = [];
  for (let c = 0; c < g.w * g.h; c += 1) {
    const d = inward(g, c % g.w, Math.floor(c / g.w));
    if (d < BATTLEFIELD_BAND_MIN || d > BATTLEFIELD_BAND_MAX) continue;
    const i = dryFloor(g, c);
    if (i >= 0) band.push(i);
  }
  if (band.length === 0) return;
  const metal = (rows: string): string[] => {
    const t = g.registry.table<ArmsRow>(rows);
    return t.ids().filter((id) => (t.byId(id)?.materials ?? []).includes('metal'));
  };
  const arms = [...metal('weapons'), ...metal('armor')];
  for (let k = 0; k < BATTLEFIELD_ITEM_COUNT; k += 1) {
    g.spawns.push({ kind: 'item', type: st.pick(arms), material: 'iron', quality: 0, tile: st.pick(band), source: 'old_battlefield' });
  }
  for (let k = 0; k < BATTLEFIELD_BONE_PILES; k += 1) {
    g.spawns.push({ kind: 'item', type: 'bone_pile', material: 'bone', tile: st.pick(band), source: 'old_battlefield' });
  }
  for (let k = 0; k < BATTLEFIELD_SKULLS; k += 1) {
    g.spawns.push({ kind: 'item', type: 'skull', material: 'bone', tile: st.pick(band), source: 'old_battlefield' });
  }
}

/** The hall template's footprint: 17 × 9 columns east of the entrance (D-048). */
export const HALL_LENGTH = 17;
export const HALL_HALF_WIDTH = 4;

/** Common furniture of the hall ("12 common furniture items"). */
export const HALL_FURNITURE: readonly string[] = ['bed', 'table', 'chair', 'chest', 'cabinet', 'door'];

export interface HallLayout {
  /** Entrance column. */
  readonly x: number;
  readonly y: number;
  /** Hall level and vault level. */
  readonly z: number;
  readonly vaultZ: number;
  readonly rooms: readonly { readonly x: number; readonly y: number }[];
  readonly vault: { readonly x: number; readonly y: number };
}

/**
 * `sunken_halls`: dig the hall template into the highest ground of the half of the map farthest
 * from the arrival edge (D-048). Layout, at hall level `z = surface − 2`: a stair shaft from the
 * surface at the entrance; a corridor of 11 tiles east; six 3×3 rooms, three on each side, each
 * opening onto the corridor; at the corridor's end a stairwell down two levels; at the bottom, a
 * 5×5 vault two tiles east of the stair, sealed by the rock between them.
 */
export function carveHall(g: LocalGen, st: RngStream): HallLayout | null {
  const map = g.map;
  let best = -1;
  let bestScore = -1;
  for (let y = SEA_RIM + HALL_HALF_WIDTH; y < g.h - SEA_RIM - HALL_HALF_WIDTH; y += 1) {
    for (let x = SEA_RIM; x < g.w - SEA_RIM - HALL_LENGTH; x += 1) {
      const c = y * g.w + x;
      if (inward(g, x, y) * 2 < Math.max(g.w, g.h)) continue;
      if (dryFloor(g, c) < 0) continue;
      const score = (g.heights[c] as number) * 1000 + inward(g, x, y);
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
  }
  if (best < 0) return null;
  const ax = best % g.w;
  const ay = Math.floor(best / g.w);
  const s = g.heights[best] as number;
  const z = s - 2;
  const vaultZ = z - 2;
  const dig = (x: number, y: number, zz: number, kind: TileKind): void => {
    const i = map.index(x, y, zz);
    if (map.kindAt(i) === TileKind.Open) return;
    map.kind[i] = kind;
    map.fluid[i] = 0;
  };
  // The entrance shaft from the surface.
  dig(ax, ay, s, TileKind.StairsDown);
  dig(ax, ay, s - 1, TileKind.StairsUpDown);
  dig(ax, ay, z, TileKind.StairsUp);
  for (let x = ax + 1; x <= ax + 10; x += 1) dig(x, ay, z, TileKind.Floor);
  const rooms: { x: number; y: number }[] = [];
  for (const rx of [ax + 2, ax + 5, ax + 8]) {
    for (const side of [-1, 1]) {
      const cy = ay + side * 3;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) dig(rx + dx, cy + dy, z, TileKind.Floor);
      dig(rx, ay + side, z, TileKind.Floor);
      rooms.push({ x: rx, y: cy });
    }
  }
  // The stairwell down two levels at the corridor's end, then the sealed vault.
  const sx = ax + 10;
  dig(sx, ay, z, TileKind.StairsDown);
  dig(sx, ay, z - 1, TileKind.StairsUpDown);
  dig(sx, ay, vaultZ, TileKind.StairsUp);
  const vault = { x: sx + 4, y: ay };
  for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) dig(vault.x + dx, vault.y + dy, vaultZ, TileKind.Floor);

  const layout: HallLayout = { x: ax, y: ay, z, vaultZ, rooms, vault };
  for (let k = 0; k < HALL_FURNITURE_COUNT; k += 1) {
    const room = rooms[k % rooms.length] as { x: number; y: number };
    const tile = map.index(room.x + st.int(-1, 1), room.y + st.int(-1, 1), z);
    const material = g.registry.table('materials').idOf(map.materialAt(tile));
    g.spawns.push({ kind: 'item', type: st.pick(HALL_FURNITURE), material, tile, source: 'sunken_halls' });
  }
  const treasure = ['axe', 'helm', 'breastplate'];
  for (let k = 0; k < VAULT_TREASURE; k += 1) {
    const tile = map.index(vault.x - 1 + k, vault.y - 1, vaultZ);
    g.spawns.push({ kind: 'item', type: treasure[k % treasure.length] as string, material: 'deepsilver', tile, source: 'sunken_halls' });
  }
  g.spawns.push({
    kind: 'creature',
    type: 'blind_stalker',
    tile: map.index(vault.x, vault.y + 1, vaultZ),
    asleep: true,
    source: 'sunken_halls',
  });
  return layout;
}

/**
 * `gemsprings`: three 2×2 warm springs on dry surface soil, the nearest free patches to the river
 * (to the map centre with no river), each an open tile of water 7; recorded for 05 (D-048).
 */
function warmSprings(g: LocalGen, st: RngStream): void {
  const map = g.map;
  const river: number[] = [];
  for (let c = 0; c < g.w * g.h; c += 1) if (((g.colFlags[c] as number) & COL_RIVER) !== 0) river.push(c);
  const target = river.length > 0 ? (river[st.int(0, river.length - 1)] as number) : (g.h >> 1) * g.w + (g.w >> 1);
  const tx = target % g.w;
  const ty = Math.floor(target / g.w);
  const water = Map3D.packFluid(FLUID_MAX_LEVEL, FluidType.Water);
  const used = new Uint8Array(g.w * g.h);
  const materials = g.registry.table<{ id: string; class: string }>('materials');
  for (let n = 0; n < WARM_SPRING_COUNT; n += 1) {
    let best = -1;
    let bestD = Infinity;
    for (let y = SEA_RIM; y < g.h - SEA_RIM - 1; y += 1) {
      for (let x = SEA_RIM; x < g.w - SEA_RIM - 1; x += 1) {
        const cols = [y * g.w + x, y * g.w + x + 1, (y + 1) * g.w + x, (y + 1) * g.w + x + 1];
        const z = g.heights[cols[0] as number] as number;
        const fits = cols.every((c) => {
          const i = dryFloor(g, c);
          return used[c] === 0 && i >= 0 && g.heights[c] === z && materials.byIndex(map.materialAt(i))?.class === 'soil';
        });
        if (!fits) continue;
        const d = (x - tx) * (x - tx) + (y - ty) * (y - ty);
        if (d < bestD) {
          bestD = d;
          best = y * g.w + x;
        }
      }
    }
    if (best < 0) return;
    const bx = best % g.w;
    const by = Math.floor(best / g.w);
    for (let dy = -1; dy <= 2; dy += 1) {
      for (let dx = -1; dx <= 2; dx += 1) {
        const x = bx + dx;
        const y = by + dy;
        if (x >= 0 && y >= 0 && x < g.w && y < g.h) used[y * g.w + x] = 1;
      }
    }
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      const c = (by + dy) * g.w + bx + dx;
      const i = map.index(bx + dx, by + dy, g.heights[c] as number);
      map.kind[i] = TileKind.Open;
      map.fluid[i] = water;
      g.warmSprings.push(i);
    }
  }
  g.warmSprings.sort((a, b) => a - b);
}

/**
 * `wyrm_roost`: a 9×9 chamber in cavern three at a random interior point (floor at the band's
 * bottom, two levels of headroom), a deepsilver vein next to it, and the sleeping wyrm (D-048).
 */
function wyrmRoost(g: LocalGen, st: RngStream): void {
  const map = g.map;
  const half = Math.floor(WYRM_CHAMBER_SIZE / 2);
  const margin = SEA_RIM + half + 1;
  const cx = st.int(margin, g.w - 1 - margin);
  const cy = st.int(margin, g.h - 1 - margin);
  const z = CAVERN_3_Z_MIN;
  for (let dy = -half; dy <= half; dy += 1) {
    for (let dx = -half; dx <= half; dx += 1) {
      for (let dz = 0; dz <= 2; dz += 1) {
        const i = map.index(cx + dx, cy + dy, z + dz);
        map.kind[i] = dz === 0 ? TileKind.Floor : TileKind.Open;
        map.fluid[i] = 0;
      }
    }
  }
  // The vein starts in the wall just outside the chamber, low enough to lie within reach of magma.
  const near = nearMagma(map, DEEPSILVER_MAGMA_DISTANCE, DEEPSILVER_Z_MAX);
  const start = map.index(cx + half + 1, cy, z);
  if (map.kindAt(start) === TileKind.Wall && near[start] === 1) paintDeepsilver(g, st, start, near);
  g.spawns.push({ kind: 'creature', type: 'magma_wyrm', tile: map.index(cx, cy, z), asleep: true, source: 'wyrm_roost' });
}

export function stageTraits(g: LocalGen): void {
  const st = stageStream(g.s, 'terrain.traits');
  if (hasTrait(g, 'old_battlefield')) battlefield(g, st);
  if (hasTrait(g, 'sunken_halls')) carveHall(g, st);
  if (hasTrait(g, 'gemsprings')) warmSprings(g, st);
  if (hasTrait(g, 'wyrm_roost')) wyrmRoost(g, st);
}

export type { SpawnEntry };
