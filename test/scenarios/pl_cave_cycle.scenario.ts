/**
 * `pl_cave_cycle` of `04-implementation/acceptance-tests.md` § 07 Plants: "4×4 dimcap plot,
 * 10 seeds, 1 farmer | first harvest at 16 ± 1 days; yield 3–5 per tile; seeds ≥ 10 after harvest".
 *
 * The whole farming loop: a cave plot, `SetPlotCrop`, the `plants` producer's `plant` jobs, growth
 * at 100% (a cave crop ignores season and weather), the `autoHarvest` standing order's `harvest`
 * jobs, and the yields. Dimcap's `stageDays` is 4 and its cycle is four stages, so a tile is ready
 * 16 days after it was planted (docs/02-systems/07-plants-and-farming.md § Cave farming).
 *
 * The run is 17 game days, so it uses the compact `flat-test` columns (32 × 32, D-059): the rules
 * under test read only the plot's tiles, the seeds and the one farmer.
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z, buildFlatTestMap } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import type { ItemsReader } from '@systems/items';
import type { PlantsReader } from '@systems/plants';
import type { Scenario } from './runner';
import { TestWorld } from './test-world';

const PLOT = 4;
const SEEDS = 10;
const CAVE_Z = FLAT_TEST_SURFACE_Z - 2;
const LIMIT = 18 * TICKS_PER_DAY;

function tilesOf(w: TestWorld, x: number, y: number, z: number, width: number, height: number): number[] {
  const out: number[] = [];
  for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) out.push(w.index(x + dx, y + dy, z));
  return out;
}

const scenario: Scenario = {
  id: 'pl_cave_cycle',
  milestone: 4,
  seed: 'pl-cave-cycle',
  world: 'flat-test',
  embark: 'none',
  run: (outer: TestWorld) => {
    const w = new TestWorld({ seed: 'pl-cave-cycle', registry: outer.game.registry, map: buildFlatTestMap(outer.game.registry, 32, 32), embark: 'none' });
    // A dark chamber in the soil, the plot inside it, ten seeds and one farmer.
    w.digRoom(10, 10, CAVE_Z, 8, 8);
    const plot = tilesOf(w, 11, 11, CAVE_Z, PLOT, PLOT);
    const zoneId = w.zone('farm_plot', plot);
    const farmer = w.spawnDwarf({ at: w.index(10, 10, CAVE_Z), skills: { farming: 0 } });
    expect(farmer).toBeGreaterThan(0);
    w.spawnItem('drink', 'ale', w.index(10, 12, CAVE_Z), 100);
    w.spawnItem('easy_meal', 'dimcap', w.index(10, 13, CAVE_Z), 50);
    w.spawnItem('seed', 'dimcap', w.index(16, 16, CAVE_Z), SEEDS);
    expect(w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId, season: 0, speciesId: 'dimcap' }).ok).toBe(true);

    // Every seed is in the ground: stop the plot from asking for more, so the seed count after the
    // harvest is the harvest's own.
    w.until((world) => world.events('CropPlanted').length >= SEEDS, LIMIT);
    expect(w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId, season: 0, speciesId: 0 }).ok).toBe(true);
    const planted = w.events('CropPlanted').length;
    expect(planted).toBe(SEEDS);
    const plantedTick = w.tick;

    w.until((world) => world.events('CropHarvested').length > 0, LIMIT);
    const firstHarvestDay = w.tick / TICKS_PER_DAY;
    expect(plantedTick / TICKS_PER_DAY).toBeLessThan(1);
    expect(firstHarvestDay).toBeGreaterThanOrEqual(15);
    expect(firstHarvestDay).toBeLessThanOrEqual(17);

    w.until((world) => world.events('CropHarvested').length >= SEEDS, LIMIT);
    const harvests = w.events('CropHarvested');
    expect(harvests).toHaveLength(SEEDS);
    for (const h of harvests) {
      expect(h['species']).toBe('dimcap');
      // Yield 3–5 per tile at farming 0 (`plants.md`: dimcap 3–5, no skill bonus below level 5).
      expect(h['count']).toBeGreaterThanOrEqual(3);
      expect(h['count']).toBeLessThanOrEqual(5);
    }
    const items = w.readers.of<ItemsReader>('13');
    // "Harvest returns one seed; brewing does not": ten harvests, ten seeds.
    expect(items.count('seed')).toBeGreaterThanOrEqual(SEEDS);
    expect(items.count('plant_food')).toBeGreaterThanOrEqual(3 * SEEDS);
    expect(w.readers.of<PlantsReader>('07').crops()).toHaveLength(0);
  },
};

export default scenario;
