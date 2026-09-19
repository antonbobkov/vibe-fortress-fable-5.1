/**
 * `05-plan/01-testing-strategy.md` § Property tests, "save round-trip": a random tick to save at
 * during a scripted run; the loaded game's hash equals the uninterrupted run's (T-M2-11).
 *
 * The scripted run is the busy fortress of `core_save_roundtrip` (hauling, building, digging) plus
 * a random command stream from the generators of the milestones built so far. The saved game is
 * restored through the full load procedure and both runs continue with the rest of the stream;
 * their hashes must agree at the save and every 100 ticks after it.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { roundTrip } from '@app/game-save';
import type { HeadlessGame } from '@app/headless';
import { TestWorld } from '../scenarios/test-world';
import { prepareBusyFortress } from '../scenarios/core_save_roundtrip.scenario';
import { commandStream, submitScheduled, type ScheduledCommand } from './command-generators';
import { currentMilestone } from '../scenarios/runner';

const TICKS = 1_500;
const CHECKPOINT = 100;
const SEED = 'save-round-trip';

function feed(game: HeadlessGame, stream: readonly ScheduledCommand[], from: number, start: number, until: number): number {
  let next = from;
  for (let tick = game.tick - start; tick < until; tick += 1) {
    while (next < stream.length && (stream[next] as ScheduledCommand).tick <= tick) {
      submitScheduled(game, (stream[next] as ScheduledCommand).command);
      next += 1;
    }
    game.step(1);
  }
  return next;
}

describe('T-M2-11 property: save round-trip', () => {
  it('a game saved at a random tick and loaded continues exactly as the uninterrupted run', () => {
    const probe = new TestWorld({ seed: SEED, world: 'flat-test', embark: 'default' });
    fc.assert(
      fc.property(commandStream(probe, currentMilestone(), TICKS), fc.integer({ min: 1, max: TICKS - 1 }), (stream, saveAt) => {
        const w = new TestWorld({ seed: SEED, world: 'flat-test', embark: 'default' });
        prepareBusyFortress(w);
        const a = w.game;
        const start = a.tick;
        let next = feed(a, stream, 0, start, saveAt);
        const b = roundTrip(a).game;
        expect(b.hash()).toBe(a.hash());
        for (let at = saveAt; at < TICKS; at += CHECKPOINT) {
          const until = Math.min(TICKS, at + CHECKPOINT);
          const na = feed(a, stream, next, start, until);
          const nb = feed(b, stream, next, start, until);
          expect(nb).toBe(na);
          expect(b.hash(), `hash after tick ${until} (saved at ${saveAt})`).toBe(a.hash());
          next = na;
        }
        return true;
      }),
      { numRuns: 6, seed: 20260918 },
    );
  }, 300_000);
});
