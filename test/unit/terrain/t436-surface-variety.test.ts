/**
 * T-436: the surface reads as a landscape (`03-terrain-and-mining.md` § Local map generation
 * stages 1, 3 and 9; `23-rendering.md` § Compositor step 2; `regions-biomes-and-traits.md`
 * § Biome surface). Relief and slopes at every relief, outcrops of bare rock, crags and scree,
 * boulders by biome, snow on alpine ground, and on screen grass, flower, rock and plant variety and
 * higher ground drawn as the ground it is. Resources keep their kind.
 */

import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { regionSpec } from '@app/headless';
import { TileFlag, TileKind, type Map3D } from '@core/map3d';
import { findWagonSite } from '@systems/embark/arrival';
import type { LocalMapSpec } from '@systems/embark';
import { generateLocalMap, type LocalMapResult } from '@systems/terrain/generate';
import { COL_LAKE, COL_RIVER } from '@systems/terrain/generate/common';
import { baseSurfaceZ } from '@systems/terrain/generate/height';
import type { WeatherReader } from '@systems/weather/reader';
import { GLYPH_FLOWER, GLYPH_GRASS, GLYPH_GRASS_SHORT, GLYPH_GRASS_TUFT, GLYPH_ROUGH_WALL } from '@render/glyphs';
import { TestWorld } from '../../scenarios/test-world';
import { compose } from '../../golden/render/render-fixtures';

const registry = contentRegistry();
const materials = registry.table<{ id: string; class: string }>('materials');
const BIOMES = ['temperate_forest', 'temperate_grassland', 'temperate_hills', 'mountain', 'alpine', 'desert'] as const;

/** A region of the biome with no trait (peril 2 keeps regionSpec from adding serene_vale). */
function spec(biome: string, relief: 0 | 1 | 2 | 3, seed = `t436-${biome}`): LocalMapSpec {
  return { ...regionSpec(seed, { biome, peril: 2, traits: [] }, registry), relief };
}

interface Survey {
  levels: Set<number>;
  ramps: number;
  boulders: number;
  snow: number;
  rockTops: number;
  soilTops: number;
  trees: number;
}

function surveyOf(s: LocalMapSpec): Survey {
  const { map, result } = generateLocalMap(s, registry);
  return survey(map, result);
}

function survey(map: Map3D, result: LocalMapResult): Survey {
  const s: Survey = { levels: new Set(), ramps: 0, boulders: 0, snow: 0, rockTops: 0, soilTops: 0, trees: 0 };
  for (let y = 0; y < map.h; y += 1) {
    for (let x = 0; x < map.w; x += 1) {
      const c = y * map.w + x;
      if (((result.columns[c] as number) & (COL_RIVER | COL_LAKE)) !== 0) continue;
      const z = result.surface[c] as number;
      s.levels.add(z);
      const i = map.index(x, y, z);
      const kind = map.kindAt(i);
      if (kind === TileKind.Ramp) s.ramps += 1;
      if (kind === TileKind.Boulder) s.boulders += 1;
      if (kind === TileKind.Tree) s.trees += 1;
      if (map.hasFlag(i, TileFlag.Snow)) s.snow += 1;
      const cls = materials.byIndex(map.materialAt(i))?.class;
      if (kind === TileKind.Floor && cls === 'stone') s.rockTops += 1;
      if (kind === TileKind.Floor && cls === 'soil') s.soilTops += 1;
    }
  }
  return s;
}

describe('T-436 relief, slopes and cover on the local map', () => {
  it('every site has relief and slopes, more with the relief; every one-level step is a ramp', () => {
    for (const biome of ['temperate_grassland', 'mountain'] as const) {
      let lastRamps = -1;
      for (const relief of [1, 2, 3] as const) {
        const { map, result } = generateLocalMap(spec(biome, relief), registry);
        const s = survey(map, result);
        expect(s.levels.size, `${biome} relief ${relief}`).toBeGreaterThanOrEqual(3);
        expect(s.ramps, `${biome} relief ${relief}`).toBeGreaterThan(200);
        if (relief >= 2) expect(s.ramps).toBeGreaterThan(lastRamps);
        lastRamps = s.ramps;
        // A dry surface floor never stands one level below a cardinal neighbour's dry floor: that is a ramp.
        for (let y = 1; y < map.h - 1; y += 1) {
          for (let x = 1; x < map.w - 1; x += 1) {
            const c = y * map.w + x;
            const z = result.surface[c] as number;
            const i = map.index(x, y, z);
            if (map.kindAt(i) !== TileKind.Floor || map.fluidLevelAt(i) > 0) continue;
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
              const up = map.index(x + dx, y + dy, z + 1);
              const side = map.index(x + dx, y + dy, z);
              const climbable = map.kindAt(side) === TileKind.Wall && map.kindAt(up) === TileKind.Floor && map.fluidLevelAt(up) === 0;
              expect(climbable, `${biome} relief ${relief} (${x}, ${y}, ${z})`).toBe(false);
            }
          }
        }
      }
    }
  });

  it('relief 0 is nearly level: a few rises and dips of one level, away from the arrival edge and the water', () => {
    for (const [biome, river] of [['mountain', null], ['temperate_forest', { inflow: ['n' as const], outflow: 's' as const, class: 'brook' as const }]] as const) {
      const s = { ...regionSpec(`t436-level-${biome}`, { biome, peril: 2, traits: [], ...(river === null ? {} : { river }) }, registry), relief: 0 as const };
      const { map, result } = generateLocalMap(s, registry);
      const base = baseSurfaceZ(s.elevation);
      const level = survey(map, result);
      expect(level.levels.size, biome).toBeGreaterThanOrEqual(2);
      for (const z of level.levels) expect([base - 1, base, base + 1], biome).toContain(z);
      expect(level.ramps, biome).toBeGreaterThan(0);
      expect(level.rockTops, biome).toBe(0);
      expect(level.boulders, biome).toBe(0);
      for (let y = 0; y < map.h; y += 1) {
        for (let x = 0; x < map.w; x += 1) {
          const c = y * map.w + x;
          if (((result.columns[c] as number) & (COL_RIVER | COL_LAKE)) !== 0) continue;
          const z = result.surface[c] as number;
          // The arrival edge stays level for 48 tiles in.
          const inward = s.arrivalEdge === 'n' ? y : s.arrivalEdge === 's' ? map.h - 1 - y : s.arrivalEdge === 'w' ? x : map.w - 1 - x;
          if (inward < 48) expect(z, `${biome} (${x}, ${y})`).toBe(base);
          let wetNear = false;
          for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
            const xx = x + dx; const yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < map.w && yy < map.h && ((result.columns[yy * map.w + xx] as number) & (COL_RIVER | COL_LAKE)) !== 0) wetNear = true;
          }
          if (wetNear) expect(z, `${biome} by the brook (${x}, ${y})`).toBe(base);
        }
      }
    }
  });

  it('outcrops are bare rock; mountains and alpine have more boulders and crags; alpine lies under snow', () => {
    const forest = surveyOf(spec('temperate_forest', 1));
    const mountain = surveyOf(spec('mountain', 1));
    const alpine = surveyOf(spec('alpine', 1));
    expect(forest.rockTops).toBeGreaterThan(0);
    expect(forest.soilTops).toBeGreaterThan(forest.rockTops * 10);
    expect(mountain.boulders).toBeGreaterThan(forest.boulders * 2);
    expect(alpine.boulders).toBeGreaterThan(forest.boulders * 2);
    // Crags: mountain ground stands at least three levels above the base somewhere.
    const m = spec('mountain', 1);
    const { result } = generateLocalMap(m, registry);
    expect(Math.max(...result.surface) - baseSurfaceZ(m.elevation)).toBeGreaterThanOrEqual(3);
    expect(alpine.snow).toBeGreaterThan(9216 * 0.3);
    expect(forest.snow).toBe(0);
  });

  it('resources keep their kind: alpine stays soil-poor and treeless, a forest keeps its trees', () => {
    const alpine = surveyOf(spec('alpine', 2));
    expect(alpine.soilTops).toBe(0);
    expect(alpine.trees).toBe(0);
    const forest = surveyOf(spec('temperate_forest', 2));
    expect(forest.trees).toBeGreaterThan(9216 * 0.22 * 0.6);
  });

  it('every biome at every relief still has a wagon site near its arrival edge', () => {
    for (const biome of BIOMES) {
      for (const relief of [0, 1, 2, 3] as const) {
        for (const seed of ['a', 'b']) {
          const s = spec(biome, relief, `t436-wagon-${biome}-${seed}`);
          const { map } = generateLocalMap(s, registry);
          expect(findWagonSite(map, s.arrivalEdge), `${biome} relief ${relief} ${seed}`).not.toBeNull();
        }
      }
    }
  });

  it('snow from generation is snow cover: 06 counts its chunks and melts it', () => {
    const w = new TestWorld({ seed: 't436-snow', world: 'local', spec: spec('alpine', 1), embark: 'none' });
    w.step(1);
    expect(w.readers.of<WeatherReader>('06').snowCoveredChunks().length).toBeGreaterThan(0);
  });
});

describe('T-436 the surface on screen', () => {
  const view = (z: number) => ({ camX: 20, camY: 20, z, sidebarOpen: false, cursor: null });

  it('grass varies in glyph and colour, with flowers; the same tile draws the same each frame', () => {
    const s = spec('temperate_grassland', 1, 't436-meadow');
    const w = new TestWorld({ seed: 't436-meadow', world: 'local', spec: s, embark: 'none' });
    w.step(1);
    const z = w.map.columnSurfaceZ(40, 40);
    const a = compose(w.readers, view(z), 60, 40);
    const b = compose(w.readers, view(z), 60, 40);
    const glyphs = new Set<number>();
    const greens = new Set<number>();
    let flowers = 0;
    for (let row = 0; row < 30; row += 1) {
      for (let col = 0; col < 60; col += 1) {
        const cell = a.get(col, row);
        expect(cell).toEqual(b.get(col, row));
        if (cell.glyph === GLYPH_GRASS || cell.glyph === GLYPH_GRASS_SHORT || cell.glyph === GLYPH_GRASS_TUFT) {
          glyphs.add(cell.glyph);
          greens.add(cell.fg);
        }
        if (cell.glyph === GLYPH_FLOWER) flowers += 1;
      }
    }
    expect(glyphs.size).toBe(3);
    expect(greens.size).toBeGreaterThanOrEqual(3);
    expect(flowers).toBeGreaterThan(0);
  });

  it('higher ground draws as the ground above it on a tinted background; it does not show where the level has no sky', () => {
    const s = spec('temperate_grassland', 2, 't436-hills');
    const w = new TestWorld({ seed: 't436-hills', world: 'local', spec: s, embark: 'none' });
    w.step(1);
    const map = w.map;
    // A wall at the view level with an outdoor surface tile right above it, in view.
    const z = baseSurfaceZ(s.elevation);
    let hill: { col: number; row: number } | null = null;
    for (let row = 0; row < 30 && hill === null; row += 1) {
      for (let col = 0; col < 60 && hill === null; col += 1) {
        const i = map.index(20 + col, 20 + row, z);
        const above = map.index(20 + col, 20 + row, z + 1);
        if (map.kindAt(i) === TileKind.Wall && map.kindAt(above) === TileKind.Floor && map.hasFlag(above, TileFlag.Outdoor)) hill = { col, row };
      }
    }
    expect(hill).not.toBeNull();
    const cells = compose(w.readers, view(z), 60, 40);
    const cell = cells.get(hill!.col, hill!.row);
    expect(cell.glyph).not.toBe(GLYPH_ROUGH_WALL);
    expect(cell.bg).not.toBe(0);
    // Six levels down there is no sky in view: nothing of the ground above shows there.
    const deep = compose(w.readers, view(z - 6), 60, 40);
    let leaked = 0;
    for (let row = 0; row < 30; row += 1) {
      for (let col = 0; col < 60; col += 1) {
        const g = deep.get(col, row).glyph;
        if (g === GLYPH_GRASS || g === GLYPH_GRASS_SHORT || g === GLYPH_GRASS_TUFT || g === GLYPH_FLOWER) leaked += 1;
      }
    }
    expect(leaked).toBe(0);
  });
});
