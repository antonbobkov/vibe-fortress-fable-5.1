/**
 * T-583: flowers stand in mud (07 § Flowers; 23 § Compositor). Rain leaves mud on every outdoor soil
 * floor for good (04 § Mud), and a muddy tile had no flower: in the three-year fixture every flower
 * of the map was gone by day 8, the first rain, and no hive made a comb for the rest of the game.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { TICKS_PER_DAY } from '@core/constants';
import { flowerTile } from '@core/flowers';
import { TileFlag } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { AnimalsReader } from '@systems/animals';
import { HIVE_DAYS, HIVE_FLOWERS_MIN, HIVE_FLOWER_RADIUS } from '@systems/animals/constants';
import type { PlantsReader } from '@systems/plants';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();

function meadow(w: TestWorld, x0: number, y0: number, x1: number, y1: number): void {
  const map = w.game.world.map;
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) map.flags[w.index(x, y, Z)] = (map.flags[w.index(x, y, Z)] ?? 0) | TileFlag.Grass;
}

function flowerySpot(w: TestWorld): TileIndex {
  const plants = w.readers.of<PlantsReader>('07');
  let best = -1;
  let bestN = -1;
  for (let y = 20; y < 40; y += 1) for (let x = 20; x < 40; x += 1) {
    let n = 0;
    for (let yy = y - HIVE_FLOWER_RADIUS; yy <= y + HIVE_FLOWER_RADIUS; yy += 1)
      for (let xx = x - HIVE_FLOWER_RADIUS; xx <= x + HIVE_FLOWER_RADIUS; xx += 1) if (plants.flowerAt(w.index(xx, yy, Z))) n += 1;
    if (n > bestN && !plants.flowerAt(w.index(x, y, Z))) { best = w.index(x, y, Z); bestN = n; }
  }
  return best;
}

describe('T-583 flowers stand in mud', () => {
  it('a muddy grass tile keeps its flower; snow still hides it', () => {
    const w = new TestWorld({ seed: 't583-mud-flower', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const plants = w.readers.of<PlantsReader>('07');
    const share = registry.table<{ id: string; surface?: { flowers?: number } }>('biomes').byId('temperate_grassland')?.surface?.flowers ?? 0;
    meadow(w, 0, 10, 60, 10);
    let picked = -1;
    for (let x = 0; x <= 60 && picked < 0; x += 1) if (flowerTile(share, x, 10, Z)) picked = w.index(x, 10, Z);
    expect(plants.flowerAt(picked)).toBe(true);
    const map = w.game.world.map;
    map.flags[picked] = (map.flags[picked] ?? 0) | TileFlag.Mud;
    expect(plants.flowerAt(picked)).toBe(true);
    map.flags[picked] = (map.flags[picked] ?? 0) | TileFlag.Snow;
    expect(plants.flowerAt(picked)).toBe(false);
  });

  it('after a day of rain the meadow is mud, and the hive beside it still counts its flowers and makes comb', () => {
    const w = new TestWorld({ seed: 't583-mud-hive', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    meadow(w, 10, 10, 50, 50);
    const at = flowerySpot(w);
    const animals = w.readers.of<AnimalsReader>('08');
    const hive = w.build('beehive', at, 'oak');
    w.step(1);
    const before = animals.hiveFlowers(hive);
    expect(before).toBeGreaterThanOrEqual(HIVE_FLOWERS_MIN);
    w.forceWeather('rain');
    w.step(TICKS_PER_DAY);
    w.forceWeather('clear');
    // The rain left mud on the meadow (06 § Weather effects), for good (04 § Mud).
    const map = w.game.world.map;
    const muddy = Array.from({ length: 41 }, (_, k) => w.index(10 + k, 30, Z)).filter((t) => map.hasFlag(t, TileFlag.Mud)).length;
    expect(muddy).toBeGreaterThan(30);
    expect(animals.hiveFlowers(hive)).toBe(before);
    w.step(HIVE_DAYS * TICKS_PER_DAY + 10);
    expect(animals.hiveCombs(hive)).toBeGreaterThanOrEqual(1);
  });
});
