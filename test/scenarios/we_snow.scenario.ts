/**
 * `we_snow` of `04-implementation/acceptance-tests.md` § 06 Weather: "winter snowfall at temper 2 |
 * all outdoor chunks covered within 6 hours; melt after `MELT_C` for 5 hours".
 *
 * The flat region at temper 2 (no trait) from the last afternoon of winter: the snowfall is held
 * with `forceWeather('snow')` until every outdoor chunk is covered, then the weather is held clear;
 * spring arrives at midnight and the surface rises above `MELT_C`. The melt is counted in the
 * weather ticks whose surface temperature is above `MELT_C`. The runner starts every world at tick
 * 0, so the driver builds the same region's world at the end of winter (`startTick`).
 */

import { expect } from 'vitest';
import { regionSpec } from '@app/headless';
import { DAYS_PER_SEASON, TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import { TileFlag } from '@core/map3d';
import { MELT_C } from '@systems/weather/constants';
import type { WeatherReader } from '@systems/weather';
import type { Scenario } from './runner';
import { TestWorld } from './test-world';

const SEED = 'we-snow';
const REGION = { temper: 2, traits: [] as string[] };

/** Winter day 28, 12:00. */
const START = 4 * DAYS_PER_SEASON * TICKS_PER_DAY - 12 * TICKS_PER_HOUR;

const scenario: Scenario = {
  id: 'we_snow',
  milestone: 3,
  seed: SEED,
  world: { region: REGION },
  embark: 'none',
  run: (runner) => {
    const w = new TestWorld({ seed: SEED, world: 'local', spec: regionSpec(SEED, REGION, runner.game.registry), startTick: START });
    const weather = w.readers.of<WeatherReader>('06');
    const chunks = w.weather.exposedColumns().flat().sort((a, b) => a - b);
    expect(chunks.length).toBeGreaterThan(0);
    expect(w.readers.calendar.season).toBe(3);

    w.forceWeather('snow');
    const covered = (): boolean => chunks.every((c) => weather.snowCoveredChunks().includes(c));
    const took = w.until(covered, 6 * TICKS_PER_HOUR);
    expect(covered()).toBe(true);
    expect(took).toBeLessThanOrEqual(6 * TICKS_PER_HOUR);
    const surface = w.index(40, 40, w.map.columnSurfaceZ(40, 40));
    expect(w.map.hasFlag(surface, TileFlag.Snow)).toBe(true);

    w.forceWeather('clear');
    let warmHours = 0;
    let hours = 0;
    while (weather.snowCoveredChunks().length > 0 && hours < 48) {
      w.step(TICKS_PER_HOUR);
      hours += 1;
      if (weather.surfaceTempC() > MELT_C) warmHours += 1;
    }
    expect(weather.snowCoveredChunks()).toEqual([]);
    expect(warmHours).toBeGreaterThan(0);
    expect(warmHours).toBeLessThanOrEqual(5);
    expect(w.map.hasFlag(surface, TileFlag.Snow)).toBe(false);
  },
};

export default scenario;
