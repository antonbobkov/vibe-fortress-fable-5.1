/**
 * The calendar.
 *
 * Implements `01-architecture/simulation-core.md` § Calendar and the derivations of
 * `04-implementation/schemas/components.md` § Calendar: the whole calendar is a function of the
 * absolute tick, so only the tick is saved.
 */

import {
  DAYS_PER_SEASON,
  DAYS_PER_YEAR,
  HOURS_PER_DAY,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
} from './constants';
import type { GameEvent } from './events';
import type { Season, Tick } from './types';

export const SEASON_NAMES: readonly ['spring', 'summer', 'autumn', 'winter'] = [
  'spring',
  'summer',
  'autumn',
  'winter',
];

/** `hour = floor(tick / TICKS_PER_HOUR) % HOURS_PER_DAY`. */
export function hourOf(tick: Tick): number {
  return Math.floor(tick / TICKS_PER_HOUR) % HOURS_PER_DAY;
}

/** `dayIndex = floor(tick / TICKS_PER_DAY)`. */
export function dayIndexOf(tick: Tick): number {
  return Math.floor(tick / TICKS_PER_DAY);
}

/** `dayOfYear = dayIndex % DAYS_PER_YEAR + 1`, 1-based. */
export function dayOfYearOf(tick: Tick): number {
  return (dayIndexOf(tick) % DAYS_PER_YEAR) + 1;
}

/** `season = floor((dayOfYear - 1) / DAYS_PER_SEASON)`. */
export function seasonOf(tick: Tick): Season {
  return Math.floor((dayOfYearOf(tick) - 1) / DAYS_PER_SEASON) as Season;
}

/** `dayOfSeason = (dayOfYear - 1) % DAYS_PER_SEASON + 1`, 1-based. */
export function dayOfSeasonOf(tick: Tick): number {
  return ((dayOfYearOf(tick) - 1) % DAYS_PER_SEASON) + 1;
}

/** `year = floor(dayIndex / DAYS_PER_YEAR) + 1`; the fortress starts in year 1. */
export function yearOf(tick: Tick): number {
  return Math.floor(dayIndexOf(tick) / DAYS_PER_YEAR) + 1;
}

/** "Day 12 of Spring, Year 3". */
export function formatDate(tick: Tick): string {
  const season = SEASON_NAMES[seasonOf(tick)] as string;
  const capitalised = season.charAt(0).toUpperCase() + season.slice(1);
  return `Day ${dayOfSeasonOf(tick)} of ${capitalised}, Year ${yearOf(tick)}`;
}

/**
 * The calendar. `advance()` increments the tick and emits the boundary events, which
 * `simulation-core.md` § The tick emits in step 4 and dispatches in the next tick's step 3.
 *
 * When several boundaries coincide the events are emitted smallest first: `HourPassed`,
 * `DayPassed`, `SeasonChanged`, `YearPassed` (docs/01-architecture/simulation-core.md § Calendar).
 */
export class Calendar {
  private current: Tick;

  /** Set by 06 weather from its daylight table. */
  isDaylight = true;

  constructor(tick: Tick = 0) {
    if (!Number.isInteger(tick) || tick < 0) throw new RangeError(`bad start tick: ${tick}`);
    this.current = tick;
  }

  get tick(): Tick {
    return this.current;
  }

  get hour(): number {
    return hourOf(this.current);
  }

  get dayOfSeason(): number {
    return dayOfSeasonOf(this.current);
  }

  get season(): Season {
    return seasonOf(this.current);
  }

  get seasonName(): string {
    return SEASON_NAMES[this.season] as string;
  }

  get year(): number {
    return yearOf(this.current);
  }

  get dayOfYear(): number {
    return dayOfYearOf(this.current);
  }

  get dayIndex(): number {
    return dayIndexOf(this.current);
  }

  /** Restore from a save; the tick is the whole calendar state. */
  setTick(tick: Tick): void {
    if (!Number.isInteger(tick) || tick < 0) throw new RangeError(`bad tick: ${tick}`);
    this.current = tick;
  }

  /** Increment the tick and emit the boundary events crossed. */
  advance(emit: (event: GameEvent) => void): void {
    const before = this.current;
    const after = before + 1;
    this.current = after;
    if (after % TICKS_PER_HOUR !== 0) return;

    emit({ type: 'HourPassed', hour: hourOf(after) });
    if (after % TICKS_PER_DAY !== 0) return;

    const season = seasonOf(after);
    const year = yearOf(after);
    emit({ type: 'DayPassed', dayOfSeason: dayOfSeasonOf(after), season, year });
    if (season !== seasonOf(before)) emit({ type: 'SeasonChanged', season, year });
    if (year !== yearOf(before)) emit({ type: 'YearPassed', year });
  }

  toString(): string {
    return formatDate(this.current);
  }
}
