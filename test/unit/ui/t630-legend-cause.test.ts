/** T-630: the legend's end sentence says how the last dwarf died, in the words of the death's line. */
import { describe, expect, it } from 'vitest';
import { HeadlessGame } from '@app/headless';
import { composeLegend, endText } from '@app/legend';
import { Strings } from '@ui/strings';
import { registry } from './ui-fixture';

const strings = new Strings(registry);
const end = (lastCause: string, lastKiller?: string): string =>
  endText(0, 0, { kind: 'all_dead', lastName: 'Solveig Deephand', lastCause, ...(lastKiller === undefined ? {} : { lastKiller }) }, strings);

describe('T-630 the legend\'s last words', () => {
  it.each([
    ['bled_out', undefined, 'has bled to death.'],
    ['starvation', undefined, 'has starved to death.'],
    ['infection', undefined, 'has died of an infection.'],
    ['frozen', undefined, 'has frozen to death in the ice.'],
    ['bridge_crush', undefined, 'has been crushed by a bridge.'],
    ['killed', 'a boar', 'has been killed by a boar.'],
    ['killed', '', 'has died of wounds.'],
    ['killed', undefined, 'has died of wounds.'],
    ['drowned', undefined, 'has drowned.'],
    ['some_cause_with_no_line', undefined, 'has died.'],
  ])('%s (killer %s): "The last dwarf, Solveig Deephand, %s"', (cause, killer, how) => {
    expect(end(cause, killer)).toBe(`The hall fell silent on Day 1 of Spring, Year 1. The last dwarf, Solveig Deephand, ${how}`);
  });

  it('the composed record says it so, never the raw cause', () => {
    const game = new HeadlessGame({ seed: 't630-legend', fortressName: 'Coldvein Hold' });
    const journal = { peakPopulation: () => 7, deepestZ: () => 30, kills: () => [] };
    const record = composeLegend(game, null, game.registry, journal, [], { kind: 'all_dead', lastName: 'Solveig Deephand', lastCause: 'bled_out' });
    expect(record.cause).toMatch(/The last dwarf, Solveig Deephand, has bled to death\.$/);
    expect(record.cause).not.toContain('bled out');
  });
});
