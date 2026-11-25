/**
 * T-740: the Civilizations panel's reputation log folds the changes of one reason on one day into
 * one line with their total and their count (`panels.md` § Civilizations); the saved history keeps
 * every change.
 */
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import { foldReputationLog, reputationEntryText } from '@ui/panels/civilizations';
import type { PanelContext } from '@ui/panels/context';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

describe('T-740 the reputation log folds one reason\'s changes on one day', () => {
  it('ten wooden items offered on one day are one line, with the total and the count', () => {
    const w = new TestWorld({ seed: 't740-fold', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const ctx: PanelContext = {
      readers: w.readers, registry: w.game.registry, strings,
      submit: () => {}, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
    };
    const entries = [
      { tick: 10, delta: -2, reason: 'wood_offered' },
      { tick: 20, delta: 3, reason: 'trade' },
      ...Array.from({ length: 9 }, (_, i) => ({ tick: 30 + i, delta: -2, reason: 'wood_offered' })),
      { tick: 50, delta: 2, reason: 'trade' },
    ];
    expect(foldReputationLog(entries).map((row) => reputationEntryText(ctx, row))).toEqual([
      '+5 trade ×2 (Sp 1)',
      '-20 offered wood ×10 (Sp 1)',
    ]);
    expect(reputationEntryText(ctx, { delta: -50, reason: 'caravan_member_killed', tick: 0 })).toBe('-50 caravan member killed (Sp 1)');
  });

  it('the same reason on another day is a line of its own', () => {
    const rows = foldReputationLog([
      { tick: 1, delta: -2, reason: 'wood_offered' },
      { tick: TICKS_PER_DAY + 1, delta: -2, reason: 'wood_offered' },
      { tick: TICKS_PER_DAY + 2, delta: -2, reason: 'wood_offered' },
    ]);
    expect(rows.map((row) => [row.delta, row.count, row.tick])).toEqual([[-4, 2, TICKS_PER_DAY + 2], [-2, 1, 1]]);
  });
});
