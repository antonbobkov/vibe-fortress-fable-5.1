/**
 * `05-plan/01-testing-strategy.md` § Property tests, "determinism under commands": random valid
 * command streams over 2,000 ticks, run twice, equal hashes every 100 ticks.
 *
 * The command generator registry grows with the milestones (see `command-generators.ts`); from M1
 * the streams designate, undo, set traffic and set labors on the `flat-test` fortress with the
 * default party (`01-testing-strategy.md` § Golden tests: the default embark), so the dwarves act
 * on them (T-M1-16).
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
  const game = new HeadlessGame({ seed: SEED, world: 'flat-test', embark: 'default' });
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
    const probe = new TestWorld({ seed: SEED, world: 'flat-test', embark: 'default' });
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

describe('T-M1-16 property: the M1 command generators', () => {
  it('produce Designate, UndoDesignation, SetTraffic and SetLabor commands the world accepts', () => {
    const w = new TestWorld({ seed: SEED, world: 'flat-test', embark: 'default' });
    const ids = COMMAND_GENERATORS.filter((g) => g.milestone <= 1).map((g) => g.id);
    expect(ids).toEqual(['Designate', 'UndoDesignation', 'SetTraffic', 'SetLabor']);
    for (const g of COMMAND_GENERATORS) {
      const samples = fc.sample(g.arbitrary(w), { numRuns: 12, seed: 7 });
      for (const cmd of samples) w.submit(cmd);
      w.step(1);
      const rejected = w.events('CommandRejected').filter((e) => (e as unknown as { command: { type: string } }).command.type === g.id);
      // UndoDesignation of tiles without designations and a child's labor are the only refusals allowed.
      const reasons = rejected.map((e) => (e as unknown as { reason: string }).reason);
      expect(reasons.every((r) => r === 'has_progress' || r === 'child_labor'), `${g.id}: ${reasons.join(', ')}`).toBe(true);
    }
    expect(w.readers.of<{ designations(): unknown[] }>('03').designations().length).toBeGreaterThan(0);
  });
});
