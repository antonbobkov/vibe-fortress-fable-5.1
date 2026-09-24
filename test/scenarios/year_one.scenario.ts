/**
 * T-M4-20 year-one balance audit (`03-content/balance.md` § Year-one expectation).
 * The script issues ordinary player commands in each available M4 window, then observes the
 * fortress at days 3, 10, 20 and 84. Later-milestone rows are reported at the gate.
 */
import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z, buildFlatTestMap } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import type { BuildingsReader } from '@systems/buildings';
import type { PlantsReader } from '@systems/plants';
import type { Scenario } from './runner';
import { TestWorld } from './test-world';

const Z = FLAT_TEST_SURFACE_Z;

/** Pick a placement the real ghost accepts, then issue the player command. */
function place(w: TestWorld, type: string): boolean {
  const buildings = w.readers.of<BuildingsReader>('14');
  for (let y = 6; y < 26; y += 4) for (let x = 6; x < 26; x += 4) {
    const origin = w.index(x, y, Z);
    if (buildings.ghost(type, origin, 0).reason !== null) continue;
    return w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: type, origin, orientation: 0, materialChoice: 0 }).ok;
  }
  return false;
}

/** A qualifying surface tile outside existing zones. */
function zone(w: TestWorld, type: string): number {
  const buildings = w.readers.of<BuildingsReader>('14');
  for (let y = 5; y < 27; y += 1) for (let x = 5; x < 27; x += 1) {
    const tile = w.index(x, y, Z);
    if (buildings.zoneAt(tile) !== 0 || !buildings.zoneTileQualifies(type, tile)) continue;
    return w.zone(type, [tile]);
  }
  return 0;
}

/** Probe completed buildings, not just accepted plans. */
function built(w: TestWorld, type: string): boolean {
  const buildings = w.readers.of<BuildingsReader>('14');
  return buildings.byType(type).some((id) => buildings.get(id)?.state === 'built');
}

const scenario: Scenario = {
  id: 'year_one', milestone: 4, seed: 'year-one', world: 'flat-test', embark: 'default',
  run: (outer) => {
    // The small standard flat-test map keeps a multi-season audit inside the scenario timeout.
    const w = new TestWorld({ seed: 'year-one', registry: outer.game.registry,
      map: buildFlatTestMap(outer.game.registry, 32, 32), embark: 'default' });
    const stockpile = zone(w, 'stockpile');
    const carpenterOrder = place(w, 'carpenter');
    const stillOrder = place(w, 'still');
    expect(stockpile).toBeGreaterThan(0);
    expect(carpenterOrder).toBe(true);
    expect(stillOrder).toBe(true);
    w.step(3 * TICKS_PER_DAY);
    const day3 = { stockpile: w.readers.of<BuildingsReader>('14').zone(stockpile) !== undefined,
      carpenter: built(w, 'carpenter'), still: built(w, 'still') };

    const bedroom = zone(w, 'bedroom');
    const dining = zone(w, 'dining_hall');
    const hearthOrder = place(w, 'hearth');
    w.step(7 * TICKS_PER_DAY);
    const day10 = { bedroom: bedroom !== 0, dining: dining !== 0, hearth: built(w, 'hearth'), hearthOrder };

    const farm = zone(w, 'farm_plot');
    const kitchenOrder = place(w, 'kitchen');
    expect(farm).toBeGreaterThan(0);
    expect(w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: farm, season: 0, speciesId: 'barley' }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: farm, season: 1, speciesId: 'barley' }).ok).toBe(true);
    w.step(10 * TICKS_PER_DAY);
    const plants = w.readers.of<PlantsReader>('07');
    const day20 = { farmConfigured: plants.plotSettings(farm)[0] !== 0,
      cropsPlanted: w.events('CropPlanted').length, kitchen: built(w, 'kitchen'), kitchenOrder };

    w.step(64 * TICKS_PER_DAY);
    const day84 = { winter: w.readers.calendar.season === 3,
      surfaceCropDeaths: w.events('CropDied').filter((e) => e['reason'] === 'frost').length,
      caveCrops: plants.crops().filter((id) => plants.cropInfo(id)?.species === 'dimcap').length };
    expect(day3).toMatchObject({ stockpile: true, carpenter: true });
    expect(day20.cropsPlanted).toBeGreaterThan(0);
    expect(day84.winter).toBe(true);
    expect(day84.surfaceCropDeaths).toBeGreaterThan(0);
    console.log(`year_one: ${JSON.stringify({ day3, day10, day20, day84 })}`);
  },
};

export default scenario;
