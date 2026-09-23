import type { Scenario } from './runner';

/** The skeleton assertion belongs to T-M4-15, where rot and corpses are implemented. */
const scenario: Scenario = {
  id: 'fo_butcher_rot', milestone: 4, seed: 'fo-butcher-rot', world: 'flat-test', embark: 'none',
  todo: 'T-M4-15: corpse rot and skeleton conversion',
  run: () => {},
};
export default scenario;
