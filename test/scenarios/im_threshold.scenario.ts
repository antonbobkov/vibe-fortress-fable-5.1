/** T-M7-04: year-two spirit threshold and the authored arrival roll. */
import { expect } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import { RngStream, seedFor } from '@core/rng';
import type { MoraleSystem } from '@systems/morale';
import type { ImmigrationReader } from '@systems/immigration/reader';
import { IMMIGRATION_PERMILLE } from '@systems/immigration/constants';
import type { Scenario } from './runner';
import { TestWorld } from './test-world';

const YEAR_TWO_SUMMER = (112 + 28) * TICKS_PER_DAY;

function withSpirit(w: TestWorld, spirit: number): void {
  w.step(1);
  const morale = w.game.world.scheduler.byId('15') as MoraleSystem;
  morale.deserialize({ ...morale.serialize(), hallSpirit: spirit, hallSpiritTier: spirit < 65 ? 1 : 2 }, {
    world: w.game.world, registry: w.game.registry, rng: w.game.world.rngFor('15'),
    readers: w.readers, register: w.game.world.registrations,
  });
}

const scenario: Scenario = {
  id: 'im_threshold', milestone: 7, seed: 'im-threshold', world: 'flat-test', embark: 'none',
  startTick: YEAR_TWO_SUMMER - 2,
  setup: (w) => { for (let n = 0; n < 7; n += 1) w.spawnDwarf(); },
  run: (w) => {
    withSpirit(w, 60);
    w.until((world) => world.events('ImmigrationSkipped').length > 0, 5);
    expect(w.events('ImmigrationSkipped')[0]?.['reason']).toBe('spirit');
    const high = new TestWorld({ seed: 'im-threshold-high', world: 'flat-test', embark: 'none', startTick: YEAR_TWO_SUMMER - 2 });
    for (let n = 0; n < 7; n += 1) high.spawnDwarf();
    withSpirit(high, 70);
    expect(high.readers.of<ImmigrationReader>('21').eligibility()).toEqual({ eligible: true, reasons: [] });
    let arrivals = 0;
    for (let seed = 1; seed <= 100; seed += 1) {
      if (new RngStream(seedFor(`im-threshold-${seed}`, '21')).chance(IMMIGRATION_PERMILLE)) arrivals += 1;
    }
    expect(arrivals).toBeGreaterThanOrEqual(58);
    expect(arrivals).toBeLessThanOrEqual(82);
  },
};
export default scenario;
