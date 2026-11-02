/**
 * Player path: drink, with the still on the nearest site, whose shrub its builder clears.
 */

import type { Scenario } from './runner';
import { playDrinkPath } from './pp_drink_path';

const scenario: Scenario = {
  id: 'pp_drink_shrub_site',
  milestone: 8,
  seed: 'pp-drink',
  world: 'flat-test',
  timeoutMs: 300_000,
  run: () => playDrinkPath({ id: 'pp_drink_shrub_site', seed: 'pp-drink', pile: [10, 6], clearsPlants: true }),
};

export default scenario;
