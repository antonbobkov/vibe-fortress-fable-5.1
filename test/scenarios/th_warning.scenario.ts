/**
 * `th_warning` of `04-implementation/acceptance-tests.md` § 18 Threats:
 * "peril 2, first raid | ThreatWarning exactly WARNING_DAYS before RaidArrived; half under fog"
 */

import { expect } from 'vitest';
import { regionSpec } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import { WARNING_DAYS } from '@systems/threats/constants';
import type { Scenario } from './runner';
import { TestWorld } from './test-world';

function runUntilFirstRaid(w: TestWorld, isFog: boolean): { warningTick: number; arrivalTick: number } {
  if (isFog) {
    w.forceWeather('fog');
  }

  let warningTick = -1;
  let arrivalTick = -1;

  w.game.world.onEvents((batch) => {
    for (const event of batch) {
      if (event.type === 'ThreatWarning' && event['kind'] === 'raid' && warningTick === -1) {
        warningTick = w.tick;
      }
      if (event.type === 'RaidArrived' && event['kind'] === 'raid' && arrivalTick === -1) {
        arrivalTick = w.tick;
      }
    }
  });

  while (arrivalTick === -1) {
    w.step(50);

    if (w.tick > 3 * 112 * TICKS_PER_DAY) {
      throw new Error(`First raid did not arrive within 3 years (warningTick=${warningTick}, arrivalTick=${arrivalTick})`);
    }
  }

  return { warningTick, arrivalTick };
}

const scenario: Scenario = {
  id: 'th_warning',
  milestone: 6,
  seed: 'th-warning',
  world: { region: { peril: 2 } },
  embark: 'none',
  run: (w: TestWorld) => {
    // 1. Normal weather run
    const normal = runUntilFirstRaid(w, false);
    expect(normal.warningTick).toBeGreaterThan(0);
    expect(normal.arrivalTick).toBeGreaterThan(normal.warningTick);
    expect(normal.arrivalTick - normal.warningTick).toBe(WARNING_DAYS * TICKS_PER_DAY);

    // 2. Under fog run
    const wFog = new TestWorld({
      seed: 'th-warning-fog',
      world: 'local',
      spec: regionSpec('th-warning-fog', { peril: 2 }),
      embark: 'none',
    });
    const fog = runUntilFirstRaid(wFog, true);
    expect(fog.warningTick).toBeGreaterThan(0);
    expect(fog.arrivalTick).toBeGreaterThan(fog.warningTick);
    expect(fog.arrivalTick - fog.warningTick).toBe((WARNING_DAYS * TICKS_PER_DAY) / 2);
  },
};

export default scenario;
