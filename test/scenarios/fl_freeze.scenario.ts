/**
 * `fl_freeze` of `04-implementation/acceptance-tests.md` § 04 Fluids: "outdoor pond, temper 4
 * region, winter | pond tiles frozen (`ice`) within a day of `surfaceTempC < FREEZE_C`; thawed in
 * spring".
 *
 * T-M3-05 asks for this "through `forceTemperature` and through real weather". Weather is T-M3-06,
 * which lists T-M3-05 under its *Needs*, so this file drives the pond's temperature with
 * `forceTemperature` (winter: −10 °C; spring: +8 °C); the weather-driven run is added by T-M3-06,
 * the first point at which a temper-4 winter exists (D-099, as D-025 did): the same pond in a
 * temper-4 region from the end of winter, frozen by 06's surface temperature within a day of it
 * falling below `FREEZE_C`, and thawed by spring's.
 */

import { expect } from 'vitest';
import { regionSpec } from '@app/headless';
import { DAYS_PER_SEASON, TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import { FREEZE_C } from '@systems/fluids/constants';
import type { WeatherReader } from '@systems/weather';
import { TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { Scenario } from './runner';
import { digPond } from './pond';
import { TestWorld } from './test-world';

/** Through real weather: a temper-4 region from winter day 26, 12:00 (D-099's second half). */
function throughWeather(registry: TestWorld['game']['registry']): void {
  const region = { temper: 4, traits: [] as string[] };
  const start = 4 * DAYS_PER_SEASON * TICKS_PER_DAY - 2 * TICKS_PER_DAY - 12 * TICKS_PER_HOUR;
  const w = new TestWorld({ seed: 'fl-freeze-weather', world: 'local', spec: regionSpec('fl-freeze-weather', region, registry), startTick: start });
  const tiles = digPond(w, 3);
  const weather = w.readers.of<WeatherReader>('06');
  expect(w.readers.calendar.season).toBe(3);
  const cold = w.until((ww) => ww.readers.of<WeatherReader>('06').surfaceTempC() < FREEZE_C, TICKS_PER_DAY);
  expect(weather.surfaceTempC()).toBeLessThan(FREEZE_C);
  const frozeIn = w.until((ww) => tiles.every((t) => ww.fluids.sim.isFrozen(t)), TICKS_PER_DAY);
  expect(cold).toBeLessThan(TICKS_PER_DAY);
  expect(frozeIn).toBeLessThanOrEqual(TICKS_PER_DAY);
  // Spring: the pond thaws.
  const toSpring = 4 * DAYS_PER_SEASON * TICKS_PER_DAY - w.tick;
  w.step(toSpring);
  expect(w.readers.calendar.season).toBe(0);
  const thawIn = w.until((ww) => tiles.every((t) => !ww.fluids.sim.isFrozen(t)), 3 * TICKS_PER_DAY);
  expect(thawIn).toBeLessThanOrEqual(3 * TICKS_PER_DAY);
  expect(w.fluidSum(tiles)).toBe(27);
}

let pond: TileIndex[] = [];

const scenario: Scenario = {
  id: 'fl_freeze',
  milestone: 3,
  seed: 'fl-freeze',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    pond = digPond(w, 3);
  },
  run: (w) => {
    const ice = w.game.registry.table('materials').index('ice');
    w.step(20);
    for (const t of pond) expect(w.fluids.sim.isFrozen(t)).toBe(false);
    // Winter: below FREEZE_C.
    for (const t of pond) w.forceTemperature(t, -10);
    const frozeIn = w.until((ww) => pond.every((t) => ww.fluids.sim.isFrozen(t)), TICKS_PER_DAY);
    expect(frozeIn).toBeLessThanOrEqual(TICKS_PER_DAY);
    for (const t of pond) {
      expect(w.map.materialAt(t)).toBe(ice);
      expect(w.fluids.sim.level(t)).toBe(3);
    }
    expect(w.events('TileFrozen').length).toBe(pond.length);
    w.step(200);
    // Spring: above THAW_C.
    for (const t of pond) w.forceTemperature(t, 8);
    w.until((ww) => pond.every((t) => !ww.fluids.sim.isFrozen(t)), TICKS_PER_DAY);
    for (const t of pond) {
      expect(w.map.kindAt(t)).toBe(TileKind.Floor);
      expect(w.map.materialAt(t)).not.toBe(ice);
    }
    expect(w.fluidSum(pond)).toBe(27);
    expect(w.events('TileThawed').length).toBe(pond.length);
    throughWeather(w.game.registry);
  },
};

export default scenario;
