/**
 * T-807: a day counts toward a sulk by its Miserable hours, not by the mood at the day's turn
 * (`15` § Sulks): `SULK_DAY_HOURS` or more a day counts, none decays the counter, a few leave it.
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import { advanceSulkCounter, type MoraleReader } from '@systems/morale';
import { SULK_DAY_HOURS, SULK_DAYS } from '@systems/morale/mood';
import { TestWorld } from '../../scenarios/test-world';

/** The day each sulk falls on, over a run of days of the given Miserable hours. */
function sulkDays(hoursByDay: readonly number[]): number[] {
  let counter = 0;
  const out: number[] = [];
  hoursByDay.forEach((hours, d) => {
    const r = advanceSulkCounter(counter, hours);
    counter = r.days;
    if (r.sulk) out.push(d + 1);
  });
  return out;
}

describe('T-807 sulks that can happen', () => {
  it('a dwarf Miserable six hours a day for seven days sulks; one Miserable an hour a day does not', () => {
    expect(SULK_DAY_HOURS).toBe(6);
    expect(sulkDays(Array(SULK_DAYS).fill(6))).toEqual([7]);
    expect(sulkDays(Array(28).fill(1))).toEqual([]);
    expect(sulkDays(Array(SULK_DAYS - 1).fill(23))).toEqual([]);
  });

  it('a day with a few Miserable hours keeps the count; a day with none takes one off', () => {
    // Six counted days, then a day of 3 hours (kept at 6), then a counted day: the sulk.
    expect(sulkDays([6, 6, 6, 6, 6, 6, 3, 6])).toEqual([8]);
    // Six counted days, then a day with none (down to 5), then one counted day is not enough.
    expect(sulkDays([6, 6, 6, 6, 6, 6, 0, 6])).toEqual([]);
    expect(advanceSulkCounter(4, 5)).toEqual({ days: 4, sulk: false });
    expect(advanceSulkCounter(4, 0)).toEqual({ days: 3, sulk: false });
    expect(advanceSulkCounter(0, 0)).toEqual({ days: 0, sulk: false });
  });

  it('the Miserable hours are counted on the dwarf\'s mood, saved, and spent at the day\'s turn', () => {
    const w = new TestWorld({ seed: 't807-hours', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const id = w.spawnDwarf({ at: w.index(10, 10, 32) });
    for (const need of ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const) w.setNeed(id, need, 100);
    const morale = w.readers.of<MoraleReader>('15');
    // Step to the first hour the dwarf is Miserable, within the first half of a day.
    w.until(() => morale.tier(id) === 0, TICKS_PER_DAY / 2);
    expect(morale.tier(id)).toBe(0);
    // An hour is counted a tick or two after its `HourPassed`: measure between two hours' middles.
    w.until(() => w.tick % TICKS_PER_HOUR === TICKS_PER_HOUR / 2, TICKS_PER_HOUR);
    const before = w.game.world.entities.get(id, C.Mood)?.miserableHours ?? 0;
    w.step(TICKS_PER_HOUR * 2);
    const after = w.game.world.entities.get(id, C.Mood)?.miserableHours ?? 0;
    expect(after - before).toBe(2);
    const loaded = roundTrip(w.game).game;
    w.replaceGame(loaded);
    expect(w.game.world.entities.get(id, C.Mood)?.miserableHours).toBe(after);
    // At the day's turn the hours are spent: the counter takes the day, and the hours start again.
    const counter = w.game.world.entities.get(id, C.Mood)?.sulkCounterDays ?? 0;
    w.until(() => (w.tick % TICKS_PER_DAY) === TICKS_PER_HOUR / 2, TICKS_PER_DAY);
    const mood = w.game.world.entities.get(id, C.Mood)!;
    expect(mood.sulkCounterDays).toBe(counter + 1);
    expect(mood.miserableHours ?? 0).toBeLessThanOrEqual(1);
  });
});
