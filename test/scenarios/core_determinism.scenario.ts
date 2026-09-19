/**
 * `core_determinism` of `04-implementation/acceptance-tests.md` § Core:
 * "run 10,000 ticks twice from the same seed and command log | identical world hashes at ticks
 * 1,000, 5,000, 10,000".
 *
 * The first part is the flat world without a party and without commands (M0). T-M2-12 extends it
 * with a recorded command log: the default party runs a random command stream while the world's
 * own command log records it, and a second world replays that log (`app/replay.ts`, the code
 * `scripts/replay.mjs` runs); the hashes agree at every checkpoint.
 */

import { expect } from 'vitest';
import fc from 'fast-check';
import { HeadlessGame, hashesAt } from '@app/headless';
import { replay } from '@app/replay';
import { commandStream, type ScheduledCommand } from '../property/command-generators';
import { TestWorld } from './test-world';
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

    // T-M2-12: the same run twice from one recorded command log.
    const recorded = new HeadlessGame({ seed: SEED, world: 'flat-test', embark: 'default' });
    const start = recorded.tick;
    const probe = new TestWorld({ seed: SEED, world: 'flat-test', embark: 'default' });
    const stream = fc.sample(commandStream(probe, 1, CHECKPOINTS[2]), { numRuns: 1, seed: 1 })[0] ?? [];
    expect(stream.length).toBeGreaterThan(0);
    const expected = new Map<number, string>();
    let next = 0;
    for (let t = 0; t < CHECKPOINTS[2]; t += 1) {
      while (next < stream.length && (stream[next] as ScheduledCommand).tick <= t) {
        recorded.world.submit((stream[next] as ScheduledCommand).command);
        next += 1;
      }
      recorded.step(1);
      if ((CHECKPOINTS as readonly number[]).includes(t + 1)) expected.set(start + t + 1, recorded.hash());
    }
    const log = recorded.world.commandLog.all();
    expect(log.length).toBeGreaterThan(0);
    const replayed = new HeadlessGame({ seed: SEED, world: 'flat-test', embark: 'default' });
    const points = replay(replayed, log, { until: start + CHECKPOINTS[2] });
    for (const [tick, hash] of expected) expect(points.find((p) => p.tick === tick)?.hash, `tick ${tick}`).toBe(hash);
  },
};

export default scenario;
