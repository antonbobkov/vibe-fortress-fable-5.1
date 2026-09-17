import { describe, it, expect } from 'vitest';
import {
  Calendar,
  SEASON_NAMES,
  dayIndexOf,
  dayOfSeasonOf,
  dayOfYearOf,
  formatDate,
  hourOf,
  seasonOf,
  yearOf,
} from '@core/calendar';
import {
  DAYS_PER_SEASON,
  DAYS_PER_YEAR,
  HOURS_PER_DAY,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  TICKS_PER_YEAR,
} from '@core/constants';
import type { GameEvent } from '@core/events';

function collect(from: number, ticks: number): { tick: number; events: GameEvent[] }[] {
  const calendar = new Calendar(from);
  const out: { tick: number; events: GameEvent[] }[] = [];
  for (let i = 0; i < ticks; i += 1) {
    const events: GameEvent[] = [];
    calendar.advance((e) => events.push(e));
    if (events.length > 0) out.push({ tick: calendar.tick, events });
  }
  return out;
}

describe('T-M0-07 calendar: the derivations of components.md', () => {
  it('tick 0 is hour 0, day 1 of spring, year 1', () => {
    const c = new Calendar(0);
    expect(c.tick).toBe(0);
    expect(c.hour).toBe(0);
    expect(c.dayOfSeason).toBe(1);
    expect(c.dayOfYear).toBe(1);
    expect(c.season).toBe(0);
    expect(c.seasonName).toBe('spring');
    expect(c.year).toBe(1);
  });

  it('the hour advances every TICKS_PER_HOUR and wraps at HOURS_PER_DAY', () => {
    expect(hourOf(TICKS_PER_HOUR - 1)).toBe(0);
    expect(hourOf(TICKS_PER_HOUR)).toBe(1);
    expect(hourOf(TICKS_PER_HOUR * (HOURS_PER_DAY - 1))).toBe(HOURS_PER_DAY - 1);
    expect(hourOf(TICKS_PER_DAY)).toBe(0);
  });

  it('days, seasons and years follow the documented formulas', () => {
    expect(dayIndexOf(TICKS_PER_DAY * 5)).toBe(5);
    expect(dayOfYearOf(TICKS_PER_DAY * 5)).toBe(6);
    expect(dayOfSeasonOf(TICKS_PER_DAY * (DAYS_PER_SEASON - 1))).toBe(DAYS_PER_SEASON);
    expect(seasonOf(TICKS_PER_DAY * DAYS_PER_SEASON)).toBe(1);
    expect(seasonOf(TICKS_PER_DAY * DAYS_PER_SEASON * 3)).toBe(3);
    expect(yearOf(TICKS_PER_YEAR - 1)).toBe(1);
    expect(yearOf(TICKS_PER_YEAR)).toBe(2);
    expect(dayOfYearOf(TICKS_PER_YEAR)).toBe(1);
    expect(seasonOf(TICKS_PER_YEAR)).toBe(0);
  });

  it('every season has DAYS_PER_SEASON days and a year has four', () => {
    const counts = [0, 0, 0, 0];
    for (let day = 0; day < DAYS_PER_YEAR; day += 1) {
      counts[seasonOf(day * TICKS_PER_DAY)] = (counts[seasonOf(day * TICKS_PER_DAY)] ?? 0) + 1;
    }
    expect(counts).toEqual([DAYS_PER_SEASON, DAYS_PER_SEASON, DAYS_PER_SEASON, DAYS_PER_SEASON]);
    expect(SEASON_NAMES).toEqual(['spring', 'summer', 'autumn', 'winter']);
  });

  it('formats the date as "Day 12 of Spring, Year 3"', () => {
    const tick = (2 * DAYS_PER_YEAR + 11) * TICKS_PER_DAY;
    expect(formatDate(tick)).toBe('Day 12 of Spring, Year 3');
    expect(new Calendar(tick).toString()).toBe('Day 12 of Spring, Year 3');
  });

  it('rejects a negative or fractional tick', () => {
    expect(() => new Calendar(-1)).toThrow(RangeError);
    expect(() => new Calendar(1.5)).toThrow(RangeError);
    expect(() => new Calendar(0).setTick(-2)).toThrow(RangeError);
  });
});

describe('T-M0-07 calendar: boundary events at exact ticks', () => {
  it('HourPassed only at a multiple of TICKS_PER_HOUR', () => {
    const fired = collect(0, TICKS_PER_HOUR * 3);
    expect(fired.map((f) => f.tick)).toEqual([TICKS_PER_HOUR, TICKS_PER_HOUR * 2, TICKS_PER_HOUR * 3]);
    expect(fired[0]?.events).toEqual([{ type: 'HourPassed', hour: 1 }]);
    expect(fired[1]?.events).toEqual([{ type: 'HourPassed', hour: 2 }]);
  });

  it('the tick before a boundary emits nothing', () => {
    const calendar = new Calendar(TICKS_PER_HOUR - 2);
    const events: GameEvent[] = [];
    calendar.advance((e) => events.push(e));
    expect(events).toEqual([]);
    expect(calendar.tick).toBe(TICKS_PER_HOUR - 1);
    calendar.advance((e) => events.push(e));
    expect(events).toEqual([{ type: 'HourPassed', hour: 1 }]);
  });

  it('DayPassed accompanies the midnight HourPassed', () => {
    const calendar = new Calendar(TICKS_PER_DAY - 1);
    const events: GameEvent[] = [];
    calendar.advance((e) => events.push(e));
    expect(events).toEqual([
      { type: 'HourPassed', hour: 0 },
      { type: 'DayPassed', dayOfSeason: 2, season: 0, year: 1 },
    ]);
  });

  it('SeasonChanged fires on the first tick of a new season, smallest boundary first', () => {
    const calendar = new Calendar(TICKS_PER_DAY * DAYS_PER_SEASON - 1);
    const events: GameEvent[] = [];
    calendar.advance((e) => events.push(e));
    expect(events).toEqual([
      { type: 'HourPassed', hour: 0 },
      { type: 'DayPassed', dayOfSeason: 1, season: 1, year: 1 },
      { type: 'SeasonChanged', season: 1, year: 1 },
    ]);
  });

  it('YearPassed fires with the season change into spring', () => {
    const calendar = new Calendar(TICKS_PER_YEAR - 1);
    const events: GameEvent[] = [];
    calendar.advance((e) => events.push(e));
    expect(events.map((e) => e.type)).toEqual([
      'HourPassed',
      'DayPassed',
      'SeasonChanged',
      'YearPassed',
    ]);
    expect(events[3]).toEqual({ type: 'YearPassed', year: 2 });
    expect(calendar.year).toBe(2);
    expect(calendar.season).toBe(0);
  });

  it('a whole year emits the right number of each event', () => {
    const fired = collect(0, TICKS_PER_YEAR);
    const counts = new Map<string, number>();
    for (const f of fired) {
      for (const e of f.events) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    }
    expect(counts.get('HourPassed')).toBe(TICKS_PER_YEAR / TICKS_PER_HOUR);
    expect(counts.get('DayPassed')).toBe(DAYS_PER_YEAR);
    expect(counts.get('SeasonChanged')).toBe(4);
    expect(counts.get('YearPassed')).toBe(1);
  });

  it('the tick is the whole state: setTick reproduces every field', () => {
    const a = new Calendar(0);
    for (let i = 0; i < 5000; i += 1) a.advance(() => {});
    const b = new Calendar(0);
    b.setTick(a.tick);
    expect([b.hour, b.dayOfSeason, b.season, b.year, b.dayOfYear]).toEqual([
      a.hour,
      a.dayOfSeason,
      a.season,
      a.year,
      a.dayOfYear,
    ]);
  });
});
