/**
 * The hand-built 8×8 map T-M0-13 asks the compositor golden to cover: every tile kind, the worked
 * and covered flags, a 3-deep shaft, a column with a fluid below, an outdoor sky column and an
 * undiscovered corner.
 *
 * The map is 8×8×8 and the viewport looks at z = 4, so `LEVELS_VISIBLE_BELOW` has room below it.
 */

import { loadContent } from '@content/loader';
import { FluidType, Map3D, TileFlag, TileKind } from '@core/map3d';
import { World } from '@core/world';
import { START_HOUR, TICKS_PER_HOUR } from '@core/constants';
import type { Registry } from '@core/registry';

export const FIXTURE_W = 8;
export const FIXTURE_H = 8;
export const FIXTURE_D = 8;
export const FIXTURE_Z = 4;

/** Embark's hour, which `calendar.isDaylight` reports as day. */
export const DAYLIGHT_TICK = START_HOUR * TICKS_PER_HOUR;

export interface TerrainFixture {
  readonly world: World;
  readonly map: Map3D;
  readonly registry: Registry;
}

function mat(registry: Registry, id: string): number {
  return registry.table('materials').index(id);
}

/**
 * Build the fixture. `daylight` chooses whether the open sky column reads as `sky_day` or
 * `sky_night`; 06 weather owns the flag from M3, and until then it is set here directly.
 */
export function buildTerrainFixture(daylight = true): TerrainFixture {
  const registry = loadContent();
  const map = new Map3D(FIXTURE_W, FIXTURE_H, FIXTURE_D);
  const granite = mat(registry, 'granite');
  const loam = mat(registry, 'loam');
  const marble = mat(registry, 'marble');
  const oak = mat(registry, 'oak');

  const at = (x: number, y: number, z = FIXTURE_Z): number => map.index(x, y, z);

  // Everything is rough granite wall, discovered, until a tile below says otherwise.
  for (let i = 0; i < map.tileCount; i += 1) {
    map.kind[i] = TileKind.Wall;
    map.material[i] = granite;
    map.flags[i] = TileFlag.Discovered;
  }

  // Row 0: the wall states and the tile kinds that are not floors.
  map.flags[at(0, 0)] = 0; // the undiscovered corner
  map.setFlag(at(2, 0), TileFlag.Smoothed, true);
  map.setFlag(at(3, 0), TileFlag.Engraved, true);
  map.setFlag(at(4, 0), TileFlag.Constructed, true);
  map.setKind(at(4, 0), TileKind.Wall, marble);
  map.setKind(at(5, 0), TileKind.Fortification, granite);
  map.setKind(at(6, 0), TileKind.Tree, oak);
  map.setKind(at(7, 0), TileKind.Sapling, oak);

  // Row 1: the floor states.
  map.setKind(at(0, 1), TileKind.Floor, granite);
  map.setKind(at(1, 1), TileKind.Floor, granite);
  map.setFlag(at(1, 1), TileFlag.Smoothed, true);
  map.setKind(at(2, 1), TileKind.Floor, marble);
  map.setFlag(at(2, 1), TileFlag.Engraved, true);
  map.setKind(at(3, 1), TileKind.Floor, marble);
  map.setFlag(at(3, 1), TileFlag.Constructed, true);
  map.setKind(at(4, 1), TileKind.Floor, loam);
  map.setFlag(at(4, 1), TileFlag.Grass, true);
  map.setFlag(at(4, 1), TileFlag.Outdoor, true);
  map.setKind(at(5, 1), TileKind.Floor, loam);
  map.setFlag(at(5, 1), TileFlag.Grass, true); // indoor: cave moss
  map.setKind(at(6, 1), TileKind.Floor, loam);
  map.setFlag(at(6, 1), TileFlag.Mud, true);
  map.setKind(at(7, 1), TileKind.Floor, loam);
  map.setFlag(at(7, 1), TileFlag.Snow, true);

  // Row 2: ash, the ramp, the three stairs, the shrub, the boulder, and a one-deep look-down.
  map.setKind(at(0, 2), TileKind.Floor, loam);
  map.setFlag(at(0, 2), TileFlag.Ash, true);
  map.setKind(at(1, 2), TileKind.Ramp, granite);
  map.setKind(at(2, 2), TileKind.StairsUp, granite);
  map.setKind(at(3, 2), TileKind.StairsDown, granite);
  map.setKind(at(4, 2), TileKind.StairsUpDown, granite);
  map.setKind(at(5, 2), TileKind.Shrub, loam);
  map.setKind(at(6, 2), TileKind.Boulder, granite);
  map.setKind(at(7, 2), TileKind.Open, 0);
  map.setKind(at(7, 2, FIXTURE_Z - 1), TileKind.Floor, granite);

  // Row 3: the look-down cases.
  // (0,3): floor two levels below, dimmed twice.
  map.setKind(at(0, 3), TileKind.Open, 0);
  map.setKind(at(0, 3, FIXTURE_Z - 1), TileKind.Open, 0);
  map.setKind(at(0, 3, FIXTURE_Z - 2), TileKind.Floor, marble);
  // (1,3): a shaft three deep, indoors: the abyss.
  for (let k = 0; k <= 3; k += 1) map.setKind(at(1, 3, FIXTURE_Z - k), TileKind.Open, 0);
  // (2,3): the same shaft, outdoors: the sky.
  for (let k = 0; k <= 3; k += 1) {
    map.setKind(at(2, 3, FIXTURE_Z - k), TileKind.Open, 0);
    map.setFlag(at(2, 3, FIXTURE_Z - k), TileFlag.Outdoor, true);
  }
  // (3,3): an open tile below that holds water, which stops the look-down at k = 1.
  map.setKind(at(3, 3), TileKind.Open, 0);
  map.setKind(at(3, 3, FIXTURE_Z - 1), TileKind.Open, 0);
  map.fluid[at(3, 3, FIXTURE_Z - 1)] = Map3D.packFluid(7, FluidType.Water, true);
  // (4,3): an open tile at the bottom of the map, with nothing below it at all.
  map.setKind(map.index(4, 3, 0), TileKind.Open, 0);

  const world = new World({ seed: 'm0-terrain', registry, map, startTick: DAYLIGHT_TICK });
  world.init();
  world.calendar.isDaylight = daylight;
  return { world, map, registry };
}
