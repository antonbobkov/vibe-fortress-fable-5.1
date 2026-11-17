/**
 * `pl_greenhouse` of `04-implementation/acceptance-tests.md` § 07 Plants: "winter, glass floors over
 * soil plots | one level under the glass cabbage ripens and barley does not; in the hearth's square
 * barley grows most hours; three levels down strawberries grow every hour; outdoors nothing grows".
 *
 * `03` § Outdoor and lit: a constructed glass floor is a skylight, and the tiles under it are
 * `skylit` (and so `lit`). `05` § Temperature model: a skylit tile is covered, so it follows the
 * near-surface blend: one level under the glass a temperate winter is −1 to 7 °C over the day (3 °C
 * on the day's mean), three levels down `UNDERGROUND_BASE_C`. `07` § Under a skylight: a surface
 * crop there ignores its seasons and the weather, as a cave crop does, and keeps its `minC`.
 *
 * The glass floors are built through 14's construction path (`PlaceBuilding` of a `floor` of
 * `glass`); the plots are farm plot zones the commands accept as surface plots.
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { DAYS_PER_SEASON, HOURS_PER_DAY, START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { PlantsReader } from '@systems/plants';
import { BASE_GROWTH } from '@systems/plants/constants';
import { rect } from './m1-helpers';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';

/** Day 1 of winter, hour `START_HOUR`. */
const WINTER_TICK = 3 * DAYS_PER_SEASON * TICKS_PER_DAY + START_HOUR * TICKS_PER_HOUR;
const TOP = FLAT_TEST_SURFACE_Z;
/** The rest of winter: the scenario ends before spring's first hour. */
const RUN_DAYS = 27;

interface Plot { tile: TileIndex; zone: number; crop: number }
const plots: Record<'cabbage' | 'barley' | 'hearthBarley' | 'deepStrawberry' | 'outdoorCabbage', Plot> = {
  cabbage: { tile: 0, zone: 0, crop: 0 },
  barley: { tile: 0, zone: 0, crop: 0 },
  hearthBarley: { tile: 0, zone: 0, crop: 0 },
  deepStrawberry: { tile: 0, zone: 0, crop: 0 },
  outdoorCabbage: { tile: 0, zone: 0, crop: 0 },
};

/** A glass floor over `(x, y)` at the surface, built through the construction path. */
function glassRoof(w: TestWorld, x: number, y: number): void {
  w.build('floor', w.index(x, y, TOP), 'glass');
}

/** A one-tile farm plot with a crop of `species`. */
function plot(w: TestWorld, key: keyof typeof plots, tile: TileIndex, species: string): void {
  const zone = w.zone('farm_plot', [tile]);
  // A sun crop is accepted: the plot under the glass is a surface plot.
  expect(w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: zone, season: 3, speciesId: species }).ok, key).toBe(true);
  plots[key] = { tile, zone, crop: w.plantCrop(tile, species) };
}

const scenario: Scenario = {
  id: 'pl_greenhouse',
  milestone: 4,
  seed: 'pl-greenhouse',
  world: 'flat-test',
  embark: 'none',
  startTick: WINTER_TICK,
  setup: (w: TestWorld) => {
    w.forceWeather('clear');
    // One level under the glass: a soil room at z = 31 roofed by glass floors.
    const z1 = TOP - 1;
    w.digRoom(40, 40, z1, 4, 1);
    for (const t of rect(w, 40, 40, z1, 4, 1)) w.discover(t);
    for (let x = 40; x < 44; x += 1) glassRoof(w, x, 40);
    // The hearth's greenhouse: a soil hall one level down, glass over its corner plot.
    w.digRoom(60, 40, z1, 5, 5);
    for (const t of rect(w, 60, 40, z1, 5, 5)) w.discover(t);
    w.build('hearth', w.index(62, 42, z1), 'granite');
    glassRoof(w, 60, 40);
    // Three levels down: a mud floor of granite under two open levels and a glass floor.
    const z3 = TOP - 3;
    w.digRoom(80, 40, z3, 1, 1);
    for (let z = z3; z < TOP; z += 1) w.discover(w.index(80, 40, z));
    w.carve(w.index(80, 40, z3 + 1), TileKind.Open);
    w.carve(w.index(80, 40, z3 + 2), TileKind.Open);
    w.game.world.map.setFlag(w.index(80, 40, z3), TileFlag.Mud, true);
    glassRoof(w, 80, 40);
    // The light pass runs at the end of the tick.
    w.step(1);
    plot(w, 'cabbage', w.index(40, 40, z1), 'cabbage');
    plot(w, 'barley', w.index(42, 40, z1), 'barley');
    plot(w, 'hearthBarley', w.index(60, 40, z1), 'barley');
    plot(w, 'deepStrawberry', w.index(80, 40, z3), 'strawberry');
    plot(w, 'outdoorCabbage', w.index(40, 45, TOP), 'cabbage');
  },
  run: RUN_DAYS * TICKS_PER_DAY,
  expect: (w: TestWorld) => {
    const map = w.game.world.map;
    const plants = w.readers.of<PlantsReader>('07');
    const buildings = w.readers.of<BuildingsReader>('14');
    expect(w.readers.calendar.season).toBe(3);
    for (const key of ['cabbage', 'barley', 'hearthBarley', 'deepStrawberry'] as const) {
      const tile = plots[key].tile;
      expect([key, map.hasFlag(tile, TileFlag.Skylit), map.hasFlag(tile, TileFlag.Lit), map.hasFlag(tile, TileFlag.Outdoor)]).toEqual([key, true, true, false]);
      expect([key, plants.plotKind(plots[key].zone)]).toEqual([key, 'surface']);
    }
    expect(buildings.hearthLightAt(plots.hearthBarley.tile)).toBe(true);
    // Growth units gained since sowing: one hour at full rate is `BASE_GROWTH`.
    const gained = (key: keyof typeof plots): number => {
      const crop = w.game.world.entities.get(plots[key].crop, C.Crop);
      const row = w.plants.facts.row(crop?.plant ?? 0);
      return (crop?.stage ?? 0) * (row?.stageDays ?? 0) * HOURS_PER_DAY * BASE_GROWTH + (crop?.growth ?? 0);
    };
    const allHours = RUN_DAYS * HOURS_PER_DAY * BASE_GROWTH;
    // One level under the glass (−1 to 7 °C over the day): cabbage (min 0 °C) grows nearly every
    // hour and ripens in winter; barley (min 4 °C) only in the warm afternoons, and is not ripe.
    expect(plants.cropReady(plots.cabbage.tile)).toBe(true);
    expect(gained('barley')).toBeGreaterThan(0);
    expect(gained('barley')).toBeLessThan(allHours / 2);
    expect(plants.cropReady(plots.barley.tile)).toBe(false);
    // The hearth's square is 2 °C warmer: barley there grows most hours.
    expect(gained('hearthBarley')).toBeGreaterThan(allHours / 2);
    // Three levels down it is `UNDERGROUND_BASE_C` day and night: strawberries grow every hour.
    expect(gained('deepStrawberry')).toBe(allHours);
    // The same cabbage on the open surface sleeps through the winter.
    expect(gained('outdoorCabbage')).toBe(0);
  },
};

export default scenario;
