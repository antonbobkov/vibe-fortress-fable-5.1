/**
 * `defence_year` scenario (Milestone 8, T-151):
 * Traps, a gate, a trained squad, a raid repelled.
 */

import type { Scenario } from './runner';
import { runDefenceYear } from './defence_year_fortress';

const scenario: Scenario = {
  id: 'defence_year',
  milestone: 8,
  seed: 'defence-year',
  world: {
    region: {
      wealth: 2,
      peril: 2,
      biome: 'temperate_forest',
      geology: 'mixed',
      traits: [],
      river: { class: 'brook', inflow: ['w'], outflow: 's' },
    },
  },
  embark: 'default',
  timeoutMs: 300_000,
  run: () => {
    runDefenceYear();
  },
};

export default scenario;
