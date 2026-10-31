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
import type { LocalMapSpec } from '@systems/embark';
import { SPRING_EDGE_MARGIN } from '../constants';
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

/** A lake centre where the largest lake fits inside the map (docs/04-implementation/algorithms/local-map-generation.md). */
export function lakeCenter(st: RngStream, w: number, h: number): Point {
  return { x: st.int(LAKE_RADIUS_MAX, w - 1 - LAKE_RADIUS_MAX), y: st.int(LAKE_RADIUS_MAX, h - 1 - LAKE_RADIUS_MAX) };
}

/**
 * A river's spring, for a region with no inflow edge: a point drawn by the stream at least
 * `SPRING_EDGE_MARGIN` tiles from every edge and, when the river has an outflow edge, in the half
 * of the map away from it, so the brook crosses at least half the map.
 */
export function springPoint(st: RngStream, w: number, h: number, outflow: Edge | null): Point {
  let x0 = SPRING_EDGE_MARGIN;
  let x1 = w - 1 - SPRING_EDGE_MARGIN;
  let y0 = SPRING_EDGE_MARGIN;
  let y1 = h - 1 - SPRING_EDGE_MARGIN;
  if (outflow === 'e') x1 = Math.floor(w / 2) - 1;
  else if (outflow === 'w') x0 = Math.ceil(w / 2);
  else if (outflow === 's') y1 = Math.floor(h / 2) - 1;
  else if (outflow === 'n') y0 = Math.ceil(h / 2);
  return { x: st.int(x0, x1), y: st.int(y0, y1) };
}

function onEdge(g: LocalGen, x: number, y: number, edge: Edge): boolean {
  return edge === 'n' ? y === 0 : edge === 's' ? y === g.h - 1 : edge === 'w' ? x === 0 : x === g.w - 1;
}

/** The columns of a path's width band (a square of side `width` around each path tile). */
function bandColumns(g: LocalGen, path: readonly Point[], cls: string): Set<number> {
  const half = Math.floor((RIVER_WIDTH[cls] ?? 1) / 2);
  const band = new Set<number>();
  for (const p of path) {
    for (let dy = -half; dy <= half; dy += 1) {
      for (let dx = -half; dx <= half; dx += 1) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (x >= 0 && y >= 0 && x < g.w && y < g.h) band.add(y * g.w + x);
      }
    }
  }
  return band;
}

/** The columns of a lake's disc. */
function discColumns(g: LocalGen, center: Point, radius: number): Set<number> {
  const disc = new Set<number>();
  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
      if ((x - center.x) * (x - center.x) + (y - center.y) * (y - center.y) <= radius * radius) disc.add(y * g.w + x);
    }
  }
  return disc;
}

/**
 * The surface a map's water is held below: the lowest ground among the wet columns and the columns
 * cardinally beside them, before any carving. All the map's water tops out one level under it, so
 * every bank is a wall at the water's top and no step in the water lets a source feed a flood.
 */
function waterSurface(g: LocalGen, wet: Iterable<number>): number {
  let low = 0x7fff;
  for (const c of wet) {
    const x = c % g.w;
    const y = Math.floor(c / g.w);
    low = Math.min(low, g.heights[c] as number);
    if (x > 0) low = Math.min(low, g.heights[c - 1] as number);
    if (x < g.w - 1) low = Math.min(low, g.heights[c + 1] as number);
    if (y > 0) low = Math.min(low, g.heights[c - g.w] as number);
    if (y < g.h - 1) low = Math.min(low, g.heights[c + g.w] as number);
  }
  return low;
}

/** Carve one path's band to `surface` minus the class depth; where bands overlap the lower bed wins. */
function carvePath(g: LocalGen, band: ReadonlySet<number>, cls: string, surface: number, inflow: Edge | null, outflow: Edge | null, spring: Point | null = null): void {
  const half = Math.floor((RIVER_WIDTH[cls] ?? 1) / 2);
  const bed = surface - (RIVER_DEPTH[cls] ?? 1);
  for (const c of band) {
    const x = c % g.w;
    const y = Math.floor(c / g.w);
    if ((g.colFlags[c] as number) & (COL_RIVER | COL_LAKE) && (g.heights[c] as number) <= bed) continue;
    g.heights[c] = bed;
    g.waterTop[c] = surface;
    g.colFlags[c] = (g.colFlags[c] as number) | COL_RIVER;
    if (inflow !== null && onEdge(g, x, y, inflow)) g.colFlags[c] = (g.colFlags[c] as number) | COL_SOURCE;
    if (spring !== null && Math.abs(x - spring.x) <= half && Math.abs(y - spring.y) <= half) g.colFlags[c] = (g.colFlags[c] as number) | COL_SOURCE;
    if (outflow !== null && onEdge(g, x, y, outflow)) g.colFlags[c] = (g.colFlags[c] as number) | COL_SINK;
  }
}

/** A disc carved two levels below `surface`. */
function carveLake(g: LocalGen, disc: ReadonlySet<number>, surface: number): void {
  const bed = surface - LAKE_DEPTH;
  for (const c of disc) {
    g.waterTop[c] = surface;
    g.colFlags[c] = (g.colFlags[c] as number) | COL_LAKE;
    if ((g.heights[c] as number) > bed) g.heights[c] = bed;
  }
}

/** Whether a spec's map has a river: every river region carves one, a source region from its spring. */
export function carvesRiver(spec: Pick<LocalMapSpec, 'river'>): boolean {
  return spec.river !== null;
}

/** Whether a spec's map has a lake: the region's own, or the end of a river with no outflow. */
export function carvesLake(spec: Pick<LocalMapSpec, 'river' | 'lake'>): boolean {
  return spec.lake || (carvesRiver(spec) && spec.river?.outflowEdge === null);
}

/**
 * Stage 2. A river's paths run from the midpoint of each inflow edge to the midpoint of the
 * outflow edge, or to the lake centre when it has none; a region with no inflow edge (the river's
 * source) has one path, from a spring drawn by the stream, whose tiles are the river's sources
 * (docs/04-implementation/algorithms/local-map-generation.md). A lake (the region's own, or the end
 * of a river) is carved last. The paths and the lake are drawn first, since together they set the
 * one level all the water stands at.
 */
export function stageRivers(g: LocalGen): void {
  const st = stageStream(g.s, 'terrain.rivers');
  const river = g.spec.river;
  const needsLake = carvesLake(g.spec);
  const center = needsLake ? lakeCenter(st, g.w, g.h) : null;
  const carves: { band: Set<number>; inflow: Edge | null; spring: Point | null }[] = [];
  if (river !== null) {
    const target = river.outflowEdge !== null ? edgePoint(g.w, g.h, river.outflowEdge) : center;
    for (const inflow of river.inflowEdges) {
      if (target === null) break;
      carves.push({ band: bandColumns(g, wander(st, edgePoint(g.w, g.h, inflow), target, g.w, g.h), river.class), inflow, spring: null });
    }
    if (river.inflowEdges.length === 0 && target !== null) {
      const spring = springPoint(st, g.w, g.h, river.outflowEdge);
      carves.push({ band: bandColumns(g, wander(st, spring, target, g.w, g.h), river.class), inflow: null, spring });
    }
  }
  const disc = center !== null ? discColumns(g, center, st.int(LAKE_RADIUS_MIN, LAKE_RADIUS_MAX)) : null;
  const wet = [...carves.flatMap((carve) => [...carve.band]), ...(disc ?? [])];
  if (wet.length === 0) return;
  const surface = waterSurface(g, wet);
  for (const carve of carves) carvePath(g, carve.band, river?.class ?? '', surface, carve.inflow, river?.outflowEdge ?? null, carve.spring);
  if (disc !== null) carveLake(g, disc, surface);
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
