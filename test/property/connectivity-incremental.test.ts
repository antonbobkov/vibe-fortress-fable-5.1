import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Map3D, TileKind } from '@core/map3d';
import { MOVEMENT_CLASSES } from '@core/components';
import { PathingCore, TileGraph } from '@core/pathfinding';
import type { MovementClass, TileIndex } from '@core/types';

/**
 * `testing-strategy.md` § Property tests, "connectivity consistency", over the whole edge set
 * (T-M3-09, D-100): random kinds (walls, floors, open tiles, ramps, stairs, fortifications, trees)
 * and random water and magma on a map of 3 × 3 chunks and three levels, changed a few tiles at a
 * time with a tick-end relabel after each batch. For every movement class the labels equal a
 * flood fill over `forEachEdge`, and every tile's label equals the one a fresh full rebuild of the
 * same map gives (so a loaded game, which relabels once, agrees with the running one).
 */

const W = 40;
const H = 36;
const D = 3;
const TILES = W * H * D;

const KINDS: readonly TileKind[] = [
  TileKind.Floor,
  TileKind.Floor,
  TileKind.Floor,
  TileKind.Wall,
  TileKind.Wall,
  TileKind.Open,
  TileKind.Ramp,
  TileKind.StairsUp,
  TileKind.StairsDown,
  TileKind.StairsUpDown,
  TileKind.Fortification,
  TileKind.Tree,
];

interface Op {
  /** A tile near one of the chunk seams, so most changes touch a neighbour's portals. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly kind: number;
  /** 0 none, 1–7 water, 8–14 magma 1–7. */
  readonly fluid: number;
}

const seam = fc.oneof(fc.integer({ min: 13, max: 18 }), fc.integer({ min: 29, max: 34 }), fc.integer({ min: 0, max: 39 }));
const opArb: fc.Arbitrary<Op> = fc.record({
  x: seam.map((v) => Math.min(W - 1, v)),
  y: seam.map((v) => Math.min(H - 1, v)),
  z: fc.integer({ min: 0, max: D - 1 }),
  kind: fc.integer({ min: 0, max: KINDS.length - 1 }),
  fluid: fc.oneof(fc.constant(0), fc.constant(0), fc.integer({ min: 1, max: 14 })),
});

function baseMap(): Map3D {
  const map = new Map3D(W, H, D);
  for (let z = 0; z < D; z += 1) {
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const i = map.index(x, y, z);
        const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
        map.kind[i] = edge ? TileKind.Wall : TileKind.Floor;
      }
    }
  }
  map.kind[map.index(8, 8, 0)] = TileKind.StairsUp;
  map.kind[map.index(8, 8, 1)] = TileKind.StairsUpDown;
  map.kind[map.index(8, 8, 2)] = TileKind.StairsDown;
  return map;
}

function apply(map: Map3D, op: Op): void {
  const i = map.index(op.x, op.y, op.z);
  map.setKind(i, KINDS[op.kind] as TileKind, 1);
  const fluid = op.fluid === 0 ? 0 : op.fluid <= 7 ? Map3D.packFluid(op.fluid) : Map3D.packFluid(op.fluid - 7, 1);
  setFluid(map, i, fluid);
}

/** A fluid write as 04 makes it: the byte, and the chunk marked for relabelling. */
function setFluid(map: Map3D, i: TileIndex, byte: number): void {
  map.fluid[i] = byte;
  const rec = map.chunk(map.chunkOf(i));
  if (rec !== undefined) rec.dirtyPath = true;
}

function flood(graph: TileGraph, from: TileIndex, cls: MovementClass): Set<TileIndex> {
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

describe('T-M3-09 property: incremental relabel (D-100)', () => {
  it('labels equal flood-fill reachability and a fresh full rebuild, for every class, after every batch', () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(opArb, { minLength: 1, maxLength: 6 }), { minLength: 1, maxLength: 8 }),
        fc.array(fc.integer({ min: 0, max: TILES - 1 }), { minLength: 6, maxLength: 6 }),
        (batches, starts) => {
          const map = baseMap();
          const core = new PathingCore(map);
          const scratch = baseMap();
          for (const batch of batches) {
            for (const op of batch) {
              apply(map, op);
              apply(scratch, op);
            }
            core.onTickEnd();
          }
          const fresh = new PathingCore(scratch);
          for (const cls of MOVEMENT_CLASSES as readonly MovementClass[]) {
            for (let i = 0; i < TILES; i += 1) {
              if (core.connectivity.label(i, cls) !== fresh.connectivity.label(i, cls)) {
                expect(core.connectivity.label(i, cls), `${cls} tile ${i}`).toBe(fresh.connectivity.label(i, cls));
              }
            }
            for (const a of starts) {
              const fill = flood(core.graph, a, cls);
              const la = core.connectivity.label(a, cls);
              for (let b = 0; b < TILES; b += 1) {
                const same = la !== 0 && core.connectivity.label(b, cls) === la;
                if (same !== fill.has(b)) expect(same, `${cls} ${a} -> ${b}`).toBe(fill.has(b));
              }
            }
          }
          return true;
        },
      ),
      { numRuns: 30 },
    );
  });

  it('a diagonal opened by digging out a corner tile in a third chunk joins the two chunks it crosses', () => {
    // The corner of four chunks at (16, 16): the diagonal from (15, 15) to (16, 16) crosses from
    // chunk (0, 0) to chunk (1, 1), and its corner tiles (16, 15) and (15, 16) lie in chunks (1, 0)
    // and (0, 1). Walls there block it; turning both into open (impassable, but not a solid
    // obstacle) makes the diagonal exist although neither endpoint's chunk changed.
    const map = new Map3D(W, H, 1);
    map.kind.fill(TileKind.Wall);
    map.kind[map.index(15, 15, 0)] = TileKind.Floor;
    map.kind[map.index(16, 16, 0)] = TileKind.Floor;
    const core = new PathingCore(map);
    const a = map.index(15, 15, 0);
    const b = map.index(16, 16, 0);
    expect(core.connectivity.reachable(a, b, 'walker')).toBe(false);
    map.setKind(map.index(16, 15, 0), TileKind.Open, 1);
    map.setKind(map.index(15, 16, 0), TileKind.Open, 1);
    core.onTickEnd();
    expect(core.connectivity.reachable(a, b, 'walker')).toBe(true);
    map.setKind(map.index(16, 15, 0), TileKind.Wall, 1);
    core.onTickEnd();
    expect(core.connectivity.reachable(a, b, 'walker')).toBe(false);
  });

  it('a class whose component graph a change leaves alone keeps its union-find (only the changed classes relabel)', () => {
    const map = baseMap();
    const core = new PathingCore(map);
    const before = core.connectivity.label(map.index(3, 3, 0), 'amphibious');
    const counts = core.connectivity.globalRebuilds();
    // Level-4 water blocks walkers but not amphibious creatures.
    for (let x = 1; x < W - 1; x += 1) setFluid(map, map.index(x, 20, 0), Map3D.packFluid(4));
    core.onTickEnd();
    const after = core.connectivity.globalRebuilds();
    expect(after.walker).toBe(counts.walker + 1);
    expect(after.amphibious).toBe(counts.amphibious);
    expect(core.connectivity.label(map.index(3, 3, 0), 'amphibious')).toBe(before);
    expect(core.connectivity.reachable(map.index(3, 3, 0), map.index(3, 30, 0), 'walker')).toBe(false);
    expect(core.connectivity.reachable(map.index(3, 3, 0), map.index(3, 30, 0), 'amphibious')).toBe(true);
  });
});
