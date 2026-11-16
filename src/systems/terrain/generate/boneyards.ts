/**
 * Stage 9b, the boneyards: `03-terrain-and-mining.md` § Local map generation, stage 9b;
 * `algorithms/local-map-generation.md` step 7b. After stage 9 and before stage 10, on its own stream
 * (`terrain.giant_bones`), a `desert`, `badlands`, `wetland` or `tundra` map lays one to three
 * skeletons of `giant_bone` on its surface. Every other biome draws nothing from the stream, so its
 * map is the map it was.
 */

import { FluidType, TileFlag, TileKind, isSolidBottomed } from '@core/map3d';
import type { TileIndex } from '@core/types';
import {
  BONEYARD_CLEARANCE,
  BONEYARD_EDGE_MARGIN,
  BONEYARD_MAX,
  BONEYARD_MIN,
  BONEYARD_RIB_WATER_MAX,
  BONEYARD_SPINE_MAX,
  BONEYARD_SPINE_MIN,
  BONEYARD_TRIES,
  BONEYARD_WAGON_BAND,
} from '../constants';
import { COL_LAKE, COL_RIVER, materialIndex, stageStream, type LocalGen } from './common';

/** The biomes whose maps hold boneyards. */
export const BONEYARD_BIOMES: readonly string[] = ['desert', 'badlands', 'wetland', 'tundra'];
/** The bones' material. */
export const GIANT_BONE = 'giant_bone';
/** The tusks' material, the skull's two outer tiles in `tundra`. */
export const TUSK_IVORY = 'ivory';

/** The four cardinal steps, clockwise from north: a direction is an index into it. */
const STEPS: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** One column of a skeleton's shape and what it is. */
type Part = 'skull' | 'tusk' | 'spine' | 'rib' | 'cage';

interface Shape {
  /** Column (`y × w + x`) → part, the first claim kept: skull and tusk, spine, rib, cage. */
  readonly parts: Map<number, Part>;
  /** The claimed columns, ascending. */
  readonly columns: number[];
  /** The skull's columns, in the order laid. */
  readonly skull: number[];
}

/** Inward distance of a column from the arrival edge. */
function inward(g: LocalGen, x: number, y: number): number {
  const e = g.spec.arrivalEdge;
  return e === 'n' ? y : e === 's' ? g.h - 1 - y : e === 'w' ? x : g.w - 1 - x;
}

function wet(g: LocalGen, c: number): boolean {
  return ((g.colFlags[c] as number) & (COL_RIVER | COL_LAKE)) !== 0 || (g.waterTop[c] as number) > 0
    || g.map.fluidLevelAt(g.map.index(c % g.w, Math.floor(c / g.w), g.heights[c] as number)) > 0;
}

/**
 * The shape of a skeleton: a spine of `len` columns from `(x, y)` heading `dir`, turning a quarter
 * once after its `at`-th column when `bent` (`turn` +1 clockwise, −1 the other way); a pair of ribs
 * one column out on each side of every second spine column from the third to the last but one; the
 * cage, the columns beside the spine between its ribs; and a 2×2 skull beyond the spine's first
 * column, on the spine's line and the column clockwise of it, whose two columns farthest from the
 * spine are the tusks.
 */
function shapeOf(g: LocalGen, x: number, y: number, len: number, dir: number, bent: boolean, at: number, turn: number): Shape {
  const parts = new Map<number, Part>();
  const skull: number[] = [];
  const col = (cx: number, cy: number): number => (cx < 0 || cy < 0 || cx >= g.w || cy >= g.h ? -1 : cy * g.w + cx);
  const columns: number[] = [];
  const claim = (c: number, part: Part): void => {
    if (parts.has(c)) return;
    parts.set(c, part);
    columns.push(c);
  };
  const spine: { x: number; y: number; d: number }[] = [];
  let d = dir;
  let sx = x;
  let sy = y;
  for (let i = 0; i < len; i += 1) {
    if (i > 0) {
      if (bent && i - 1 === at) d = (d + 4 + turn) % 4;
      const [ox, oy] = STEPS[d] as readonly [number, number];
      sx += ox;
      sy += oy;
    }
    spine.push({ x: sx, y: sy, d });
  }
  // The skull, beyond the first spine column (its far row is the tusks).
  const [fx, fy] = STEPS[dir] as readonly [number, number];
  const [px, py] = STEPS[(dir + 1) % 4] as readonly [number, number];
  for (const [back, side, part] of [[1, 0, 'skull'], [1, 1, 'skull'], [2, 0, 'tusk'], [2, 1, 'tusk']] as const) {
    const c = col(x - fx * back + px * side, y - fy * back + py * side);
    claim(c, part);
    skull.push(c);
  }
  for (const s of spine) claim(col(s.x, s.y), 'spine');
  const lastRib = len - 2 - ((len - 2) % 2);
  for (let i = 2; i <= lastRib; i += 2) {
    const s = spine[i] as { x: number; y: number; d: number };
    const [rx, ry] = STEPS[(s.d + 1) % 4] as readonly [number, number];
    claim(col(s.x + rx, s.y + ry), 'rib');
    claim(col(s.x - rx, s.y - ry), 'rib');
  }
  for (let i = 3; i < lastRib; i += 2) {
    const s = spine[i] as { x: number; y: number; d: number };
    const [rx, ry] = STEPS[(s.d + 1) % 4] as readonly [number, number];
    claim(col(s.x + rx, s.y + ry), 'cage');
    claim(col(s.x - rx, s.y - ry), 'cage');
  }
  columns.sort((a, b) => a - b);
  return { parts, columns, skull };
}

/**
 * The start column fits: at least `BONEYARD_EDGE_MARGIN` from every edge and from the wagon search
 * band, a dry surface `floor`, no water or other skeleton within `BONEYARD_CLEARANCE` and no tree
 * beside it.
 */
function startFits(g: LocalGen, x: number, y: number, taken: Uint8Array): boolean {
  if (inward(g, x, y) < BONEYARD_WAGON_BAND + BONEYARD_EDGE_MARGIN) return false;
  const c = y * g.w + x;
  if (wet(g, c) || g.bare[c] === 1) return false;
  const map = g.map;
  if (map.kindAt(map.index(x, y, g.heights[c] as number)) !== TileKind.Floor) return false;
  for (let dy = -BONEYARD_CLEARANCE; dy <= BONEYARD_CLEARANCE; dy += 1) {
    for (let dx = -BONEYARD_CLEARANCE; dx <= BONEYARD_CLEARANCE; dx += 1) {
      const nc = (y + dy) * g.w + x + dx;
      if (wet(g, nc) || taken[nc] === 1) return false;
      // A tree only beside the start: a wooded wetland has one within three tiles of nearly every column.
      const near = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
      if (near && map.kindAt(map.index(x + dx, y + dy, g.heights[nc] as number)) === TileKind.Tree) return false;
    }
  }
  return true;
}

/**
 * The shape fits the map: every column of it at least two from every edge, outside the wagon search
 * band, and more than `BONEYARD_CLEARANCE` from every column of another skeleton.
 */
function shapeFits(g: LocalGen, shape: Shape, taken: Uint8Array): boolean {
  for (const c of shape.columns) {
    if (c < 0) return false;
    const x = c % g.w;
    const y = Math.floor(c / g.w);
    if (x < 2 || y < 2 || x >= g.w - 2 || y >= g.h - 2) return false;
    if (inward(g, x, y) <= BONEYARD_WAGON_BAND) return false;
    for (let dy = -BONEYARD_CLEARANCE; dy <= BONEYARD_CLEARANCE; dy += 1) {
      for (let dx = -BONEYARD_CLEARANCE; dx <= BONEYARD_CLEARANCE; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < g.w && ny < g.h && taken[ny * g.w + nx] === 1) return false;
      }
    }
  }
  return true;
}

/**
 * Lay one skeleton: each part on its column's surface tile, where that tile is a dry `floor` (a rib in
 * `wetland` may stand in water no deeper than `BONEYARD_RIB_WATER_MAX`) no more than one level from
 * the spine's start and not a drinking step; a column that fails is left as it was, a gap. The spine
 * is boulders, the ribs and the skull walls one level tall in place of the surface tile (soil becomes
 * bone: the skeleton lies half sunk); in `tundra` the tusks are ivory. Returns the skull's tiles and
 * the cage's walkable tiles, ascending.
 */
function lay(g: LocalGen, shape: Shape, zStart: number, taken: Uint8Array): { skull: TileIndex[]; cage: TileIndex[] } {
  const map = g.map;
  const bone = materialIndex(g, GIANT_BONE);
  const ivory = g.spec.biome === 'tundra' ? materialIndex(g, TUSK_IVORY) : bone;
  const wetland = g.spec.biome === 'wetland';
  const skull: TileIndex[] = [];
  const cage: TileIndex[] = [];
  for (const c of shape.columns) {
    taken[c] = 1;
    const part = shape.parts.get(c) as Part;
    const x = c % g.w;
    const y = Math.floor(c / g.w);
    const z = g.heights[c] as number;
    const i = map.index(x, y, z);
    const kind = map.kindAt(i);
    const level = map.fluidLevelAt(i);
    if (part === 'cage') {
      if (isSolidBottomed(kind) && level === 0) cage.push(i);
      continue;
    }
    if (Math.abs(z - zStart) > 1 || g.bare[c] === 1 || kind !== TileKind.Floor) continue;
    const shallow = wetland && part === 'rib' && level > 0 && level <= BONEYARD_RIB_WATER_MAX && map.fluidTypeAt(i) === FluidType.Water;
    if (!shallow && (level > 0 || wet(g, c))) continue;
    map.kind[i] = part === 'spine' ? TileKind.Boulder : TileKind.Wall;
    map.material[i] = part === 'tusk' ? ivory : bone;
    map.fluid[i] = 0;
    map.flags[i] = (map.flags[i] as number) & ~(TileFlag.Grass | TileFlag.Snow);
    if (part === 'skull' || part === 'tusk') skull.push(i);
  }
  skull.sort((a, b) => a - b);
  cage.sort((a, b) => a - b);
  return { skull, cage };
}

/**
 * Stage 9b: `BONEYARD_MIN`–`BONEYARD_MAX` skeletons, each tried from up to `BONEYARD_TRIES` starts.
 * Each try draws the same numbers whether it fits or not: the start's column, the spine's length,
 * its heading, whether and where it bends and which way.
 */
export function stageBoneyards(g: LocalGen): void {
  if (!BONEYARD_BIOMES.includes(g.spec.biome)) return;
  // A map too small for a start (a test fixture) lays none.
  if (g.w - 1 - BONEYARD_EDGE_MARGIN < BONEYARD_EDGE_MARGIN || g.h - 1 - BONEYARD_EDGE_MARGIN < BONEYARD_EDGE_MARGIN) return;
  const st = stageStream(g.s, 'terrain.giant_bones');
  const taken = new Uint8Array(g.w * g.h);
  const count = st.int(BONEYARD_MIN, BONEYARD_MAX);
  for (let k = 0; k < count; k += 1) {
    for (let t = 0; t < BONEYARD_TRIES; t += 1) {
      const x = st.int(BONEYARD_EDGE_MARGIN, g.w - 1 - BONEYARD_EDGE_MARGIN);
      const y = st.int(BONEYARD_EDGE_MARGIN, g.h - 1 - BONEYARD_EDGE_MARGIN);
      const len = st.int(BONEYARD_SPINE_MIN, BONEYARD_SPINE_MAX);
      const dir = st.int(0, 3);
      const bent = st.chance(500);
      const at = st.int(3, len - 4);
      const turn = st.chance(500) ? 1 : -1;
      if (!startFits(g, x, y, taken)) continue;
      const shape = shapeOf(g, x, y, len, dir, bent, at, turn);
      if (!shapeFits(g, shape, taken)) continue;
      const laid = lay(g, shape, g.heights[y * g.w + x] as number, taken);
      if (laid.skull.length > 0) g.giantSkulls.push(laid.skull);
      g.boneyards.push(laid.cage);
      break;
    }
  }
}
