/**
 * `tr_support` of `04-implementation/acceptance-tests.md` § 03 Terrain: "build a floor over open
 * space, remove its only supporting wall | floor collapses; block item appears below;
 * `ConstructionCollapsed`".
 *
 * 14 buildings (M2) builds constructions; until then the scenario lays them through 03's terrain
 * API, the path 14 will use (`03` § Fluids and constructions interplay: "14 calls
 * `terrain.setKind` for constructions and `terrain.setFlag(constructed)`"). The block item is
 * recorded as an intended drop until the item system exists (T-M1-07, T-M1-11).
 */

import { expect } from 'vitest';
import { TileFlag, TileKind } from '@core/map3d';
import type { TerrainReader, TerrainSystem } from '@systems/terrain';
import type { Scenario } from './runner';

const X = 20;
const Y = 20;
const SURFACE = 32;

const scenario: Scenario = {
  id: 'tr_support',
  milestone: 1,
  seed: 'tr-support',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    const terrain = w.game.world.services.terrain;
    const granite = w.game.registry.table('materials').index('granite');
    // A two-high constructed wall on the surface, and a floor beside its top, over open space.
    for (const z of [SURFACE + 1, SURFACE + 2]) {
      const i = w.index(X, Y, z);
      terrain.setKind(i, TileKind.Wall, granite);
      terrain.setFlag(i, TileFlag.Constructed, true);
    }
    const floor = w.index(X + 1, Y, SURFACE + 2);
    terrain.setKind(floor, TileKind.Floor, granite);
    terrain.setFlag(floor, TileFlag.Constructed, true);
  },
  run: (w) => {
    const floor = w.index(X + 1, Y, SURFACE + 2);
    const reader = w.readers.of<TerrainReader>('03');
    w.step(1);
    expect(w.map.kindAt(floor)).toBe(TileKind.Floor);
    expect(reader.isSupported(floor)).toBe(true);
    // Remove the floor's only support: the top of the wall, as a `remove` designation would.
    const core = (w.game.terrain as TerrainSystem).core;
    core.writeMany([{ tile: w.index(X, Y, SURFACE + 2), kind: TileKind.Open, material: 0, clear: TileFlag.Constructed }]);
    w.step(1);
  },
  expect: (w) => {
    const floor = w.index(X + 1, Y, SURFACE + 2);
    const reader = w.readers.of<TerrainReader>('03');
    expect(w.map.kindAt(floor)).toBe(TileKind.Open);
    expect(w.map.hasFlag(floor, TileFlag.Constructed)).toBe(false);
    const collapsed = w.events('ConstructionCollapsed');
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.['tiles']).toEqual([floor]);
    // The block lands on the surface below the collapsed floor.
    const drops = reader.intendedDrops().filter((d) => d.reason === 'collapse');
    expect(drops).toHaveLength(1);
    expect(drops[0]).toMatchObject({ type: 'stone_block', count: 1, tile: w.index(X + 1, Y, SURFACE) });
    // The rest of the wall stands on the ground.
    expect(w.map.kindAt(w.index(X, Y, SURFACE + 1))).toBe(TileKind.Wall);
  },
};

export default scenario;
