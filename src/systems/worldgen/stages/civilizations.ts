/**
 * Stage 6: civilizations. `02-systems/01-world-generation.md` § Civilizations;
 * `algorithms/world-generation.md` step 6.
 */

import type { Civ, Edge } from '@core/types';
import { CIV_MIN_SEPARATION } from '../constants';
import { CIVS, type GenRegion, type GenWorld } from '../state';
import { chebyshev, isOcean, neighbors4, neighbors8 } from './common';

/** "if none, relax separation by 2 and retry". */
export const CIV_SEPARATION_RELAX_STEP = 2;

/** Travel cost of one step into a mountain or alpine region (every other land step costs 1). */
export const CIV_MOUNTAIN_STEP_COST = 2;

const MOUNTAINOUS = new Set(['mountain', 'alpine']);
const FORESTS = new Set(['temperate_forest', 'tropical_forest']);

/**
 * The `civDistance` of a region no land route reaches (the sea, an island): larger than any route
 * on the map, so it reads as "as far as can be" (DECISIONS.md D-041).
 */
export function unreachableDistance(size: number): number {
  return size * size * CIV_MOUNTAIN_STEP_COST;
}

/** Size of the 4-connected component of `r` among regions whose biome is in `biomes`. */
function componentSizes(g: GenWorld, biomes: ReadonlySet<string>): Map<number, number> {
  const sizes = new Map<number, number>();
  const seen = new Uint8Array(g.regions.length);
  for (const start of g.regions) {
    if (seen[start.id] === 1 || !biomes.has(start.biome)) continue;
    const members: number[] = [];
    const stack = [start];
    seen[start.id] = 1;
    while (stack.length > 0) {
      const r = stack.pop() as GenRegion;
      members.push(r.id);
      for (const n of neighbors4(g, r)) {
        if (seen[n.id] === 1 || !biomes.has(n.biome)) continue;
        seen[n.id] = 1;
        stack.push(n);
      }
    }
    for (const id of members) sizes.set(id, members.length);
  }
  return sizes;
}

/**
 * `place(civ, score)`: the argmax of `score` over land regions at Chebyshev distance ≥ the
 * separation from every placed home, ties by id; with no such region the separation is relaxed by
 * 2 and the search repeated.
 */
export function placeHome(
  g: GenWorld,
  placed: readonly GenRegion[],
  score: (r: GenRegion) => number,
  separation = CIV_MIN_SEPARATION,
): GenRegion {
  for (let sep = separation; ; sep = Math.max(0, sep - CIV_SEPARATION_RELAX_STEP)) {
    let best: GenRegion | null = null;
    let bestScore = -Infinity;
    for (const r of g.regions) {
      if (isOcean(r)) continue;
      if (placed.some((p) => chebyshev(p, r) < sep)) continue;
      const s = score(r);
      if (s > bestScore) {
        best = r;
        bestScore = s;
      }
    }
    if (best !== null) return best;
    if (sep === 0) break;
  }
  // No land at all: the first region stands in, so every civilization still has a home.
  return g.regions[0] as GenRegion;
}

/** "the edge on the straight line toward the home": the dominant axis, ties horizontal (D-041). */
export function edgeTowardHome(from: { x: number; y: number }, home: { x: number; y: number }): Edge {
  const dx = home.x - from.x;
  const dy = home.y - from.y;
  if (dx === 0 && dy === 0) return 'n';
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'e' : 'w';
  return dy > 0 ? 's' : 'n';
}

/** Dijkstra over land from `home`, 1 per step and 2 per step into a mountain or alpine region. */
export function landDistances(g: GenWorld, home: GenRegion): number[] {
  const far = unreachableDistance(g.size);
  const dist = new Array<number>(g.regions.length).fill(far);
  if (isOcean(home)) return dist;
  dist[home.id] = 0;
  // Costs are 1 or 2, so a bucket queue in cost order is exact and deterministic.
  const buckets: number[][] = [[home.id]];
  for (let d = 0; d < buckets.length; d += 1) {
    const bucket = buckets[d];
    if (bucket === undefined) continue;
    for (let k = 0; k < bucket.length; k += 1) {
      const id = bucket[k] as number;
      if (dist[id] !== d) continue;
      const r = g.regions[id] as GenRegion;
      for (const n of neighbors4(g, r)) {
        if (isOcean(n)) continue;
        const nd = d + (MOUNTAINOUS.has(n.biome) ? CIV_MOUNTAIN_STEP_COST : 1);
        if (nd < (dist[n.id] as number)) {
          dist[n.id] = nd;
          (buckets[nd] ??= []).push(n.id);
        }
      }
    }
  }
  return dist;
}

export function stageCivilizations(g: GenWorld): void {
  // Placement is fully determined by the scores (ties by id), so the stage's stream
  // (`worldgen.civs`) is never drawn from.
  const mountainClusters = componentSizes(g, MOUNTAINOUS);
  const homes: Partial<Record<Civ, GenRegion>> = {};
  const placed: GenRegion[] = [];
  const put = (civ: Civ, score: (r: GenRegion) => number): GenRegion => {
    const home = placeHome(g, placed, score);
    homes[civ] = home;
    placed.push(home);
    return home;
  };

  const mountainhome = put('mountainhome', (r) =>
    MOUNTAINOUS.has(r.biome) ? 100 + (mountainClusters.get(r.id) ?? 0) : 0,
  );
  const gloam = put('gloam', (r) =>
    r.biome === 'badlands' || r.biome === 'taiga' ? 50 + chebyshev(r, mountainhome) : 0,
  );
  for (const n of neighbors8(g, gloam)) if (!isOcean(n)) n.biome = 'dark_forest';
  put('hillfolk', (r) => ((r.biome === 'temperate_grassland' || r.biome === 'savanna') && r.river !== null ? 60 : 0));
  const forests = componentSizes(g, FORESTS);
  put('wildwood', (r) => (FORESTS.has(r.biome) ? (forests.get(r.id) ?? 0) : 0));

  for (const civ of CIVS) {
    const home = homes[civ] as GenRegion;
    g.civHomes[civ] = home.id;
    const dist = landDistances(g, home);
    for (const r of g.regions) {
      r.civDistance[civ] = dist[r.id] as number;
      r.nearestEdgeTo[civ] = edgeTowardHome(r, home);
    }
  }
}
