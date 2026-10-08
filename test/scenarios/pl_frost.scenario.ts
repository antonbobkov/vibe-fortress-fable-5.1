/**
 * `pl_frost` of `04-implementation/acceptance-tests.md` § 07 Plants: "barley crop, temp forced to
 * −5 | `CropDied { frost }`".
 *
 * `07` § Growth: "Winter with `surfaceTempC < FROST_KILL_C` at the crop's tile kills surface crops
 * (`CropDied { reason: frost }`)", and `algorithms/environment.md` § Plant growth guards the frost
 * check with "season not in `d.seasons`" — a surface crop inside its growing seasons is merely
 * blocked by `tempOk`, never killed. The scenario therefore starts in winter, which is outside
 * barley's spring-and-summer seasons (docs/03-content/plants.md).
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { DAYS_PER_SEASON, START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import type { PlantsReader } from '@systems/plants';
import type { Scenario } from './runner';
import { rect } from './m1-helpers';
import type { TestWorld } from './test-world';

/** Day 1 of winter, hour `START_HOUR`. */
const WINTER_TICK = 3 * DAYS_PER_SEASON * TICKS_PER_DAY + START_HOUR * TICKS_PER_HOUR;

const FORCED_C = -5;

let tile = 0;

const scenario: Scenario = {
  id: 'pl_frost',
  milestone: 4,
  seed: 'pl-frost',
  world: 'flat-test',
  embark: 'none',
  startTick: WINTER_TICK,
  setup: (w: TestWorld) => {
    const tiles = rect(w, 50, 50, FLAT_TEST_SURFACE_Z, 2, 2);
    w.zone('farm_plot', tiles);
    tile = tiles[0] as number;
    w.plantCrop(tile, 'barley');
    for (const t of tiles) w.forceTemperature(t, FORCED_C);
  },
  run: 120,
  expect: (w: TestWorld) => {
    expect(w.readers.calendar.season).toBe(3);
    const deaths = w.events('CropDied');
    expect(deaths.map((e) => [e['tile'], e['species'], e['reason']])).toContainEqual([tile, 'barley', 'frost']);
    expect(w.readers.of<PlantsReader>('07').cropAt(tile)).toBe(0);
  },
};

export default scenario;
