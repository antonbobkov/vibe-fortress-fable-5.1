/**
 * `pf_corner` of `04-implementation/acceptance-tests.md` § 22 Pathfinding:
 * "diagonal past a wall corner | not taken".
 *
 * An L of three dug tiles one level below the `flat-test` surface: the two ends are diagonal
 * neighbours, but one of the two orthogonal corners is still rock.
 */

import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import type { Scenario } from './runner';

const Z = 31;

const scenario: Scenario = {
  id: 'pf_corner',
  milestone: 0,
  seed: 'pf-corner',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    w.digRoom(40, 40, Z, 2, 1); // (40,40) and (41,40)
    w.digRoom(41, 41, Z, 1, 1); // (41,41)
  },
  run: 1,
  expect: (w) => {
    const start = w.index(40, 40, Z);
    const corner = w.index(41, 40, Z);
    const goal = w.index(41, 41, Z);
    const blockedCorner = w.index(40, 41, Z);
    expect(w.map.kindAt(blockedCorner)).toBe(TileKind.Wall);

    // The diagonal is refused: no edge, and the path goes round the corner instead.
    expect(w.pathing.graph.hasEdge(start, goal, 'walker')).toBe(false);
    const path = w.findPath(start, goal, 'walker');
    expect(path).toEqual([corner, goal]);
    expect(w.reachable(start, goal, 'walker')).toBe(true);

    // Clearing the blocking corner restores the diagonal.
    w.digRoom(40, 41, Z, 1, 1);
    expect(w.pathing.graph.hasEdge(start, goal, 'walker')).toBe(true);
    expect(w.findPath(start, goal, 'walker')).toEqual([goal]);
  },
};

export default scenario;
