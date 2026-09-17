/**
 * `pf_budget` of `04-implementation/acceptance-tests.md` § 22 Pathfinding:
 * "500 simultaneous requests | all served within 30 ticks; no tick exceeds the node budget".
 *
 * The requests run over a 40 x 40 hall dug one level below the `flat-test` surface, and are served
 * by the core phase the headless game installs, so the budget is the real one.
 */

import { expect } from 'vitest';
import { PATH_NODES_PER_TICK } from '@core/path-constants';
import type { Scenario } from './runner';

const Z = 31;
const ORIGIN = 10;
const SIDE = 40;
const REQUESTS = 500;

const scenario: Scenario = {
  id: 'pf_budget',
  milestone: 0,
  seed: 'pf-budget',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    w.digRoom(ORIGIN, ORIGIN, Z, SIDE, SIDE);
  },
  run: (w) => {
    // One tick so the dug hall is labelled before the requests are queued.
    w.step(1);

    const finder = w.pathing.pathfinder;
    const ids: number[] = [];
    for (let k = 0; k < REQUESTS; k += 1) {
      const from = w.index(ORIGIN + (k % SIDE), ORIGIN + ((k * 7) % SIDE), Z);
      const to = w.index(ORIGIN + ((k * 13) % SIDE), ORIGIN + ((k * 3 + 5) % SIDE), Z);
      ids.push(finder.requestPath(0, from, to, 'walker', 'job'));
    }

    let ticks = 0;
    let worstTickNodes = 0;
    while (ticks < 30) {
      w.step(1);
      ticks += 1;
      worstTickNodes = Math.max(worstTickNodes, finder.lastTickNodes);
      if (ids.every((id) => finder.pathResult(id).state !== 'pending')) break;
    }

    expect(ticks).toBeLessThanOrEqual(30);
    expect(worstTickNodes).toBeLessThanOrEqual(PATH_NODES_PER_TICK);
    for (const id of ids) {
      const result = finder.pathResult(id);
      expect(result.state).toBe('ready');
    }
  },
};

export default scenario;
