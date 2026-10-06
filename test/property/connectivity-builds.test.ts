import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { HeadlessGame, buildFlatTestMap } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { TileKind } from '@core/map3d';
import type { TileGraph } from '@core/pathfinding';
import type { TileIndex } from '@core/types';
import type { BuildingsSystem } from '@systems/buildings';

/**
 * `testing-strategy.md` § Property tests, "connectivity consistency", extended with random wall
 * builds (T-M2-05): walls built through 14's completion path (constructions through the terrain
 * API), a hearth (an impassable building through 22's `blocksMovementAt` hook), and walls taken
 * down again; after the tick-end relabel `reachable(a, b)` equals a flood fill over the same edges.
 */

const N = 20;
const Z = 32;

interface Op {
  readonly x: number;
  readonly y: number;
  readonly build: boolean;
}

const opArb: fc.Arbitrary<Op> = fc.record({ x: fc.integer({ min: 2, max: N - 3 }), y: fc.integer({ min: 2, max: N - 3 }), build: fc.boolean() });

function flood(graph: TileGraph, from: TileIndex): Set<TileIndex> {
  const seen = new Set<TileIndex>();
  if (!graph.passable(from, 'walker')) return seen;
  seen.add(from);
  const stack = [from];
  while (stack.length > 0) {
    const cur = stack.pop() as TileIndex;
    graph.forEachEdge(cur, 'walker', (to) => {
      if (seen.has(to)) return;
      seen.add(to);
      stack.push(to);
    });
  }
  return seen;
}

describe('T-M2-05 property: connectivity labels after random wall builds', () => {
  it('reachable equals flood-fill reachability after walls and a hearth are built and walls taken down', () => {
    const registry = contentRegistry();
    fc.assert(
      fc.property(
        fc.array(opArb, { minLength: 1, maxLength: 40 }),
        fc.array(fc.tuple(fc.integer({ min: 0, max: N * N - 1 }), fc.integer({ min: 0, max: N * N - 1 })), { minLength: 20, maxLength: 20 }),
        (ops, pairs) => {
          const game = new HeadlessGame({ seed: 'conn-builds', map: buildFlatTestMap(registry, N, N) });
          const map = game.map;
          const buildings = game.world.scheduler.byId('14') as unknown as BuildingsSystem;
          const granite = registry.table('materials').index('granite');
          let hearth = false;
          for (const op of ops) {
            const t = map.index(op.x, op.y, Z);
            const on = map.buildingAtTile(t);
            if (op.build && on === 0 && map.kindAt(t) === TileKind.Floor) {
              const type = hearth ? 'wall' : 'hearth';
              const r = game.world.applyCommand({ type: 'PlaceBuilding', buildingType: type, origin: t, orientation: 0, materialChoice: 'granite', priority: 5 });
              if (r.ok) {
                buildings.completeNow(buildings.lastPlacedBuilding, granite);
                hearth = true;
              }
            } else if (!op.build && map.kindAt(t) === TileKind.Wall) {
              // A wall taken down: the terrain goes back to floor and 14 drops the construction.
              game.world.services.terrain.setKind(t, TileKind.Floor, granite);
            }
          }
          game.step(1);
          const graph = game.pathing.graph;
          const cache = new Map<TileIndex, Set<TileIndex>>();
          for (const [a2, b2] of pairs) {
            const a = map.index(a2 % N, Math.floor(a2 / N), Z);
            const b = map.index(b2 % N, Math.floor(b2 / N), Z);
            let fill = cache.get(a);
            if (fill === undefined) {
              fill = flood(graph, a);
              cache.set(a, fill);
            }
            expect(game.pathing.connectivity.reachable(a, b, 'walker')).toBe(fill.has(b));
          }
          // A taken-down wall's building is gone.
          for (const [t, id] of map.buildingEntries()) {
            if (buildings.buildings.typeIdOf(id) === 'wall') expect(map.kindAt(t)).toBe(TileKind.Wall);
          }
          return true;
        },
      ),
      { numRuns: 15 },
    );
  });
});
