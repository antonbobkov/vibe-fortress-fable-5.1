/**
 * `descent` scenario (Milestone 8, T-154):
 * Caverns, deepsilver, the Deep, magma workshops.
 */

import type { Scenario } from './runner';
import type { TestWorld } from './test-world';
import { runDescent, setupDescentSurface } from './descent_fortress';

const scenario: Scenario = {
  id: 'descent',
  milestone: 8,
  seed: 'descent',
  world: {
    region: {
      wealth: 3,
      peril: 1,
      geology: 'igneous',
    },
  },
  embark: 'none',
  timeoutMs: 300_000,
  setup: (w: TestWorld) => {
    setupDescentSurface(w);
  },
  run: (w: TestWorld) => {
    runDescent(w);
  },
};

export default scenario;
