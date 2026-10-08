/**
 * Stage 4: rivers. `02-systems/01-world-generation.md` § Rivers; `algorithms/world-generation.md`
 * step 4 (`traceRiver`).
 */

import { BROOK_LENGTH, MAJOR_LENGTH, RIVER_SOURCE_ELEVATION, RIVER_SOURCE_RAIN } from '../constants';
import type { GenRegion, GenWorld, RiverClass } from '../state';
import { chebyshev, edgeToward, isOcean, neighbors4, regionAt, stageStream } from './common';

/** Sources are "at least 4 regions apart" (Chebyshev distance). */
export const RIVER_SOURCE_SPACING = 4;

const CLASS_RANK: Readonly<Record<RiverClass, number>> = { brook: 0, river: 1, major: 2 };

export function classRank(c: RiverClass): number {
  return CLASS_RANK[c];
}

/** `i < BROOK_LENGTH ? brook : i < MAJOR_LENGTH ? river : major`. */
export function classAt(i: number): RiverClass {
  return i < BROOK_LENGTH ? 'brook' : i < MAJOR_LENGTH ? 'river' : 'major';
}

function higher(a: RiverClass | null, b: RiverClass): RiverClass {
  return a === null || CLASS_RANK[b] > CLASS_RANK[a] ? b : a;
}

/** The downstream neighbour a region's outflow edge points at. */
function downstream(g: GenWorld, r: GenRegion): GenRegion | undefined {
  const out = r.river?.outflow ?? null;
  if (out === null) return undefined;
  const dx = out === 'e' ? 1 : out === 'w' ? -1 : 0;
  const dy = out === 's' ? 1 : out === 'n' ? -1 : 0;
  return regionAt(g, r.x + dx, r.y + dy);
}

/** Choose the sources: `size / 8` of them, picked from the candidates in id order. */
export function chooseSources(g: GenWorld): GenRegion[] {
  const st = stageStream(g.s, 'worldgen.rivers');
  let candidates = g.regions.filter((r) => r.elevation >= RIVER_SOURCE_ELEVATION && r.rain >= RIVER_SOURCE_RAIN);
  const want = Math.floor(g.size / 8);
  const sources: GenRegion[] = [];
  while (sources.length < want && candidates.length > 0) {
    const c = st.pick(candidates);
    candidates = candidates.filter((d) => chebyshev(c, d) >= RIVER_SOURCE_SPACING);
    sources.push(c);
  }
  return sources.sort((a, b) => a.id - b.id);
}

/**
 * `traceRiver`: follow the lowest lower cardinal neighbour (ties by id) until the sea, an existing
 * river (a confluence: the confluence and everything downstream of it become `major`), or a
 * local minimum (a lake). A source that an earlier river already runs through starts no new river
 * (docs/04-implementation/algorithms/world-generation.md § Rivers).
 */
export function traceRiver(g: GenWorld, src: GenRegion): void {
  if (src.river !== null) return;
  const riverId = g.rivers.length;
  src.river = { inflow: [], outflow: null, class: null };
  const path: GenRegion[] = [src];
  let cur = src;
  let confluence = false;
  for (;;) {
    const here = cur;
    const lower = neighbors4(g, here)
      .filter((n) => n.elevation < here.elevation)
      .sort((a, b) => a.elevation - b.elevation || a.id - b.id);
    const next = lower[0];
    if (next === undefined) {
      here.lake = true;
      break;
    }
    const joined = next.river !== null;
    (here.river as NonNullable<GenRegion['river']>).outflow = edgeToward(here, next);
    if (next.river === null) next.river = { inflow: [], outflow: null, class: null };
    next.river.inflow.push(edgeToward(next, here));
    path.push(next);
    cur = next;
    if (isOcean(cur)) break;
    if (joined) {
      confluence = true;
      break;
    }
  }
  for (let i = 0; i < path.length; i += 1) {
    const river = (path[i] as GenRegion).river as NonNullable<GenRegion['river']>;
    // A region an earlier river already classed (the confluence, or a shared sea mouth) keeps the
    // higher of the two classes, so both rivers stay monotone.
    river.class = higher(river.class, classAt(i));
  }
  if (confluence) {
    let r: GenRegion | undefined = cur;
    const seen = new Set<number>();
    while (r !== undefined && r.river !== null && !seen.has(r.id)) {
      seen.add(r.id);
      r.river.class = 'major';
      r = downstream(g, r);
    }
  }
  g.rivers.push({ id: riverId, regions: path.map((r) => r.id), class: 'brook' });
}

export function stageRivers(g: GenWorld): void {
  for (const src of chooseSources(g)) traceRiver(g, src);
  // "class: last class": the class of the river's last region, read once every river is traced so
  // that a later confluence's `major` is reflected.
  for (const rv of g.rivers) {
    const last = g.regions[rv.regions[rv.regions.length - 1] as number];
    rv.class = last?.river?.class ?? 'brook';
  }
}
