/** T-M7-04: a cap equal to the population prevents a seasonal wave. */
import { expect } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import type { ImmigrationReader } from '@systems/immigration/reader';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'im_cap', milestone: 7, seed: 'im-cap', world: 'flat-test', embark: 'none',
  startTick: 28 * TICKS_PER_DAY - 2,
  setup: (w) => { for (let n = 0; n < 20; n += 1) w.spawnDwarf(); },
  run: (w) => {
    // T-175: choose the intended cap explicitly; out-of-range caps are rejected.
    w.submit({ type: 'SetPopulationCap', n: 20 });
    w.step(1);
    expect(w.readers.of<ImmigrationReader>('21').cap()).toBe(20);
    w.until((world) => world.events('ImmigrationSkipped').length > 0, 10);
    const immigration = w.readers.of<ImmigrationReader>('21');
    expect(immigration.cap()).toBe(20);
    expect(immigration.eligibility()).toEqual({ eligible: false, reasons: ['cap'] });
    expect(immigration.wavesSoFar()).toBe(0);
    expect(w.events('ImmigrationSkipped')[0]?.['reason']).toBe('cap');
    w.submit({ type: 'SetPopulationCap', n: 999 });
    w.step(1);
    expect(immigration.cap()).toBe(20);
    expect(w.events('CommandRejected').at(-1)?.['reason']).toBe('out_of_range');
    w.submit({ type: 'SetPopulationCap', n: 200 });
    w.step(1);
    expect(immigration.cap()).toBe(200);
  },
};
export default scenario;
