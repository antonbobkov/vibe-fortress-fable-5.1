/**
 * `fl_freeze` of `04-implementation/acceptance-tests.md` § 04 Fluids: "outdoor pond, temper 4
 * region, winter | pond tiles frozen (`ice`) within a day of `surfaceTempC < FREEZE_C`; thawed in
 * spring".
 *
 * T-M3-05 asks for this "through `forceTemperature` and through real weather". Weather is T-M3-06,
 * which lists T-M3-05 under its *Needs*, so this file drives the pond's temperature with
 * `forceTemperature` (winter: −10 °C; spring: +8 °C); the weather-driven run is added by T-M3-06,
 * the first point at which a temper-4 winter exists (D-099, as D-025 did).
 */

import { expect } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { Scenario } from './runner';
import { digPond } from './pond';

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
  },
};

export default scenario;
