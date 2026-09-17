/**
 * `05-plan/01-testing-strategy.md` § Property tests, "determinism under commands": random valid
 * command streams over 2,000 ticks, run twice, equal hashes every 100 ticks.
 *
 * The command generator registry is empty in M0 (see `command-generators.ts`), so the streams are
 * empty and the property degenerates to "two identical runs agree". It grows with the registry.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { HeadlessGame } from '@app/headless';
import { TestWorld } from '../scenarios/test-world';
import { COMMAND_GENERATORS, commandStream, type ScheduledCommand } from './command-generators';
import { currentMilestone } from '../scenarios/runner';

const TICKS = 2_000;
const CHECKPOINT = 100;
const SEED = 'determinism-under-commands';

function runWith(stream: readonly ScheduledCommand[]): string[] {
  const game = new HeadlessGame({ seed: SEED, world: 'flat-test' });
  let next = 0;
  const hashes: string[] = [];
  for (let tick = 0; tick < TICKS; tick += 1) {
    while (next < stream.length && (stream[next] as ScheduledCommand).tick <= tick) {
      game.world.submit((stream[next] as ScheduledCommand).command);
      next += 1;
    }
    game.step(1);
    if ((tick + 1) % CHECKPOINT === 0) hashes.push(game.hash());
  }
  return hashes;
}

describe('T-M0-11 property: determinism under commands', () => {
  it('two runs of the same command stream agree at every 100th tick', () => {
    const probe = new TestWorld({ seed: SEED, world: 'flat-test' });
    fc.assert(
      fc.property(commandStream(probe, currentMilestone(), TICKS), (stream) => {
        const first = runWith(stream);
        const second = runWith(stream);
        expect(first).toHaveLength(TICKS / CHECKPOINT);
        expect(second).toEqual(first);
        return true;
      }),
      { numRuns: COMMAND_GENERATORS.length === 0 ? 2 : 10 },
    );
  });
});
