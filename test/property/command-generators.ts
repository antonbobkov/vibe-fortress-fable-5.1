/**
 * The command generator registry of `05-plan/01-testing-strategy.md` § Property tests
 * ("determinism under commands ... the command generator producing only commands that exist so
 * far (none yet: the generator is a registry that later tasks extend)").
 *
 * A task that adds a command adds its generator here with the milestone it arrives in; the
 * property test picks the generators whose milestone is at most the current one.
 */

import fc from 'fast-check';
import type { Command } from '@core/commands';
import type { TestWorld } from '../scenarios/test-world';

export interface CommandGenerator {
  /** The command type this generator produces, for the failure message. */
  readonly id: string;
  /** The milestone that introduces the command. */
  readonly milestone: number;
  /** An arbitrary over commands that are valid against the given world. */
  arbitrary(w: TestWorld): fc.Arbitrary<Command>;
}

/**
 * Empty in M0: no system owns a command yet, and `core`'s only command (`RenameFortress`) changes
 * nothing a scenario can drive randomly without also inventing a name generator that the strings
 * table owns. T-M2-13 adds the items and buildings generators.
 */
export const COMMAND_GENERATORS: readonly CommandGenerator[] = Object.freeze([]);

export function generatorsFor(milestone: number): readonly CommandGenerator[] {
  return COMMAND_GENERATORS.filter((g) => g.milestone <= milestone);
}

export interface ScheduledCommand {
  readonly tick: number;
  readonly command: Command;
}

/**
 * A stream of commands over `ticks` ticks, drawn from the generators available at `milestone`.
 * With no generators the stream is always empty, which is the M0 case.
 */
export function commandStream(
  w: TestWorld,
  milestone: number,
  ticks: number,
): fc.Arbitrary<ScheduledCommand[]> {
  const generators = generatorsFor(milestone);
  if (generators.length === 0) return fc.constant<ScheduledCommand[]>([]);
  const one = fc.oneof(...generators.map((g) => g.arbitrary(w)));
  return fc
    .array(fc.record({ tick: fc.integer({ min: 0, max: Math.max(0, ticks - 1) }), command: one }), {
      maxLength: 200,
    })
    .map((list) => list.slice().sort((a, b) => a.tick - b.tick));
}
