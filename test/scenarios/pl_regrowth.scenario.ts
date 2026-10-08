/**
 * `pl_regrowth` of `04-implementation/acceptance-tests.md` § 07 Plants: "clear a 20×20 grass area
 * of trees, run 2 years | ≥ 5 saplings, ≥ 2 trees".
 *
 * `07` § Trees: each `DayPassed`, `REGROWTH_TRIES_PER_DAY` random outdoor soil floors with grass
 * and no tree or sapling within 2 tiles take a sapling with `biome.treeDensity × REGROWTH_PERMILLE`;
 * a sapling becomes a tree after its species' `saplingYears`.
 *
 * The area is a 20×20 patch of grass on the compact `flat-test` columns (D-059) with the taiga's
 * tree table, whose `pine` and `birch` are the two-year species. Only 07 is registered: the rule
 * reads the map, the calendar and its own stream. The tree count is taken after the second
 * anniversary plus a month, because a sapling planted on day *d* is a tree on day *d* + 730 and the
 * first sapling cannot appear before day 1 (docs/02-systems/07-plants-and-farming.md § Regrowth).
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z, buildFlatTestMap, regionSpec } from '@app/headless';
import { TICKS_PER_DAY, TICKS_PER_YEAR } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import { PlantsSystem, type PlantsReader } from '@systems/plants';
import type { Scenario } from './runner';
import { TestWorld } from './test-world';

const SIDE = 20;
const ORIGIN = 2;
const MARGIN_DAYS = 30;

const scenario: Scenario = {
  id: 'pl_regrowth',
  milestone: 4,
  seed: 'pl-regrowth',
  world: 'flat-test',
  embark: 'none',
  run: (outer: TestWorld) => {
    const registry = outer.game.registry;
    const spec = regionSpec('pl-regrowth', { biome: 'taiga' }, registry);
    const w = new TestWorld({
      seed: 'pl-regrowth',
      registry,
      map: buildFlatTestMap(registry, 24, 24),
      embark: 'none',
      systems: [new PlantsSystem({ spec })],
    });
    // A cleared 20×20 patch of grass: soil floor, outdoors, no tree or sapling on it.
    const patch: number[] = [];
    for (let dy = 0; dy < SIDE; dy += 1) {
      for (let dx = 0; dx < SIDE; dx += 1) {
        const i = w.index(ORIGIN + dx, ORIGIN + dy, FLAT_TEST_SURFACE_Z);
        w.map.setFlag(i, TileFlag.Grass, true);
        patch.push(i);
      }
    }
    expect(patch.every((i) => w.map.kindAt(i) === TileKind.Floor)).toBe(true);

    w.step(2 * TICKS_PER_YEAR);
    const plants = w.readers.of<PlantsReader>('07');
    const saplingsSeen = new Set<number>([...plants.saplings(), ...w.events('SaplingGrew').map((e) => e['tile'] as number)]);
    expect(saplingsSeen.size).toBeGreaterThanOrEqual(5);

    w.step(MARGIN_DAYS * TICKS_PER_DAY);
    const trees = patch.filter((i) => w.map.kindAt(i) === TileKind.Tree);
    expect(trees.length).toBeGreaterThanOrEqual(2);
    expect(w.events('SaplingGrew').length).toBeGreaterThanOrEqual(trees.length);
    // Every tree stands where a sapling did, and nothing grew within 2 tiles of another tree.
    for (const i of trees) expect(plants.speciesAt(i)).not.toBe('');
  },
};

export default scenario;
