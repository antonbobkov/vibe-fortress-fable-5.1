/**
 * Stage 2: rivers and lakes. `03-terrain-and-mining.md` § Local map generation stage 2;
 * `algorithms/local-map-generation.md` step 2 (`wander`).
 *
 * The carving is decided here on the height map (before the columns are built, "so beds get
 * stone"); the water itself is written by {@link fillWater} once the columns exist.
 */

import { FLUID_MAX_LEVEL } from '@core/constants';
import { FluidType, Map3D } from '@core/map3d';
import type { RngStream } from '@core/rng';
import type { Edge } from '@core/types';
import { COL_LAKE, COL_RIVER, COL_SINK, COL_SOURCE, stageStream, type LocalGen } from './common';

/** "widen to the class width (brook 1, river 3, major 5)". */
export const RIVER_WIDTH: Readonly<Record<string, number>> = { brook: 1, river: 3, major: 5 };
/** "carve the bed to `surfaceZ − depth` (brook 1, river 2, major 2)". */
export const RIVER_DEPTH: Readonly<Record<string, number>> = { brook: 1, river: 2, major: 2 };
/** "A lake is a depression of radius 6–12". */
export const LAKE_RADIUS_MIN = 6;
export const LAKE_RADIUS_MAX = 12;
/** A lake is carved two levels deep (`h[q] = h − 2`). */
export const LAKE_DEPTH = 2;
/** `wander`: "steps toward `to` 70% / perpendicular 30%". */
export const WANDER_TOWARD_PERMILLE = 700;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The midpoint of a local-map edge. */
export function edgePoint(w: number, h: number, edge: Edge): Point {
  const mx = Math.floor(w / 2);
  const my = Math.floor(h / 2);
  return edge === 'n' ? { x: mx, y: 0 } : edge === 's' ? { x: mx, y: h - 1 } : edge === 'w' ? { x: 0, y: my } : { x: w - 1, y: my };
}

/**
 * `wander(st, from, to)`: a walk that steps toward `to` along the axis with the larger remaining
 * distance 70% of the time and sideways (±1 on the other axis) otherwise, never leaving the map,
 * until it reaches `to`. Returns every tile visited, `from` and `to` included.
 */
export function wander(st: RngStream, from: Point, to: Point, w: number, h: number): Point[] {
  const path: Point[] = [from];
  let x = from.x;
  let y = from.y;
  // The 70% bias makes the walk converge; the cap only guards an impossible stream.
  for (let step = 0; (x !== to.x || y !== to.y) && step < w * h * 4; step += 1) {
    const dx = to.x - x;
    const dy = to.y - y;
    const alongX = Math.abs(dx) >= Math.abs(dy);
    if (st.chance(WANDER_TOWARD_PERMILLE)) {
      if (alongX) x += Math.sign(dx);
      else y += Math.sign(dy);
    } else {
      const side = st.int(0, 1) === 0 ? -1 : 1;
      if (alongX) y = Math.max(0, Math.min(h - 1, y + side));
      else x = Math.max(0, Math.min(w - 1, x + side));
    }
    path.push({ x, y });
  }
  while (x !== to.x || y !== to.y) {
    if (x !== to.x) x += Math.sign(to.x - x);
    else y += Math.sign(to.y - y);
    path.push({ x, y });
  }
  return path;
}

/** A lake centre where the largest lake fits inside the map (DECISIONS.md D-045). */
export function lakeCenter(st: RngStream, w: number, h: number): Point {
  return { x: st.int(LAKE_RADIUS_MAX, w - 1 - LAKE_RADIUS_MAX), y: st.int(LAKE_RADIUS_MAX, h - 1 - LAKE_RADIUS_MAX) };
}

function onEdge(g: LocalGen, x: number, y: number, edge: Edge): boolean {
  return edge === 'n' ? y === 0 : edge === 's' ? y === g.h - 1 : edge === 'w' ? x === 0 : x === g.w - 1;
}

/**
 * Carve one path: every path tile and its width band (a square of side `width`) joins the river;
 * the bed of a band is the lowest surface in it minus the depth, and the water rises to one level
 * below that lowest surface. Where bands overlap the lower bed wins.
 */
function carvePath(g: LocalGen, path: readonly Point[], cls: string, inflow: Edge | null, outflow: Edge | null): void {
  const half = Math.floor((RIVER_WIDTH[cls] ?? 1) / 2);
  const depth = RIVER_DEPTH[cls] ?? 1;
  const original = Int16Array.from(g.heights);
  const bed = new Int16Array(g.w * g.h).fill(0x7fff);
  const top = new Int16Array(g.w * g.h);
  for (const p of path) {
    let low = 0x7fff;
    for (let dy = -half; dy <= half; dy += 1) {
      for (let dx = -half; dx <= half; dx += 1) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
        low = Math.min(low, original[y * g.w + x] as number);
      }
    }
    for (let dy = -half; dy <= half; dy += 1) {
      for (let dx = -half; dx <= half; dx += 1) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
        const c = y * g.w + x;
        if (low - depth < (bed[c] as number)) {
          bed[c] = low - depth;
          top[c] = low;
        }
      }
    }
  }
  for (let c = 0; c < bed.length; c += 1) {
    const b = bed[c] as number;
    if (b === 0x7fff) continue;
    const x = c % g.w;
    const y = Math.floor(c / g.w);
    if ((g.colFlags[c] as number) & (COL_RIVER | COL_LAKE) && (g.heights[c] as number) <= b) continue;
    g.heights[c] = b;
    g.waterTop[c] = top[c] as number;
    g.colFlags[c] = (g.colFlags[c] as number) | COL_RIVER;
    if (inflow !== null && onEdge(g, x, y, inflow)) g.colFlags[c] = (g.colFlags[c] as number) | COL_SOURCE;
    if (outflow !== null && onEdge(g, x, y, outflow)) g.colFlags[c] = (g.colFlags[c] as number) | COL_SINK;
  }
}

/** A disc of radius r around the centre, carved two levels below each column's own surface. */
function carveLake(g: LocalGen, center: Point, radius: number): void {
  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
      if ((x - center.x) * (x - center.x) + (y - center.y) * (y - center.y) > radius * radius) continue;
      const c = y * g.w + x;
      const surface = (g.colFlags[c] as number) & COL_RIVER ? (g.waterTop[c] as number) : (g.heights[c] as number);
      const b = surface - LAKE_DEPTH;
      if ((g.colFlags[c] as number) & COL_RIVER && (g.heights[c] as number) <= b) {
        g.colFlags[c] = (g.colFlags[c] as number) | COL_LAKE;
        continue;
      }
      g.heights[c] = b;
      g.waterTop[c] = surface;
      g.colFlags[c] = (g.colFlags[c] as number) | COL_LAKE;
    }
  }
}

/**
 * Stage 2. A river's paths run from the midpoint of each inflow edge to the midpoint of the
 * outflow edge, or to the lake centre when it has none; a region with no inflow edge starts no
 * path (DECISIONS.md D-045). A lake (the region's own, or the end of a river) is carved last.
 */
export function stageRivers(g: LocalGen): void {
  const st = stageStream(g.s, 'terrain.rivers');
  const river = g.spec.river;
  const needsLake = g.spec.lake || (river !== null && river.outflowEdge === null && river.inflowEdges.length > 0);
  const center = needsLake ? lakeCenter(st, g.w, g.h) : null;
  if (river !== null) {
    const target = river.outflowEdge !== null ? edgePoint(g.w, g.h, river.outflowEdge) : center;
    for (const inflow of river.inflowEdges) {
      if (target === null) break;
      const path = wander(st, edgePoint(g.w, g.h, inflow), target, g.w, g.h);
      carvePath(g, path, river.class, inflow, river.outflowEdge);
    }
  }
  if (center !== null) carveLake(g, center, st.int(LAKE_RADIUS_MIN, LAKE_RADIUS_MAX));
}

/**
 * The water of the wet columns, once the columns exist: level 7 from the bed up to
 * `waterTop − 1`; every water tile of a source column is a `source`; the water tiles of a sink
 * column are recorded as sinks (04).
 */
export function fillWater(g: LocalGen): void {
  const full = Map3D.packFluid(FLUID_MAX_LEVEL, FluidType.Water);
  const source = Map3D.packFluid(FLUID_MAX_LEVEL, FluidType.Water, false, true);
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      const c = y * g.w + x;
      const flags = g.colFlags[c] as number;
      if ((flags & (COL_RIVER | COL_LAKE)) === 0) continue;
      for (let z = g.heights[c] as number; z < (g.waterTop[c] as number); z += 1) {
        const i = g.map.index(x, y, z);
        const isSource = (flags & COL_SOURCE) !== 0;
        g.map.fluid[i] = isSource ? source : full;
        if (isSource) g.waterSources.push(i);
        if ((flags & COL_SINK) !== 0) g.sinks.push(i);
      }
    }
  }
  g.waterSources.sort((a, b) => a - b);
  g.sinks.sort((a, b) => a - b);
}
