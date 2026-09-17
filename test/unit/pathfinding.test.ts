import { describe, it, expect } from 'vitest';
import { FLUID_DEEP_LEVEL, FLUID_WADE_LEVEL } from '@core/constants';
import { FluidType, Map3D, TileFlag, TileKind } from '@core/map3d';
import {
  DOOR_COST_PENALTY,
  LOS_MAX,
  PATH_NODE_LIMIT,
  RESTRICTED_COST_MULTIPLIER,
  SNOW_MOVE_COST_PERCENT,
  STEP_COST,
  WADE_COST_MULTIPLIER,
  WADE_LARGE_SIZE,
  WEB_COST_MULTIPLIER,
} from '@core/path-constants';
import { PathingCore, Pathfinder, TileGraph } from '@core/pathfinding';
import type { MovementClass, TileIndex } from '@core/types';
import { emptyMap, fillRect, put, solidMap } from './path-fixtures';

function graphOf(map: Map3D): TileGraph {
  return new TileGraph(map);
}

/** Dijkstra over the same edge function, the reference the A* result is compared against. */
function dijkstra(graph: TileGraph, from: TileIndex, cls: MovementClass): Map<TileIndex, number> {
  const dist = new Map<TileIndex, number>([[from, 0]]);
  const frontier: TileIndex[] = [from];
  while (frontier.length > 0) {
    let bestAt = 0;
    for (let k = 1; k < frontier.length; k += 1) {
      const a = dist.get(frontier[k] as TileIndex) as number;
      const b = dist.get(frontier[bestAt] as TileIndex) as number;
      if (a < b) bestAt = k;
    }
    const cur = frontier.splice(bestAt, 1)[0] as TileIndex;
    const g = dist.get(cur) as number;
    graph.forEachEdge(cur, cls, (to, stepCost) => {
      const ng = g + stepCost;
      const known = dist.get(to);
      if (known === undefined || ng < known) {
        dist.set(to, ng);
        if (!frontier.includes(to)) frontier.push(to);
      }
    });
  }
  return dist;
}

function costOfPath(graph: TileGraph, from: TileIndex, path: readonly TileIndex[], cls: MovementClass): number {
  let total = 0;
  let cur = from;
  for (let k = 0; k < path.length; k += 1) {
    const next = path[k] as TileIndex;
    let found = -1;
    graph.forEachEdge(cur, cls, (to, stepCost) => {
      if (to === next) found = stepCost;
    });
    expect(found).toBeGreaterThan(0);
    total += found;
    cur = next;
  }
  return total;
}

describe('T-M0-09 pathfinding: passability by tile kind', () => {
  const enterable: TileKind[] = [
    TileKind.Floor,
    TileKind.Ramp,
    TileKind.StairsUp,
    TileKind.StairsDown,
    TileKind.StairsUpDown,
    TileKind.Sapling,
    TileKind.Shrub,
  ];
  const never: TileKind[] = [TileKind.Wall, TileKind.Tree, TileKind.Boulder, TileKind.Open];

  for (const kind of enterable) {
    it(`kind ${TileKind[kind]} is enterable by every land class`, () => {
      const map = solidMap(4, 4, 2);
      const i = put(map, 1, 1, 0, kind);
      const graph = graphOf(map);
      expect(graph.passable(i, 'walker')).toBe(true);
      expect(graph.passable(i, 'small')).toBe(true);
      expect(graph.passable(i, 'large')).toBe(true);
      expect(graph.passable(i, 'amphibious')).toBe(true);
      // `aquatic` may enter only water at or above the deep level.
      expect(graph.passable(i, 'aquatic')).toBe(false);
    });
  }

  for (const kind of never) {
    it(`kind ${TileKind[kind]} is never enterable`, () => {
      const map = solidMap(4, 4, 2);
      const i = put(map, 1, 1, 0, kind);
      const graph = graphOf(map);
      for (const cls of ['walker', 'small', 'large', 'aquatic', 'amphibious'] as MovementClass[]) {
        expect(graph.passable(i, cls)).toBe(false);
      }
    });
  }

  it('a fortification is enterable by `small` only', () => {
    const map = solidMap(4, 4, 2);
    const i = put(map, 1, 1, 0, TileKind.Fortification);
    const graph = graphOf(map);
    expect(graph.passable(i, 'small')).toBe(true);
    expect(graph.passable(i, 'walker')).toBe(false);
    expect(graph.passable(i, 'large')).toBe(false);
  });

  it('an out-of-range index is never passable', () => {
    const map = solidMap(4, 4, 2);
    const graph = graphOf(map);
    expect(graph.passable(-1, 'walker')).toBe(false);
    expect(graph.passable(map.tileCount, 'walker')).toBe(false);
  });

  it('deep water blocks the land classes and admits the water ones', () => {
    const map = solidMap(4, 4, 2);
    const i = put(map, 1, 1, 0, TileKind.Floor);
    map.fluid[i] = Map3D.packFluid(FLUID_DEEP_LEVEL, FluidType.Water);
    const graph = graphOf(map);
    expect(graph.passable(i, 'walker')).toBe(false);
    expect(graph.passable(i, 'small')).toBe(false);
    expect(graph.passable(i, 'large')).toBe(false);
    expect(graph.passable(i, 'aquatic')).toBe(true);
    expect(graph.passable(i, 'amphibious')).toBe(true);
  });

  it('a large creature at WADE_LARGE_SIZE wades until level 7', () => {
    const map = solidMap(4, 4, 2);
    const i = put(map, 1, 1, 0, TileKind.Floor);
    const graph = graphOf(map);
    map.fluid[i] = Map3D.packFluid(6, FluidType.Water);
    expect(graph.passable(i, 'large', { size: WADE_LARGE_SIZE })).toBe(true);
    expect(graph.passable(i, 'large', { size: WADE_LARGE_SIZE - 1 })).toBe(false);
    map.fluid[i] = Map3D.packFluid(7, FluidType.Water);
    expect(graph.passable(i, 'large', { size: WADE_LARGE_SIZE })).toBe(false);
  });

  it('magma blocks every class unless the species is magma-safe', () => {
    const map = solidMap(4, 4, 2);
    const i = put(map, 1, 1, 0, TileKind.Floor);
    map.fluid[i] = Map3D.packFluid(1, FluidType.Magma);
    const graph = graphOf(map);
    for (const cls of ['walker', 'small', 'large', 'aquatic', 'amphibious'] as MovementClass[]) {
      expect(graph.passable(i, cls)).toBe(false);
    }
    expect(graph.passable(i, 'walker', { magmaSafe: true })).toBe(true);
    // Magma is never water: an aquatic creature is not admitted by a deep magma pool.
    map.fluid[i] = Map3D.packFluid(FLUID_DEEP_LEVEL, FluidType.Magma);
    expect(graph.passable(i, 'aquatic', { magmaSafe: true })).toBe(false);
  });

  it('burning blocks every class and the forbidden set blocks only the fortress', () => {
    const map = solidMap(4, 4, 2);
    const i = put(map, 1, 1, 0, TileKind.Floor);
    const graph = graphOf(map);
    map.setFlag(i, TileFlag.Burning, true);
    expect(graph.passable(i, 'walker')).toBe(false);
    expect(graph.passable(i, 'aquatic', { magmaSafe: true })).toBe(false);
    map.setFlag(i, TileFlag.Burning, false);

    const forbidding = new TileGraph(map, { forbidden: (t) => t === i });
    expect(forbidding.passable(i, 'walker', { faction: 'fortress' })).toBe(false);
    expect(forbidding.passable(i, 'walker', { faction: 'wild' })).toBe(true);
  });

  it('a building hook blocks movement; it answers "no building" until M2', () => {
    const map = solidMap(4, 4, 2);
    const i = put(map, 1, 1, 0, TileKind.Floor);
    expect(graphOf(map).passable(i, 'walker')).toBe(true);
    const blocked = new TileGraph(map, { blocksMovementAt: (t) => t === i });
    expect(blocked.passable(i, 'walker')).toBe(false);
  });
});

describe('T-M0-09 pathfinding: costs', () => {
  it('a plain step costs one step', () => {
    const map = solidMap(4, 4, 2);
    const i = put(map, 1, 1, 0, TileKind.Floor);
    expect(graphOf(map).cost(i, 'walker')).toBe(STEP_COST);
  });

  it('shallow water doubles the cost for everyone but an aquatic creature', () => {
    const map = solidMap(4, 4, 2);
    const i = put(map, 1, 1, 0, TileKind.Floor);
    map.fluid[i] = Map3D.packFluid(FLUID_WADE_LEVEL, FluidType.Water);
    const graph = graphOf(map);
    expect(graph.cost(i, 'walker')).toBe(STEP_COST * WADE_COST_MULTIPLIER);
    expect(graph.cost(i, 'aquatic')).toBe(STEP_COST);
  });

  it('snow, restriction, webs and doors apply the documented multipliers', () => {
    const map = solidMap(4, 4, 2);
    const i = put(map, 1, 1, 0, TileKind.Floor);
    const graph = new TileGraph(map, { doorAt: (t) => t === i });
    map.setFlag(i, TileFlag.Snow, true);
    expect(graph.cost(i, 'walker')).toBe((STEP_COST * SNOW_MOVE_COST_PERCENT) / 100 + DOOR_COST_PENALTY);
    map.setFlag(i, TileFlag.Snow, false);
    map.setFlag(i, TileFlag.Restricted, true);
    expect(graph.cost(i, 'walker', { faction: 'fortress' })).toBe(
      STEP_COST * RESTRICTED_COST_MULTIPLIER + DOOR_COST_PENALTY,
    );
    expect(graph.cost(i, 'walker', { faction: 'wild' })).toBe(STEP_COST + DOOR_COST_PENALTY);
    map.setFlag(i, TileFlag.Restricted, false);
    map.setFlag(i, TileFlag.Web, true);
    expect(graph.cost(i, 'walker')).toBe(STEP_COST * WEB_COST_MULTIPLIER + DOOR_COST_PENALTY);
  });
});

describe('T-M0-09 pathfinding: edges', () => {
  it('a diagonal is refused when either orthogonal neighbour is solid', () => {
    const map = solidMap(5, 5, 1);
    const a = put(map, 1, 1, 0, TileKind.Floor);
    const b = put(map, 2, 2, 0, TileKind.Floor);
    put(map, 2, 1, 0, TileKind.Floor);
    put(map, 1, 2, 0, TileKind.Floor);
    const graph = graphOf(map);
    expect(graph.hasEdge(a, b, 'walker')).toBe(true);
    // Put a wall back on one of the two orthogonal corners: the diagonal is cut off.
    map.setKind(map.index(2, 1, 0), TileKind.Wall, 1);
    expect(graph.hasEdge(a, b, 'walker')).toBe(false);
    // A tree, a boulder and a fortification block the corner the same way.
    map.setKind(map.index(2, 1, 0), TileKind.Fortification, 1);
    expect(graph.hasEdge(a, b, 'walker')).toBe(false);
    map.setKind(map.index(2, 1, 0), TileKind.Floor, 1);
    expect(graph.hasEdge(a, b, 'walker')).toBe(true);
  });

  it('a diagonal costs 1414 to the straight step’s 1000', () => {
    const map = solidMap(5, 5, 1);
    const a = put(map, 1, 1, 0, TileKind.Floor);
    const diagonal = put(map, 2, 2, 0, TileKind.Floor);
    const straight = put(map, 2, 1, 0, TileKind.Floor);
    put(map, 1, 2, 0, TileKind.Floor);
    const graph = graphOf(map);
    const costs = new Map(graph.edges(a, 'walker'));
    expect(costs.get(straight)).toBe(1000);
    expect(costs.get(diagonal)).toBe(1414);
  });

  it('stairs connect both directions and refuse `large`', () => {
    const map = solidMap(4, 4, 3);
    const lower = put(map, 1, 1, 0, TileKind.StairsUp);
    const upper = put(map, 1, 1, 1, TileKind.StairsDown);
    const graph = graphOf(map);
    expect(graph.hasEdge(lower, upper, 'walker')).toBe(true);
    expect(graph.hasEdge(upper, lower, 'walker')).toBe(true);
    expect(graph.hasEdge(lower, upper, 'large')).toBe(false);
    expect(graph.hasEdge(upper, lower, 'large')).toBe(false);
  });

  it('a stairs pair that does not match in kind has no edge', () => {
    const map = solidMap(4, 4, 3);
    const lower = put(map, 1, 1, 0, TileKind.StairsDown);
    const upper = put(map, 1, 1, 1, TileKind.StairsDown);
    const graph = graphOf(map);
    expect(graph.hasEdge(lower, upper, 'walker')).toBe(false);
  });

  it('a locked hatch removes the stairs edge through its tile', () => {
    const map = solidMap(4, 4, 3);
    const lower = put(map, 1, 1, 0, TileKind.StairsUp);
    const upper = put(map, 1, 1, 1, TileKind.StairsDown);
    const graph = new TileGraph(map, { lockedHatchAt: (t) => t === upper });
    expect(graph.hasEdge(lower, upper, 'walker')).toBe(false);
  });

  it('a ramp connects to the tile above the solid it leans on, both ways, for every class', () => {
    // z=0: ramp at (2,2) leaning on the wall at (3,2). z=1: open above the ramp, floor above the wall.
    const map = solidMap(6, 6, 3);
    const ramp = put(map, 2, 2, 0, TileKind.Ramp);
    put(map, 2, 2, 1, TileKind.Open);
    const exit = put(map, 3, 2, 1, TileKind.Floor);
    const graph = graphOf(map);
    expect(map.kindAt(map.index(3, 2, 0))).toBe(TileKind.Wall);
    expect(graph.hasEdge(ramp, exit, 'walker')).toBe(true);
    expect(graph.hasEdge(exit, ramp, 'walker')).toBe(true);
    // Ramps are the only vertical route for `large`.
    expect(graph.hasEdge(ramp, exit, 'large')).toBe(true);
    expect(graph.hasEdge(exit, ramp, 'large')).toBe(true);
  });

  it('a ramp with a floor built above it is a dead end', () => {
    const map = solidMap(6, 6, 3);
    const ramp = put(map, 2, 2, 0, TileKind.Ramp);
    put(map, 2, 2, 1, TileKind.Floor);
    const exit = put(map, 3, 2, 1, TileKind.Floor);
    const graph = graphOf(map);
    expect(graph.hasEdge(ramp, exit, 'walker')).toBe(false);
    expect(graph.hasEdge(exit, ramp, 'walker')).toBe(false);
  });

  it('a ramp with no solid cardinal neighbour has no vertical edge', () => {
    const map = solidMap(6, 6, 3);
    const ramp = put(map, 2, 2, 0, TileKind.Ramp);
    put(map, 2, 2, 1, TileKind.Open);
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as [number, number][]) {
      put(map, 2 + dx, 2 + dy, 0, TileKind.Floor);
      put(map, 2 + dx, 2 + dy, 1, TileKind.Floor);
    }
    const graph = graphOf(map);
    const targets = graph.edges(ramp, 'walker').map(([to]) => map.zOf(to));
    expect(targets.every((z) => z === 0)).toBe(true);
  });
});

describe('T-M0-09 pathfinding: A*', () => {
  /** A 3-level maze: two rooms per level joined by stairs, with walls carved by a fixed LCG. */
  function maze(): { map: Map3D; graph: TileGraph } {
    const map = solidMap(16, 16, 3);
    let seed = 12345;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed;
    };
    for (let z = 0; z < 3; z += 1) {
      fillRect(map, 0, 0, 15, 15, z, TileKind.Floor);
      for (let k = 0; k < 90; k += 1) {
        const x = next() % 16;
        const y = next() % 16;
        if (x === 1 && y === 1) continue;
        if (x === 14 && y === 14) continue;
        if (x === 8 && y === 8) continue;
        map.setKind(map.index(x, y, z), TileKind.Wall, 1);
      }
      if (z < 2) {
        map.setKind(map.index(8, 8, z), TileKind.StairsUp, 1);
        map.setKind(map.index(8, 8, z + 1), TileKind.StairsUpDown, 1);
      }
    }
    map.setKind(map.index(8, 8, 2), TileKind.StairsDown, 1);
    return { map, graph: graphOf(map) };
  }

  it('an immediate search finds a path of the Dijkstra cost on a 3D maze', () => {
    const { map, graph } = maze();
    const finder = new Pathfinder(map, graph);
    const from = map.index(1, 1, 0);
    const reference = dijkstra(graph, from, 'walker');
    let checked = 0;
    for (const to of [map.index(14, 14, 0), map.index(1, 1, 2), map.index(14, 14, 2), map.index(8, 8, 1)]) {
      const expected = reference.get(to);
      const path = finder.searchImmediate(from, to, 'walker');
      if (expected === undefined) {
        expect(path).toBeNull();
        continue;
      }
      expect(path).not.toBeNull();
      expect((path as TileIndex[])[(path as TileIndex[]).length - 1]).toBe(to);
      expect(costOfPath(graph, from, path as TileIndex[], 'walker')).toBe(expected);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });

  /** The reachable tile with the largest Dijkstra distance; always a valid, demanding target. */
  function farthest(graph: TileGraph, from: TileIndex, cls: MovementClass): TileIndex {
    let best = from;
    let bestCost = -1;
    dijkstra(graph, from, cls).forEach((cost, tile) => {
      if (cost > bestCost || (cost === bestCost && tile < best)) {
        bestCost = cost;
        best = tile;
      }
    });
    return best;
  }

  it('a queued request finds the same path as the immediate search', () => {
    const { map, graph } = maze();
    const finder = new Pathfinder(map, graph);
    const from = map.index(1, 1, 0);
    const to = farthest(graph, from, 'walker');
    const id = finder.requestPath(1, from, to, 'walker', 'job');
    expect(finder.pathResult(id).state).toBe('pending');
    finder.tick();
    const result = finder.pathResult(id);
    expect(result.state).toBe('ready');
    const direct = finder.searchImmediate(from, to, 'walker') as TileIndex[];
    expect(result.state === 'ready' ? [...result.path] : null).toEqual(direct);
  });

  it('the node budget is spent per tick and the search resumes on the next one', () => {
    const { map, graph } = maze();
    const finder = new Pathfinder(map, graph);
    const from = map.index(1, 1, 0);
    const to = farthest(graph, from, 'walker');
    const id = finder.requestPath(1, from, to, 'walker', 'job');
    let ticks = 0;
    let spentOnFirst = 0;
    while (finder.pathResult(id).state === 'pending' && ticks < 200) {
      const used = finder.tick(5);
      if (ticks === 0) spentOnFirst = used;
      expect(used).toBeLessThanOrEqual(5);
      ticks += 1;
    }
    expect(spentOnFirst).toBe(5);
    expect(ticks).toBeGreaterThan(1);
    expect(finder.pathResult(id).state).toBe('ready');
  });

  it('requests are served by urgency and then by request id', () => {
    const map = solidMap(8, 8, 1);
    fillRect(map, 0, 0, 7, 7, 0, TileKind.Floor);
    const graph = graphOf(map);
    const finder = new Pathfinder(map, graph);
    const from = map.index(0, 0, 0);
    const to = map.index(7, 7, 0);
    const wander = finder.requestPath(1, from, to, 'walker', 'wander');
    const flee = finder.requestPath(2, from, to, 'walker', 'flee');
    // One node of budget: only the first request in queue order may start.
    finder.tick(1);
    expect(finder.pathResult(flee).state === 'ready' || finder.pathResult(wander).state === 'pending').toBe(
      true,
    );
    expect(finder.pathResult(wander).state).toBe('pending');
  });

  it('a request whose ends have different labels fails `unreachable` before searching', () => {
    const map = solidMap(8, 8, 1);
    fillRect(map, 0, 0, 2, 7, 0, TileKind.Floor);
    fillRect(map, 4, 0, 7, 7, 0, TileKind.Floor);
    const core = new PathingCore(map);
    const id = core.pathfinder.requestPath(1, map.index(0, 0, 0), map.index(7, 7, 0), 'walker', 'job');
    core.pathfinder.tick();
    const result = core.pathfinder.pathResult(id);
    expect(result).toEqual({ state: 'failed', reason: 'unreachable' });
    expect(core.pathfinder.lastTickNodes).toBe(0);
  });

  it('`nearest` returns the closest node reached instead of failing', () => {
    const map = solidMap(8, 8, 1);
    fillRect(map, 0, 0, 2, 7, 0, TileKind.Floor);
    fillRect(map, 4, 0, 7, 7, 0, TileKind.Floor);
    const core = new PathingCore(map);
    const from = map.index(0, 0, 0);
    const to = map.index(7, 7, 0);
    const id = core.pathfinder.requestPath(1, from, to, 'walker', 'job', { nearest: true });
    core.pathfinder.tick();
    const result = core.pathfinder.pathResult(id);
    expect(result.state).toBe('ready');
    if (result.state === 'ready') {
      expect(result.path.length).toBeGreaterThan(0);
      const end = result.path[result.path.length - 1] as TileIndex;
      expect(map.xOf(end)).toBe(2);
    }
  });

  it('a path from a tile to itself is empty and immediately ready', () => {
    const map = solidMap(4, 4, 1);
    const i = put(map, 1, 1, 0, TileKind.Floor);
    const core = new PathingCore(map);
    const id = core.pathfinder.requestPath(1, i, i, 'walker');
    core.pathfinder.tick();
    expect(core.pathfinder.pathResult(id)).toEqual({ state: 'ready', path: [] });
  });

  it('the per-request node limit is the documented constant', () => {
    expect(PATH_NODE_LIMIT).toBe(8000);
  });
});

describe('T-M0-09 pathfinding: the path cache', () => {
  it('is off unless asked for, and then serves and splices routes', () => {
    const map = solidMap(16, 16, 1);
    fillRect(map, 0, 0, 15, 15, 0, TileKind.Floor);
    const graph = graphOf(map);
    const plain = new Pathfinder(map, graph);
    const from = map.index(1, 1, 0);
    const to = map.index(14, 14, 0);
    plain.requestPath(1, from, to, 'walker');
    plain.tick();
    expect(plain.cacheSize).toBe(0);

    const cached = new Pathfinder(map, graph, null, { cache: true });
    const first = cached.requestPath(1, from, to, 'walker');
    cached.tick();
    expect(cached.cacheSize).toBe(1);
    const firstPath = cached.path(first) as TileIndex[];

    // A second request from the same chunk to the same tile is served from the cache.
    const near = map.index(2, 3, 0);
    const second = cached.requestPath(2, near, to, 'walker');
    cached.tick();
    const result = cached.pathResult(second);
    expect(result.state).toBe('ready');
    if (result.state === 'ready') {
      expect(result.path[result.path.length - 1]).toBe(to);
      expect(result.path).toContain(firstPath[firstPath.length - 1]);
    }
  });

  it('a dirty chunk drops the routes that cross it', () => {
    const map = solidMap(16, 16, 1);
    fillRect(map, 0, 0, 15, 15, 0, TileKind.Floor);
    const graph = graphOf(map);
    const cached = new Pathfinder(map, graph, null, { cache: true });
    cached.requestPath(1, map.index(1, 1, 0), map.index(14, 14, 0), 'walker');
    cached.tick();
    expect(cached.cacheSize).toBe(1);
    cached.invalidateChunks([map.chunkOf(map.index(8, 8, 0))]);
    expect(cached.cacheSize).toBe(0);
  });
});

describe('T-M0-09 pathfinding: line of sight', () => {
  it('sees along an open row and is blocked by a wall between', () => {
    const map = emptyMap(40, 4, 1);
    fillRect(map, 0, 0, 39, 3, 0, TileKind.Floor);
    const graph = graphOf(map);
    const a = map.index(1, 1, 0);
    const b = map.index(6, 1, 0);
    expect(graph.lineOfSight(a, b)).toBe(true);
    map.setKind(map.index(3, 1, 0), TileKind.Wall, 1);
    expect(graph.lineOfSight(a, b)).toBe(false);
  });

  it('does not look across z-levels and stops at LOS_MAX', () => {
    const map = emptyMap(40, 4, 2);
    fillRect(map, 0, 0, 39, 3, 0, TileKind.Floor);
    fillRect(map, 0, 0, 39, 3, 1, TileKind.Floor);
    const graph = graphOf(map);
    expect(graph.lineOfSight(map.index(1, 1, 0), map.index(1, 1, 1))).toBe(false);
    expect(graph.lineOfSight(map.index(0, 1, 0), map.index(LOS_MAX, 1, 0))).toBe(true);
    expect(graph.lineOfSight(map.index(0, 1, 0), map.index(LOS_MAX + 1, 1, 0))).toBe(false);
  });

  it('a fortification blocks unless it is adjacent to one of the two ends', () => {
    const map = emptyMap(12, 4, 1);
    fillRect(map, 0, 0, 11, 3, 0, TileKind.Floor);
    const graph = graphOf(map);
    const a = map.index(1, 1, 0);
    const far = map.index(9, 1, 0);
    map.setKind(map.index(5, 1, 0), TileKind.Fortification, 1);
    expect(graph.lineOfSight(a, far)).toBe(false);
    map.setKind(map.index(5, 1, 0), TileKind.Floor, 1);
    map.setKind(map.index(2, 1, 0), TileKind.Fortification, 1);
    expect(graph.lineOfSight(a, far)).toBe(true);
  });
});
