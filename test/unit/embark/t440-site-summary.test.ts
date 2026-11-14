/**
 * T-440: the world map's site summary says what a site has and lacks, from the same inputs
 * local map generation uses (`02-systems/02-embark-and-loadout.md` § Site summary;
 * `04-implementation/ui-screens/menus-and-world.md` § World map).
 *
 * The summary of real regions of generated worlds is checked against the local map 03 actually
 * generates from the region's spec: soil and its depth, trees and shrubs, grass, and water.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { WORLD_SIZE_SMALL } from '@core/constants';
import { FIXED_SCALE } from '@core/fixed';
import { FluidType, TileFlag, TileKind } from '@core/map3d';
import { WorldMapCompositor } from '@render/world-map';
import { localMapSpec, siteSummary, type LocalMapSpec, type SiteSummary } from '@systems/embark';
import { generateLocalMap } from '@systems/terrain/generate';
import { COL_LAKE, COL_RIVER } from '@systems/terrain/generate/common';
import { generate, type RegionRecord, type WorldMap } from '@systems/worldgen';
import { WorldMapScreen } from '@ui/screens/world_map';
import { keymap, palette, press, registry, strings, surface, theme } from '../ui/ui-fixture';

const materials = registry.table<{ id: string; class: string }>('materials');

interface Site {
  readonly world: WorldMap;
  readonly region: RegionRecord;
  readonly spec: LocalMapSpec;
  readonly summary: SiteSummary;
}

/** What the generated local map has on its surface. */
interface Actual {
  soilColumns: number;
  soilDepths: Set<number>;
  trees: number;
  shrubs: number;
  grass: number;
  riverColumns: number;
  lakeColumns: number;
  springs: number;
  outdoorWater: number;
}

const SEEDS = Array.from({ length: 12 }, (_, k) => `site-${k}`);
const worlds = new Map<string, WorldMap>();
function world(seed: string): WorldMap {
  let w = worlds.get(seed);
  if (w === undefined) {
    w = generate(seed, WORLD_SIZE_SMALL, registry);
    worlds.set(seed, w);
  }
  return w;
}

/** The first region, over the seeds in order and the regions in id order, that `pick` accepts. */
function find(pick: (r: RegionRecord) => boolean): Site {
  for (const seed of SEEDS) {
    const w = world(seed);
    const region = w.regions.find((r) => r.biome !== 'ocean' && r.biome !== 'glacier' && pick(r));
    if (region === undefined) continue;
    const spec = localMapSpec(w, region.id, registry);
    return { world: w, region, spec, summary: siteSummary(spec, registry) };
  }
  throw new Error('no region of that kind in the probe worlds');
}

function measure(spec: LocalMapSpec): Actual {
  const { map, result } = generateLocalMap(spec, registry);
  const a: Actual = { soilColumns: 0, soilDepths: new Set(), trees: 0, shrubs: 0, grass: 0, riverColumns: 0, lakeColumns: 0, springs: result.warmSprings.length, outdoorWater: 0 };
  const soil = (i: number): boolean => materials.byIndex(map.materialAt(i))?.class === 'soil';
  const minerals = registry.table<{ id: string; hosts: readonly string[] }>('minerals');
  const inSoil = (i: number): boolean => {
    const hosts = minerals.byId(materials.byIndex(map.materialAt(i))?.id ?? '')?.hosts ?? [];
    return hosts.length > 0 && hosts.every((h) => materials.byId(h)?.class === 'soil');
  };
  for (let y = 0; y < map.h; y += 1) {
    for (let x = 0; x < map.w; x += 1) {
      const c = y * map.w + x;
      const flags = result.columns[c] as number;
      if ((flags & COL_RIVER) !== 0) a.riverColumns += 1;
      if ((flags & COL_LAKE) !== 0) a.lakeColumns += 1;
      const top = result.surface[c] as number;
      const i = map.index(x, y, top);
      const kind = map.kindAt(i);
      if (kind === TileKind.Tree) a.trees += 1;
      if (kind === TileKind.Shrub) a.shrubs += 1;
      if (map.hasFlag(i, TileFlag.Grass)) a.grass += 1;
      if ((flags & (COL_RIVER | COL_LAKE)) === 0 && kind === TileKind.Floor && soil(i)) {
        a.soilColumns += 1;
        let depth = 0;
        // A cluster of a mineral that lies only in soil (bog iron in peat) is part of the soil's depth.
        while (top - depth >= 0 && (soil(map.index(x, y, top - depth)) || inSoil(map.index(x, y, top - depth)))) depth += 1;
        a.soilDepths.add(depth);
      }
      for (let z = 0; z < map.d; z += 1) {
        const t = map.index(x, y, z);
        if (map.fluidLevelAt(t) > 0 && map.fluidTypeAt(t) === FluidType.Water && map.hasFlag(t, TileFlag.Outdoor)) a.outdoorWater += 1;
      }
    }
  }
  return a;
}

/** The summary's soil, trees, shrubs, grass and water against what the map has. */
function expectMatch(site: Site, a: Actual): void {
  const s = site.summary;
  const where = `${site.world.seed} region ${site.region.id} (${site.region.biome}; ${site.region.traits.join(', ')})`;
  // Soil: present or not, and every dry soil column exactly as deep as the summary says.
  expect(s.soil === null, `${where}: soil`).toBe(a.soilColumns === 0);
  if (s.soil !== null) expect([...a.soilDepths], `${where}: soil depth`).toEqual([s.soil.depth]);
  expect(s.lacks.includes('soil')).toBe(s.soil === null);
  // Trees and shrubs: none means none; an estimate is near the count.
  expect(s.trees === null, `${where}: trees`).toBe(a.trees === 0);
  if (s.trees !== null) {
    expect(a.trees, `${where}: trees about ${s.trees.estimate}`).toBeGreaterThanOrEqual(Math.floor(s.trees.estimate * 0.5));
    expect(a.trees, `${where}: trees about ${s.trees.estimate}`).toBeLessThanOrEqual(Math.ceil(s.trees.estimate * 1.3));
  }
  expect(s.lacks.includes('trees')).toBe(s.trees === null);
  expect(s.shrubs === null, `${where}: shrubs`).toBe(a.shrubs === 0);
  if (s.shrubs !== null) {
    expect(a.shrubs, `${where}: shrubs about ${s.shrubs.estimate}`).toBeGreaterThanOrEqual(Math.floor(s.shrubs.estimate * 0.5));
    expect(a.shrubs, `${where}: shrubs about ${s.shrubs.estimate}`).toBeLessThanOrEqual(Math.ceil(s.shrubs.estimate * 1.3));
  }
  expect(s.grass, `${where}: grass`).toBe(a.grass > 0);
  // Water: the river, the lake and the springs, and no surface water when the summary says none.
  expect(s.water.river !== null, `${where}: river`).toBe(a.riverColumns > 0);
  expect(s.water.lake, `${where}: lake`).toBe(a.lakeColumns > 0);
  expect(s.water.springs, `${where}: springs`).toBe(a.springs > 0);
  expect(s.lacks.includes('water'), `${where}: no water`).toBe(a.outdoorWater === 0);
}

describe('T-440 site summary: the summary matches the generated local map', () => {
  const kinds: [string, (r: RegionRecord) => boolean][] = [
    ['temperate forest', (r) => r.biome === 'temperate_forest' && r.river === null],
    ['alpine', (r) => r.biome === 'alpine' && !r.traits.includes('glasslands')],
    ['desert', (r) => r.biome === 'desert'],
    ['glasslands', (r) => r.traits.includes('glasslands')],
    ['a river site', (r) => r.river !== null && r.river.inflow.length > 0 && r.river.outflow !== null],
    ['a river that ends in a lake', (r) => r.river !== null && r.river.inflow.length > 0 && r.river.outflow === null],
    ['a river source, which carves its brook from a spring',(r) => r.river !== null && r.river.inflow.length === 0],
    ['gemsprings', (r) => r.traits.includes('gemsprings')],
  ];
  for (const [name, pick] of kinds) {
    it(`${name}`, () => {
      const site = find(pick);
      expectMatch(site, measure(site.spec));
    });
  }

  it('alpine and glasslands lack soil, trees and grass; a forest has all three', () => {
    const alpine = find((r) => r.biome === 'alpine' && !r.traits.includes('glasslands')).summary;
    expect(alpine.soil).toBeNull();
    expect(alpine.ground).toBe('rock');
    expect(alpine.trees).toBeNull();
    expect(alpine.grass).toBe(false);
    expect(alpine.lacks.slice(0, 2)).toEqual(['soil', 'trees']);
    const glass = find((r) => r.traits.includes('glasslands')).summary;
    expect(glass.ground).toBe('obsidian');
    expect(glass.lacks.slice(0, 2)).toEqual(['soil', 'trees']);
    const forest = find((r) => r.biome === 'temperate_forest').summary;
    expect(forest.soil?.depth).toBe(3);
    expect(forest.trees?.species[0]).toBe('oak');
    expect(forest.grass).toBe(true);
  });

  it('the likely ores are mostly placed, and the climate is the weather system\'s', () => {
    const site = find((r) => r.biome === 'temperate_forest');
    const { result } = generateLocalMap(site.spec, registry);
    const placed = site.summary.ores.filter((id) => (result.veins.find((v) => v.mineral === id)?.placed ?? 0) > 0);
    expect(site.summary.ores.length).toBeGreaterThan(0);
    expect(placed.length).toBeGreaterThanOrEqual(Math.ceil(site.summary.ores.length * 0.75));
    for (const id of site.summary.ores) expect(result.veins.find((v) => v.mineral === id)?.expected ?? 0).toBeGreaterThanOrEqual(FIXED_SCALE);
    const c = site.summary.climate;
    expect(c.winterC).toBeLessThan(c.summerC);
    expect(c.meanC).toBe(site.region.tempC);
  });
});

describe('T-440 world map: the region panel shows the summary and flags what is missing', () => {
  let site: Site;
  let screen: WorldMapScreen;
  beforeAll(() => {
    site = find((r) => r.biome === 'alpine' && !r.traits.includes('glasslands') && r.river === null && !r.lake);
    screen = new WorldMapScreen(site.world, { embark: () => {}, back: () => {} }, keymap, strings, new WorldMapCompositor(registry, palette), registry);
    screen.cursor = { x: site.region.id % site.world.size, y: Math.floor(site.region.id / site.world.size) };
  });

  it('an alpine site of bare rock: the three missing essentials in the alert colour, each with its workaround', () => {
    const s = surface(80, 45);
    screen.draw(s);
    const rows = s.lines();
    const panelCol = rows[0]!.indexOf('│') + 2;
    const alertRow = (start: string): number => rows.findIndex((line) => line.slice(panelCol).startsWith(start));
    for (const [start, words] of [
      ['No surface soil', 'Farm in a cavern or on mud'],
      ['No trees', 'wood only from the wagon'],
      ['No water on the surface', 'cavern lake'],
    ] as const) {
      const row = alertRow(start);
      expect(row, start).toBeGreaterThan(0);
      expect(s.cells.get(panelCol, row).fg, start).toEqual(theme.alert);
      expect(screen.regionLines().join(' ').replace(/\s+/g, ' '), start).toContain(words);
    }
    const text = screen.regionLines();
    expect(text).toContain('Soil     none: bare rock');
    expect(text).toContain('Trees    none');
    expect(text).toContain('Water    none on the surface');
    expect(text.some((l) => l.startsWith('Ores     likely '))).toBe(true);
    expect(text.join(' ').replace(/\s+/g, ' ')).toMatch(/Climate (frozen|cold), about -?\d+°C; summer -?\d+°C, winter -?\d+°C/);
    expect(text.some((l) => l.startsWith('Wildlife dangerous: snow leopard'))).toBe(true);
  });

  it('a forest has no warning, and its rows name the soil, the trees and the grass', () => {
    const forest = find((r) => r.biome === 'temperate_forest' && r.river !== null && r.river.inflow.length > 0 && r.river.outflow !== null);
    const other = new WorldMapScreen(forest.world, { embark: () => {}, back: () => {} }, keymap, strings, new WorldMapCompositor(registry, palette), registry);
    other.cursor = { x: forest.region.id % forest.world.size, y: Math.floor(forest.region.id / forest.world.size) };
    const text = other.regionLines();
    expect(text.some((l) => l.startsWith('No '))).toBe(false);
    expect(text.some((l) => /^Soil {5}(loam|clay), (loam|clay), 3 levels deep$/.test(l))).toBe(true);
    expect(text.some((l) => /^Trees {4}about [\d,]+: oak, /.test(l))).toBe(true);
    expect(text.join(' ').replace(/\s+/g, ' ')).toContain('grass to graze');
    expect(text.join(' ')).toMatch(/Water {4}a (brook|river|great river) from the (north|east|south|west)/);
  });

  it('a panel longer than the window scrolls with PageDown and PageUp, and moving the cursor starts it at the top', () => {
    const s = surface(80, 25);
    screen.draw(s);
    expect(s.lines()[21]!.endsWith('▼')).toBe(true);
    expect(screen.key(press('PageDown'))).toBe(true);
    expect(screen.regionScroll).toBeGreaterThan(0);
    screen.draw(s);
    expect(s.lines()[0]!.endsWith('▲')).toBe(true);
    expect(s.lines().join('\n')).toContain('[Enter] Embark here');
    screen.key(press('PageUp'));
    expect(screen.regionScroll).toBe(0);
    screen.key(press('PageDown'));
    screen.key(press('→'));
    expect(screen.regionScroll).toBe(0);
  });
});
