/**
 * `core_calendar` of `04-implementation/acceptance-tests.md` § Core:
 * "run `TICKS_PER_YEAR` ticks | `YearPassed { 2 }` once; 4 `SeasonChanged`; 112 `DayPassed`".
 *
 * Boundary events are queued in step 5 of the tick and dispatched in the next one
 * (`simulation-core.md` § The tick), so the last boundary of the year is seen at tick
 * `TICKS_PER_YEAR`; the run is one tick longer to observe it.
 */

import { expect } from 'vitest';
import { DAYS_PER_YEAR, SEASONS_PER_YEAR, TICKS_PER_YEAR } from '@core/constants';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'core_calendar',
  milestone: 0,
  seed: 'core-calendar',
  world: 'flat-test',
  embark: 'none',
  run: TICKS_PER_YEAR + 1,
  expect: (w) => {
    const years = w.events('YearPassed');
    expect(years).toHaveLength(1);
    expect(years[0]?.['year']).toBe(2);
    expect(w.events('SeasonChanged')).toHaveLength(SEASONS_PER_YEAR);
    expect(w.events('DayPassed')).toHaveLength(DAYS_PER_YEAR);
    expect(w.readers.calendar.year).toBe(2);
  },
};

export default scenario;
