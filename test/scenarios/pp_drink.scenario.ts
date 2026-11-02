/**
 * Player path: drink, with room on the stockpile for the brew (`pp_drink_path.ts`).
 */

import type { Scenario } from './runner';
import { playDrinkPath } from './pp_drink_path';

const scenario: Scenario = {
  id: 'pp_drink',
  milestone: 8,
  seed: 'pp-drink',
  world: 'flat-test',
  timeoutMs: 300_000,
  run: () => playDrinkPath({ id: 'pp_drink', seed: 'pp-drink', pile: [10, 6] }),
};

export default scenario;
