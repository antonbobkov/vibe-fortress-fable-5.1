/**
 * Player path: drink, on a stockpile the wagon's goods and the logs fill: the barrels stay by the still, and dwarves drink there.
 */

import type { Scenario } from './runner';
import { playDrinkPath } from './pp_drink_path';

const scenario: Scenario = {
  id: 'pp_drink_full_pile',
  milestone: 8,
  seed: 'pp-drink',
  world: 'flat-test',
  timeoutMs: 300_000,
  run: () => playDrinkPath({ id: 'pp_drink_full_pile', seed: 'pp-drink', pile: [6, 4] }),
};

export default scenario;
