/** T-M7-04: the first two seasonal waves arrive regardless of hall spirit. */
import { expect } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import type { ImmigrationReader } from '@systems/immigration/reader';
import type { Scenario } from './runner';
import { TestWorld } from './test-world';

const scenario: Scenario = {
  id: 'im_guaranteed', milestone: 7, seed: 'im-guaranteed', world: 'flat-test', embark: 'default',
  run: (w) => {
    const immigration = w.readers.of<ImmigrationReader>('21');
    w.until((world) => world.events('ImmigrantsArrived').length > 0, 29 * TICKS_PER_DAY);
    const first = w.events('ImmigrantsArrived')[0];
    expect(first?.['guaranteed']).toBe(true);
    expect(first?.['count']).toBeGreaterThanOrEqual(2);
    expect(first?.['count']).toBeLessThanOrEqual(4);
    expect(immigration.wavesSoFar()).toBe(1);
    const autumn = new TestWorld({ seed: 'im-guaranteed-autumn', world: 'flat-test', embark: 'none', startTick: 56 * TICKS_PER_DAY - 2 });
    for (let n = 0; n < 7; n += 1) autumn.spawnDwarf();
    autumn.until((world) => world.events('ImmigrantsArrived').length > 0, 200);
    const second = autumn.events('ImmigrantsArrived')[0];
    expect(second?.['guaranteed']).toBe(true);
    expect(second?.['count']).toBeGreaterThanOrEqual(2);
    expect(second?.['count']).toBeLessThanOrEqual(4);
    expect(autumn.readers.of<ImmigrationReader>('21').wavesSoFar()).toBe(1);
  },
};
export default scenario;
