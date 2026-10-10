import { expect } from 'vitest';
import { TICKS_PER_DAY, TICKS_PER_YEAR } from '@core/constants';
import type { Scenario } from './runner';

/** T-157: start just after all possible first-raid offsets, rather than repeat a year-long wait. */
const scenario: Scenario = {
  id: 'th_warning_near_due', milestone: 8, seed: 'th-warning-near-due',
  world: { region: { peril: 2 } }, embark: 'none',
  startTick: TICKS_PER_YEAR + 20 * TICKS_PER_DAY - 1,
  run: (w) => {
    w.forceWeather('clear');
    w.until((v) => v.events('ThreatWarning').some((e) => e['kind'] === 'raid'), 10);
    expect(w.events('ThreatWarning').filter((e) => e['kind'] === 'raid')).toHaveLength(1);
    expect(w.events('RaidArrived').some((e) => e['kind'] === 'raid')).toBe(false);
  },
};
export default scenario;
