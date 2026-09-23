import type { Scenario } from './runner';

/** C-006: the literal formula permits 14 with needs met and personalityBase = -6. */
const scenario: Scenario = { id: 'mo_floor', milestone: 4, seed: 'mo-floor', world: 'flat-test',
  todo: 'C-006', run: 1 };
export default scenario;
