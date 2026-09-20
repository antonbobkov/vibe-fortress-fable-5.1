/**
 * `pl_light_rule` of `04-implementation/acceptance-tests.md` § 07 Plants: "dimcap on a lit tile;
 * barley on a dark tile | neither grows; UI refuses mixed plots (`light_mismatch`)".
 *
 * `07` § Growth `lightOk`: a `sun` species needs the `lit` flag, a `dark` species needs it clear.
 * `07` § Farm plots: the crop of a season must match the plot's kind (`light_mismatch`), and a plot
 * whose tiles are partly lit is refused at placement (`bad_zone_tiles`, T-M4-01).
 *
 * The lit plot is the flat-test surface at z = 32; the dark plot is a room dug into the soil at
 * z = 30, whose tiles the generator never lit.
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { PlantsReader } from '@systems/plants';
import type { Scenario } from './runner';
import { rect } from './m1-helpers';
import type { TestWorld } from './test-world';

const CAVE_Z = FLAT_TEST_SURFACE_Z - 2;

let sunTile = 0;
let darkTile = 0;
let sunPlot = 0;
let cavePlot = 0;

const scenario: Scenario = {
  id: 'pl_light_rule',
  milestone: 4,
  seed: 'pl-light-rule',
  world: 'flat-test',
  embark: 'none',
  setup: (w: TestWorld) => {
    const surface = rect(w, 40, 40, FLAT_TEST_SURFACE_Z, 2, 2);
    w.digRoom(40, 44, CAVE_Z, 2, 2);
    const cave = rect(w, 40, 44, CAVE_Z, 2, 2);
    sunPlot = w.zone('farm_plot', surface);
    cavePlot = w.zone('farm_plot', cave);
    sunTile = surface[0] as number;
    darkTile = cave[0] as number;
    // A cave species on a lit tile and a surface species in the dark: both are placed anyway.
    w.plantCrop(sunTile, 'dimcap');
    w.plantCrop(darkTile, 'barley');
  },
  run: (w: TestWorld) => {
    // The plot settings refuse the mismatched species, each way round.
    expect(w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: sunPlot, season: 0, speciesId: 'dimcap' })).toEqual({
      ok: false,
      reason: 'light_mismatch',
    });
    expect(w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: cavePlot, season: 0, speciesId: 'barley' })).toEqual({
      ok: false,
      reason: 'light_mismatch',
    });
    // The matching species are accepted.
    expect(w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: sunPlot, season: 0, speciesId: 'barley' }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: cavePlot, season: 0, speciesId: 'dimcap' }).ok).toBe(true);
    // A plot drawn over lit and unlit tiles at once is refused at placement.
    const mixed = [...rect(w, 44, 40, FLAT_TEST_SURFACE_Z, 2, 1), ...rect(w, 44, 44, CAVE_Z, 2, 1)];
    w.digRoom(44, 44, CAVE_Z, 2, 1);
    expect(w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: mixed })).toEqual({
      ok: false,
      reason: 'bad_zone_tiles',
    });
    w.step(200);
  },
  expect: (w: TestWorld) => {
    const plants = w.readers.of<PlantsReader>('07');
    expect(plants.plotKind(sunPlot)).toBe('surface');
    expect(plants.plotKind(cavePlot)).toBe('cave');
    // Neither crop grew: still stage 0 with no accumulated growth.
    for (const tile of [sunTile, darkTile]) {
      const id = plants.cropAt(tile);
      expect(id).toBeGreaterThan(0);
      const crop = w.game.world.entities.get(id, C.Crop);
      expect([tile, crop?.stage, crop?.growth]).toEqual([tile, 0, 0]);
    }
  },
};

export default scenario;
