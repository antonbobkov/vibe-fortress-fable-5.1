/**
 * T-195 reproduction: A squad left in `train` mode starves beside food and drink.
 * Registered with `it.fails` until T-195 is fixed, keeping `npm test` green and
 * the failure on record.
 *
 * @see docs/work/T-195-soldiers-in-training-starve.md
 */

import { describe, it } from 'vitest';
import scenario from './t195_train_needs.scenario';
import { runScenario } from './runner';

describe('T-195 reproduction', () => {
  it.fails(
    't195_train_needs reproduces soldiers starving during training (T-195)',
    () => {
      runScenario(scenario);
    },
    scenario.timeoutMs,
  );
});
