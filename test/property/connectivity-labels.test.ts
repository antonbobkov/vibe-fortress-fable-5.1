import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Map3D, TileKind } from '@core/map3d';
import { PathingCore, TileGraph } from '@core/pathfinding';
import type { MovementClass, TileIndex } from '@core/types';

/**
 * `01-testing-strategy.md` § Property tests, "connectivity consistency": random wall placements
 * and removals; `reachable(a, b)` equals a flood fill over the same edges for 50 random pairs.
 */

const W = 34;
const H = 10;
const D = 2;
const TILES = W * H * D;

interface Op {
  readonly tile: number;
  readonly wall: boolean;
}

const opArb: fc.Arbitrary<Op> = fc.record({
  tile: fc.integer({ min: 0, max: TILES - 1 }),
  wall: fc.boolean(),
});

function reference(graph: TileGraph, from: TileIndex, cls: MovementClass): Set<TileIndex> {
  const seen = new Set<TileIndex>();
  if (!graph.passable(from, cls)) return seen;
  seen.add(from);
  const stack: TileIndex[] = [from];
  while (stack.length > 0) {
    const cur = stack.pop() as TileIndex;
    graph.forEachEdge(cur, cls, (to) => {
      if (seen.has(to)) return;
      seen.add(to);
      stack.push(to);
    });
  }
  return seen;
}

/** Two floored levels joined by one stairwell, so the graph has vertical edges to label. */
function baseMap(): Map3D {
  const map = new Map3D(W, H, D);
  map.kind.fill(TileKind.Wall);
  for (let z = 0; z < D; z += 1) {
    for (let y = 1; y < H - 1; y += 1) {
      for (let x = 1; x < W - 1; x += 1) map.setKind(map.index(x, y, z), TileKind.Floor, 1);
    }
  }
  map.setKind(map.index(4, 4, 0), TileKind.StairsUp, 1);
  map.setKind(map.index(4, 4, 1), TileKind.StairsDown, 1);
  return map;
}

describe('T-M0-09 property: connectivity labels equal flood-fill reachability', () => {
  it('holds after any sequence of wall placements and removals', () => {
    fc.assert(
      fc.property(
        fc.array(opArb, { minLength: 1, maxLength: 60 }),
        fc.array(fc.tuple(fc.integer({ min: 0, max: TILES - 1 }), fc.integer({ min: 0, max: TILES - 1 })), {
          minLength: 50,
          maxLength: 50,
        }),
        (ops, pairs) => {
          const map = baseMap();
          const core = new PathingCore(map);
          for (const op of ops) {
            map.setKind(op.tile, op.wall ? TileKind.Wall : TileKind.Floor, 1);
          }
          core.onTickEnd();
          const cache = new Map<TileIndex, Set<TileIndex>>();
          for (const [a, b] of pairs) {
            let fill = cache.get(a);
            if (fill === undefined) {
              fill = reference(core.graph, a, 'walker');
              cache.set(a, fill);
            }
            expect(core.connectivity.reachable(a, b, 'walker')).toBe(fill.has(b));
          }
          return true;
        },
      ),
      { numRuns: 25 },
    );
  });

  it('a full rebuild and an incremental rebuild produce the same labelling', () => {
    fc.assert(
      fc.property(fc.array(opArb, { minLength: 1, maxLength: 60 }), (ops) => {
        const incremental = baseMap();
        const core = new PathingCore(incremental);
        for (const op of ops) {
          incremental.setKind(op.tile, op.wall ? TileKind.Wall : TileKind.Floor, 1);
          core.onTickEnd();
        }
        const scratch = baseMap();
        for (const op of ops) scratch.setKind(op.tile, op.wall ? TileKind.Wall : TileKind.Floor, 1);
        const fresh = new PathingCore(scratch);
        for (let i = 0; i < TILES; i += 1) {
          expect(core.connectivity.label(i, 'walker')).toBe(fresh.connectivity.label(i, 'walker'));
        }
        return true;
      }),
      { numRuns: 15 },
    );
  });
});
