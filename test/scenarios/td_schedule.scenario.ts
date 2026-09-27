/** T-M7-01: each civilization's first caravan uses its authored annual window. */
import { expect } from 'vitest';
import { TICKS_PER_DAY, TICKS_PER_YEAR } from '@core/constants';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'td_schedule', milestone: 7, seed: 'td-schedule', world: 'flat-test', embark: 'none',
  run: (w) => {
    const arrivals: Record<string, number> = {};
    w.game.world.onEvents((batch) => {
      for (const event of batch) if (event.type === 'CaravanArrived' && arrivals[String(event['civ'])] === undefined) {
        arrivals[String(event['civ'])] = w.tick;
      }
    });
    w.step(2 * TICKS_PER_YEAR);
    const events = w.events('CaravanArrived');
    expect(events.some((e) => e['civ'] === 'hillfolk')).toBe(true);
    expect(events.some((e) => e['civ'] === 'wildwood')).toBe(true);
    expect(events.some((e) => e['civ'] === 'mountainhome')).toBe(true);
    expect(arrivals.hillfolk).toBeGreaterThanOrEqual((28 + 4) * TICKS_PER_DAY);
    expect(arrivals.hillfolk).toBeLessThanOrEqual((28 + 17) * TICKS_PER_DAY);
    expect(arrivals.wildwood).toBeGreaterThanOrEqual((56 + 4) * TICKS_PER_DAY);
    expect(arrivals.wildwood).toBeLessThanOrEqual((56 + 17) * TICKS_PER_DAY);
    expect(arrivals.mountainhome).toBeGreaterThanOrEqual((112 + 4) * TICKS_PER_DAY);
    expect(arrivals.mountainhome).toBeLessThanOrEqual((112 + 17) * TICKS_PER_DAY);
  },
};
export default scenario;
