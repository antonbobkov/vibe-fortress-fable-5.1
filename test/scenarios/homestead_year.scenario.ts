/**
 * `homestead_year` scenario (Milestone 8, T-153):
 * A one-year playthrough on temperate grassland with river stream.
 * Livestock, leather, cloth, hunting, fishing, gathering, farming.
 */

import type { Scenario } from './runner';
import type { TestWorld } from './test-world';
import { contentRegistry } from '@content/loader';
import { createHomesteadEmbarkSession, runHomesteadYear } from './homestead_year_fortress';

const scenario: Scenario = {
  id: 'homestead_year',
  milestone: 8,
  seed: 'homestead-year',
  world: {
    region: {
      wealth: 1,
      peril: 0,
      temper: 0,
      biome: 'temperate_grassland',
      river: { class: 'brook', inflow: ['w'], outflow: 'e' },
    },
  },
  embark: { session: () => createHomesteadEmbarkSession(contentRegistry(), 'homestead-year') },
  timeoutMs: 360_000,
  run: (w: TestWorld) => {
    runHomesteadYear(w);
  },
};

export default scenario;
