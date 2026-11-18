/**
 * T-587: a site one soil level deep has its soil only in its surface floors, and a `channel` digs a
 * floor of a soil tagged `soil_drop` out for its load (`03-terrain-and-mining.md` § Local map
 * generation stage 3, § Tile transitions).
 */
import { describe, expect, it } from 'vitest';
import { regionSpec } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import type { Item } from '@core/components';
import { LOCAL_MAP_Z } from '@core/constants';
import { Designation, Map3D, TileFlag, TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import { TerrainFacts, transition, type TransitionRolls } from '@systems/terrain';
import { generateLocal } from '@systems/terrain/generate';
import { HeadlessGame } from '@app/headless';
import { onlyMiner } from '../scenarios/m1-helpers';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const materials = registry.table('materials');
const facts = new TerrainFacts(registry);
const mat = (id: string): number => materials.index(id);

/** A channel on (1,1,2) over a tile of `below`, the floor being of `floor`. */
function channel(floor: string, below: string, opts: { constructed?: boolean } = {}): { drops: { type: string; material: number | string }[]; rolled: number } {
  const map = new Map3D(3, 3, 4);
  const i = map.index(1, 1, 2);
  const under = map.index(1, 1, 1);
  map.setKind(under, TileKind.Wall, mat(below));
  map.setKind(i, TileKind.Floor, mat(floor));
  if (opts.constructed === true) map.setFlag(i, TileFlag.Constructed, true);
  let rolled = 0;
  const rolls: TransitionRolls = {
    stoneDrops: () => false,
    soilDrops: () => { rolled += 1; return true; },
    logs: () => 1,
    gather: () => null,
    logMaterial: () => '',
  };
  const r = transition(map, i, Designation.Channel, facts, rolls);
  return { drops: r.drops.map((d) => ({ type: d.type, material: d.material })), rolled };
}

describe('T-587 a channelled soil floor drops its soil', () => {
  it('a floor of sand, clay or peat rolls its own soil drop; loam, silt and stone floors do not', () => {
    for (const soil of ['sand', 'clay', 'peat']) {
      const r = channel(soil, 'granite');
      expect(r.rolled).toBe(1);
      expect(r.drops).toEqual([{ type: 'soil_load', material: mat(soil) }]);
    }
    for (const floor of ['loam', 'silt', 'granite']) {
      const r = channel(floor, 'granite');
      expect(r.rolled).toBe(0);
      expect(r.drops).toEqual([]);
    }
  });

  it('a soil floor over a soil wall rolls twice, the floor first; a constructed floor rolls nothing of its own', () => {
    const r = channel('sand', 'clay');
    expect(r.rolled).toBe(2);
    expect(r.drops).toEqual([{ type: 'soil_load', material: mat('sand') }, { type: 'soil_load', material: mat('clay') }]);
    const built = channel('clay', 'granite', { constructed: true });
    expect(built.rolled).toBe(0);
    expect(built.drops).toEqual([]);
  });
});

/** A 48 × 48 site of a biome, as T-583's sites probe makes them. */
function siteMap(seed: string, biome: string): { spec: ReturnType<typeof regionSpec>; map: Map3D; local: ReturnType<typeof generateLocal> } {
  const spec = regionSpec(seed, { peril: 0, wealth: 2, biome, geology: 'sedimentary', traits: [], relief: 1, river: { class: 'brook', inflow: ['w'], outflow: 's' } } as never, registry);
  const map = new Map3D(48, 48, LOCAL_MAP_Z);
  const local = generateLocal(spec, map, registry);
  return { spec, map, local };
}

describe('T-587 a site one soil level deep', () => {
  it('desert, badlands, mountain and tundra have their soil only as surface floors', () => {
    const want: Record<string, string[]> = { desert: ['sand'], badlands: ['clay', 'sand'], mountain: ['sand'], tundra: ['peat'] };
    for (const [biome, soils] of Object.entries(want)) {
      const { map } = siteMap(`t587-${biome}`, biome);
      const floors: Record<string, number> = {};
      let walls = 0;
      for (let t = 0; t < map.tileCount; t += 1) {
        const m = map.materialAt(t);
        if (!facts.dropsSoil(m)) continue;
        if (map.kindAt(t) === TileKind.Wall) walls += 1;
        if (map.kindAt(t) === TileKind.Floor) floors[materials.byIndex(m)?.id as string] = (floors[materials.byIndex(m)?.id as string] ?? 0) + 1;
      }
      expect(walls, biome).toBe(0);
      for (const soil of soils) expect(floors[soil] ?? 0, `${biome} ${soil}`).toBeGreaterThan(50);
    }
  });

  it('a desert fortress channels its sand floors for loads of sand', () => {
    const seed = 't587-desert-play';
    const { spec, map, local } = siteMap(seed, 'desert');
    const w = new TestWorld({ seed, registry, map, spec, systems: HeadlessGame.standardSystems(spec, local.layerStack, local), embark: 'default' });
    onlyMiner(w);
    const wagon = w.game.arrival?.wagon;
    expect(wagon).toBeDefined();
    const { x: wx, y: wy } = wagon as { x: number; y: number };
    // Sand floors by distance from the wagon, out of its 3 × 3 patch, under no building.
    const sand: TileIndex[] = [];
    for (let r = 3; r < 20 && sand.length < 8; r += 1) {
      for (let y = wy - r; y <= wy + r && sand.length < 8; y += 1) {
        for (let x = wx - r; x <= wx + r && sand.length < 8; x += 1) {
          if (Math.max(Math.abs(x - wx), Math.abs(y - wy)) !== r || x < 1 || y < 1 || x >= map.w - 1 || y >= map.h - 1) continue;
          const t = map.index(x, y, map.columnSurfaceZ(x, y));
          if (map.kindAt(t) === TileKind.Floor && map.materialAt(t) === mat('sand') && map.buildingAtTile(t) === 0 &&
            !sand.some((s) => Math.abs(map.xOf(s) - x) + Math.abs(map.yOf(s) - y) < 2)) sand.push(t);
        }
      }
    }
    expect(sand.length).toBe(8);
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: sand, kind: 'channel', priority: 5 }).ok).toBe(true);
    w.until((v) => sand.every((t) => v.map.kindAt(t) === TileKind.Open), 20000);
    const soilLoad = registry.table('items').index('soil_load');
    const loads: Item[] = [];
    for (const id of w.game.world.entities.with(C.Item)) {
      const item = w.game.world.entities.get(id, C.Item) as Item;
      if (item.type === soilLoad) loads.push(item);
    }
    const count = loads.reduce((sum, item) => sum + item.count, 0);
    // Eight sand floors at 500‰ each: none at all would be a 1-in-256 run of misses.
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(8);
    for (const item of loads) expect(item.material).toBe(mat('sand'));
  });
});
