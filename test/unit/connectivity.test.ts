import { describe, it, expect } from 'vitest';
import { Map3D, TileKind } from '@core/map3d';
import { PathingCore, TileGraph } from '@core/pathfinding';
import type { MovementClass, TileIndex } from '@core/types';
import { fillRect, put, solidMap } from './path-fixtures';

/** Flood fill over the same edges, the reference the labels are compared against. */
export function bfsReachable(graph: TileGraph, from: TileIndex, cls: MovementClass): Set<TileIndex> {
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

describe('T-M0-09 connectivity: labels equal reachability', () => {
  it('two rooms on one level have different labels until a gap joins them', () => {
    const map = solidMap(40, 8, 1);
    fillRect(map, 1, 1, 15, 6, 0, TileKind.Floor);
    fillRect(map, 17, 1, 38, 6, 0, TileKind.Floor);
    const core = new PathingCore(map);
    const left = map.index(2, 2, 0);
    const right = map.index(30, 2, 0);
    expect(core.connectivity.label(left, 'walker')).not.toBe(0);
    expect(core.connectivity.reachable(left, right, 'walker')).toBe(false);

    put(map, 16, 3, 0, TileKind.Floor);
    core.onTickEnd();
    expect(core.connectivity.reachable(left, right, 'walker')).toBe(true);
    expect(core.connectivity.label(left, 'walker')).toBe(core.connectivity.label(right, 'walker'));
  });

  it('a wall put back separates the rooms again on the next rebuild', () => {
    const map = solidMap(40, 8, 1);
    fillRect(map, 1, 1, 38, 6, 0, TileKind.Floor);
    const core = new PathingCore(map);
    const left = map.index(2, 2, 0);
    const right = map.index(30, 2, 0);
    expect(core.connectivity.reachable(left, right, 'walker')).toBe(true);
    for (let y = 0; y < 8; y += 1) map.setKind(map.index(16, y, 0), TileKind.Wall, 1);
    core.onTickEnd();
    expect(core.connectivity.reachable(left, right, 'walker')).toBe(false);
  });

  it('a label is 0 exactly where the tile is impassable', () => {
    const map = solidMap(20, 20, 1);
    fillRect(map, 1, 1, 18, 18, 0, TileKind.Floor);
    const core = new PathingCore(map);
    for (let i = 0; i < map.tileCount; i += 1) {
      const passable = core.graph.passable(i, 'walker');
      expect(core.connectivity.label(i, 'walker') !== 0).toBe(passable);
    }
  });

  it('labels agree with a flood fill over the same edges, across chunks and levels', () => {
    // Two 16-tile-wide chunks joined only through a stairwell on the far side.
    const map = solidMap(34, 18, 3);
    fillRect(map, 1, 1, 14, 16, 0, TileKind.Floor);
    fillRect(map, 19, 1, 32, 16, 0, TileKind.Floor);
    fillRect(map, 1, 1, 32, 16, 1, TileKind.Floor);
    put(map, 5, 5, 0, TileKind.StairsUp);
    put(map, 5, 5, 1, TileKind.StairsUpDown);
    put(map, 25, 5, 0, TileKind.StairsUp);
    put(map, 25, 5, 1, TileKind.StairsUpDown);
    const core = new PathingCore(map);
    const from = map.index(2, 2, 0);
    const reference = bfsReachable(core.graph, from, 'walker');
    for (let i = 0; i < map.tileCount; i += 1) {
      const labelled = core.connectivity.reachable(from, i, 'walker');
      expect(labelled).toBe(reference.has(i));
    }
  });

  it('`large` cannot use the stairwell that joins the levels for a walker', () => {
    const map = solidMap(8, 8, 2);
    fillRect(map, 1, 1, 6, 6, 0, TileKind.Floor);
    fillRect(map, 1, 1, 6, 6, 1, TileKind.Floor);
    put(map, 3, 3, 0, TileKind.StairsUp);
    put(map, 3, 3, 1, TileKind.StairsDown);
    const core = new PathingCore(map);
    const below = map.index(2, 2, 0);
    const above = map.index(2, 2, 1);
    expect(core.connectivity.reachable(below, above, 'walker')).toBe(true);
    expect(core.connectivity.reachable(below, above, 'large')).toBe(false);
  });

  it('`nearestReachable` finds the closest tile sharing the mover’s label', () => {
    const map = solidMap(24, 8, 1);
    fillRect(map, 1, 1, 9, 6, 0, TileKind.Floor);
    fillRect(map, 12, 1, 22, 6, 0, TileKind.Floor);
    const core = new PathingCore(map);
    const from = map.index(2, 3, 0);
    // The target is the rock face between the two rooms: unreachable itself, but its own side
    // has reachable neighbours, which is what a mining job asks for.
    const target = map.index(10, 3, 0);
    expect(core.graph.passable(target, 'walker')).toBe(false);
    const found = core.connectivity.nearestReachable(from, target, 'walker', 500);
    expect(found).toBeGreaterThanOrEqual(0);
    expect(core.connectivity.label(found, 'walker')).toBe(core.connectivity.label(from, 'walker'));
    expect(map.xOf(found)).toBe(9);
    // A mover with no label of its own reaches nothing.
    expect(core.connectivity.nearestReachable(map.index(0, 0, 0), target, 'walker', 500)).toBe(-1);
    // A target walled off from every tile of the mover's component finds nothing either.
    expect(core.connectivity.nearestReachable(from, map.index(16, 3, 0), 'walker', 500)).toBe(-1);
  });

  it('T-522: `nearestReachable` searches through a locked door, the way in, to the tile before it', () => {
    // Two rooms joined by a doorway at x = 10; the door in it is locked, so they have two labels.
    const map = solidMap(24, 8, 1);
    fillRect(map, 1, 1, 9, 6, 0, TileKind.Floor);
    fillRect(map, 11, 1, 22, 6, 0, TileKind.Floor);
    const door = map.index(10, 3, 0);
    map.setKind(door, TileKind.Floor, 1);
    const core = new PathingCore(map, { doorAt: (i) => i === door, blocksMovementAt: (i) => i === door });
    const outside = map.index(2, 3, 0);
    const hearth = map.index(20, 3, 0);
    expect(core.connectivity.reachable(outside, hearth, 'walker')).toBe(false);
    // Without the door the search stops in the hearth's room; with it, it finds the tile before the door.
    for (const goal of [hearth, map.index(16, 5, 0)]) {
      const found = core.connectivity.nearestReachable(outside, goal, 'walker', 500);
      expect(found).toBeGreaterThanOrEqual(0);
      expect(map.xOf(found), 'next to the doorway, on the outer side').toBe(9);
      expect(Math.abs(map.yOf(found) - 3)).toBeLessThanOrEqual(1);
    }
    // The door is no tile of the mover's: a door with nothing beyond it finds nothing.
    expect(core.connectivity.nearestReachable(map.index(0, 0, 0), hearth, 'walker', 500)).toBe(-1);
  });

  it('only the chunks marked dirty are rebuilt', () => {
    const map = solidMap(40, 8, 1);
    fillRect(map, 1, 1, 38, 6, 0, TileKind.Floor);
    const core = new PathingCore(map);
    expect(core.connectivity.rebuildDirty()).toBe(0);
    map.setKind(map.index(20, 3, 0), TileKind.Wall, 1);
    expect(core.connectivity.rebuildDirty()).toBe(1);
    expect(core.connectivity.rebuildDirty()).toBe(0);
  });

  it('a chunk rebuild refreshes the portals of its neighbours’ view too', () => {
    // The seam runs down the chunk boundary at x = 16.
    const map = solidMap(34, 8, 1);
    fillRect(map, 1, 1, 32, 6, 0, TileKind.Floor);
    const core = new PathingCore(map);
    const left = map.index(2, 3, 0);
    const right = map.index(30, 3, 0);
    expect(core.connectivity.reachable(left, right, 'walker')).toBe(true);
    for (let y = 0; y < 8; y += 1) map.setKind(map.index(15, y, 0), TileKind.Wall, 1);
    core.onTickEnd();
    expect(core.connectivity.reachable(left, right, 'walker')).toBe(false);
    for (let y = 1; y <= 6; y += 1) map.setKind(map.index(15, y, 0), TileKind.Floor, 1);
    core.onTickEnd();
    expect(core.connectivity.reachable(left, right, 'walker')).toBe(true);
  });

  it('`amphibious` has its own label set', () => {
    const map = solidMap(8, 8, 1);
    fillRect(map, 1, 1, 6, 6, 0, TileKind.Floor);
    const flooded = map.index(4, 3, 0);
    for (let y = 1; y <= 6; y += 1) {
      map.fluid[map.index(4, y, 0)] = Map3D.packFluid(7);
    }
    const core = new PathingCore(map);
    const left = map.index(2, 3, 0);
    const right = map.index(6, 3, 0);
    expect(core.graph.passable(flooded, 'walker')).toBe(false);
    expect(core.connectivity.reachable(left, right, 'walker')).toBe(false);
    expect(core.connectivity.reachable(left, right, 'amphibious')).toBe(true);
  });
});
