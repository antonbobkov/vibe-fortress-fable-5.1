/**
 * `core_determinism` of `04-implementation/acceptance-tests.md` § Core:
 * "run 10,000 ticks twice from the same seed and command log | identical world hashes at ticks
 * 1,000, 5,000, 10,000".
 *
 * There are no systems and no commands in M0, so this is the empty flat world; T-M2-12 extends it
 * with a recorded command log.
 */

import { expect } from 'vitest';
import { hashesAt } from '@app/headless';
import type { Scenario } from './runner';

const CHECKPOINTS = [1_000, 5_000, 10_000] as const;
const SEED = 'core-determinism';

const scenario: Scenario = {
  id: 'core_determinism',
  milestone: 0,
  seed: SEED,
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    const first = new Map<number, string>();
    let at = 0;
    for (const checkpoint of CHECKPOINTS) {
      w.step(checkpoint - at);
      at = checkpoint;
      first.set(checkpoint, w.hash());
    }
    const second = hashesAt({ seed: SEED, world: 'flat-test' }, CHECKPOINTS);
    for (const checkpoint of CHECKPOINTS) {
      expect(second.get(checkpoint)).toBe(first.get(checkpoint));
    }
    expect(w.tick).toBe(10_000);
  },
};

export default scenario;
