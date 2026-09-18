import { describe, it, expect } from 'vitest';
import { contentRegistry } from '@content/loader';
import { CAVERN_1_Z_MAX, MAGMA_SEA_TOP_Z, SURFACE_Z_MAX, SURFACE_Z_MIN } from '@core/constants';
import { TileKind, type Map3D } from '@core/map3d';
import { RngStream } from '@core/rng';
import { FLAT_TEST_SPEC, regionSpec } from '@app/headless';
import type { LocalMapSpec } from '@systems/embark';
import { generateLocalMap, type LocalMapResult } from '@systems/terrain/generate';
import { COL_LAKE, COL_RIVER, COL_SINK, COL_SOURCE } from '@systems/terrain/generate/common';
import { baseSurfaceZ, median3x3, roundOffset } from '@systems/terrain/generate/height';
import { BASEMENT, layerAt, layerIndexAt, rollStack } from '@systems/terrain/generate/layers';
import { edgePoint, wander } from '@systems/terrain/generate/rivers';
import { isRim } from '@systems/terrain/generate/sea';

const registry = contentRegistry();
const materials = registry.table('materials');

function spec(overrides: Partial<LocalMapSpec>): LocalMapSpec {
  return { ...FLAT_TEST_SPEC, seed: 'gen-test', traits: [], ...overrides };
}

function gen(s: LocalMapSpec): { map: Map3D; result: LocalMapResult } {
  return generateLocalMap(s, registry);
}

/** The Floors of a column above the cavern bands (cavern floors belong to stage 6). */
function floorsIn(map: Map3D, x: number, y: number): number[] {
  const out: number[] = [];
  for (let z = CAVERN_1_Z_MAX + 1; z < map.d; z += 1) if (map.kindAt(map.index(x, y, z)) === TileKind.Floor) out.push(z);
  return out;
}

describe('T-M1-05 local map: stage 1 heightmap', () => {
  it('base surface z follows the elevation formula and the bounds', () => {
    expect(baseSurfaceZ(96)).toBe(SURFACE_Z_MIN);
    expect(baseSurfaceZ(255)).toBe(SURFACE_Z_MAX);
    expect(baseSurfaceZ(158)).toBe(32);
    expect(baseSurfaceZ(10)).toBe(SURFACE_Z_MIN);
  });

  it('D-045: offsets round to the nearer level with ties toward the base', () => {
    expect([roundOffset(-500), roundOffset(500), roundOffset(501), roundOffset(-1501), roundOffset(1499)]).toEqual([0, 0, 1, -2, 1]);
  });

  it('relief 0 is flat at the base; every relief stays within the surface bounds', () => {
    const { result } = gen(spec({ relief: 0, elevation: 158 }));
    expect(result.surface.every((z) => z === 32)).toBe(true);
    for (const relief of [1, 2, 3] as const) {
      for (const elevation of [100, 200, 255]) {
        const { result: r } = gen(spec({ relief, elevation, seed: `relief-${relief}-${elevation}` }));
        let varied = false;
        for (const z of r.surface) {
          expect(z).toBeGreaterThanOrEqual(SURFACE_Z_MIN);
          expect(z).toBeLessThanOrEqual(SURFACE_Z_MAX);
          if (z !== baseSurfaceZ(elevation)) varied = true;
        }
        if (relief >= 2 && elevation === 200) expect(varied).toBe(true);
      }
    }
  });

  it('the median pass removes a lone spike', () => {
    const src = new Int16Array(25).fill(30);
    src[12] = 40;
    expect(median3x3(src, 5, 5)[12]).toBe(30);
  });
});

describe('T-M1-05 local map: stage 2 rivers and lakes', () => {
  it('wander reaches its target without leaving the map', () => {
    const st = new RngStream(5);
    const path = wander(st, { x: 0, y: 48 }, { x: 95, y: 48 }, 96, 96);
    expect(path[0]).toEqual({ x: 0, y: 48 });
    expect(path[path.length - 1]).toEqual({ x: 95, y: 48 });
    for (let k = 1; k < path.length; k += 1) {
      const a = path[k - 1] as { x: number; y: number };
      const b = path[k] as { x: number; y: number };
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
      expect(b.x >= 0 && b.x < 96 && b.y >= 0 && b.y < 96).toBe(true);
    }
  });

  it('the river bed is continuous from inflow to outflow, with sources and sinks marked', () => {
    for (const cls of ['brook', 'river', 'major'] as const) {
      const { map, result } = gen(spec({ seed: `river-${cls}`, river: { inflowEdges: ['w', 'n'], outflowEdge: 'e', class: cls } }));
      const wet = (c: number): boolean => ((result.columns[c] as number) & COL_RIVER) !== 0;
      // Flood the river columns (4-connected) from the sources.
      const seen = new Uint8Array(96 * 96);
      const stack: number[] = [];
      for (let c = 0; c < seen.length; c += 1) {
        if ((result.columns[c] as number) & COL_SOURCE) {
          seen[c] = 1;
          stack.push(c);
        }
      }
      const sourceEdges = new Set<string>();
      for (const c of stack) sourceEdges.add(c % 96 === 0 ? 'w' : Math.floor(c / 96) === 0 ? 'n' : '?');
      expect(sourceEdges).toEqual(new Set(['w', 'n']));
      while (stack.length > 0) {
        const c = stack.pop() as number;
        const x = c % 96;
        const y = Math.floor(c / 96);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= 96 || ny >= 96) continue;
          const n = ny * 96 + nx;
          if (seen[n] === 0 && wet(n)) {
            seen[n] = 1;
            stack.push(n);
          }
        }
      }
      let sinkCols = 0;
      for (let c = 0; c < seen.length; c += 1) {
        if ((result.columns[c] as number) & COL_SINK) {
          sinkCols += 1;
          expect(c % 96).toBe(95);
          expect(seen[c]).toBe(1);
        }
        if (wet(c)) expect(seen[c]).toBe(1);
      }
      expect(sinkCols).toBeGreaterThanOrEqual(cls === 'brook' ? 1 : cls === 'river' ? 3 : 5);
      expect(result.sinks.length).toBeGreaterThan(0);
      expect(result.waterSources.length).toBeGreaterThan(0);
      for (const i of result.waterSources) {
        expect(map.fluidSourceAt(i)).toBe(true);
        expect(map.fluidLevelAt(i)).toBe(7);
      }
      for (const i of result.sinks) expect(map.fluidLevelAt(i)).toBe(7);
      // Every wet column: a stone floor at the bed and water above it to the old ground.
      const depth = cls === 'brook' ? 1 : 2;
      for (let c = 0; c < seen.length; c += 1) {
        if (!wet(c)) continue;
        const x = c % 96;
        const y = Math.floor(c / 96);
        const bed = result.surface[c] as number;
        const floor = map.index(x, y, bed);
        expect(map.kindAt(floor)).toBe(TileKind.Floor);
        expect(registry.table<{ id: string; class: string }>('materials').byIndex(map.materialAt(floor))?.class).toBe('stone');
        let water = 0;
        for (let z = bed; z < map.d; z += 1) if (map.fluidLevelAt(map.index(x, y, z)) > 0) water += 1;
        expect(water).toBe(depth);
      }
    }
  });

  it('a river with no outflow ends in a lake; a lake region carves a lake with no sources', () => {
    const { result } = gen(spec({ seed: 'to-lake', river: { inflowEdges: ['s'], outflowEdge: null, class: 'river' } }));
    expect(result.columns.some((f) => (f & COL_LAKE) !== 0)).toBe(true);
    expect(result.sinks).toHaveLength(0);
    const lake = gen(spec({ seed: 'lake', lake: true }));
    const lakeCols = lake.result.columns.filter((f) => (f & COL_LAKE) !== 0).length;
    expect(lakeCols).toBeGreaterThanOrEqual(Math.floor(Math.PI * 36));
    expect(lakeCols).toBeLessThanOrEqual(Math.ceil(Math.PI * 13 * 13));
    expect(lake.result.waterSources).toHaveLength(0);
    for (let c = 0; c < lake.result.columns.length; c += 1) {
      if (((lake.result.columns[c] as number) & COL_LAKE) === 0) continue;
      const bed = lake.result.surface[c] as number;
      const water = lake.map.fluidLevelAt(lake.map.index(c % 96, Math.floor(c / 96), bed));
      expect(water).toBe(7);
    }
  });

  it('D-045: a region with no inflow edge carves no river', () => {
    const { result } = gen(spec({ seed: 'spring', river: { inflowEdges: [], outflowEdge: 'e', class: 'brook' } }));
    expect(result.columns.every((f) => f === 0)).toBe(true);
    expect(edgePoint(96, 96, 'n')).toEqual({ x: 48, y: 0 });
    expect(edgePoint(96, 96, 'e')).toEqual({ x: 95, y: 48 });
  });
});

describe('T-M1-05 local map: stages 3-4 soil and layers', () => {
  it('the layer stack covers the map and the basement repeats', () => {
    for (const geology of ['sedimentary', 'igneous', 'metamorphic', 'mixed']) {
      const stack = rollStack(registry, geology, new RngStream(geology.length), 48);
      const total = stack.reduce((n, l) => n + l.thickness, 0);
      expect(total).toBeGreaterThanOrEqual(48);
      const template = registry.table<{ id: string; layers: { material: string; min: number; max: number }[] }>('geologyTemplates').byId(geology);
      const n = template?.layers.length as number;
      template?.layers.forEach((l, k) => {
        expect(stack[k]?.material).toBe(l.material);
        expect(stack[k]?.thickness).toBeGreaterThanOrEqual(l.min);
        expect(stack[k]?.thickness).toBeLessThanOrEqual(l.max);
      });
      const tail = stack.slice(n);
      expect(tail.length % 2).toBe(0);
      tail.forEach((l, k) => expect(l.material).toBe(BASEMENT[k % 2]?.material));
    }
    // A shallow template runs out and repeats its basement pair.
    const short = rollStack(registry, 'igneous', new RngStream(1), 120);
    expect(short.filter((l) => l.material === 'gneiss').length).toBeGreaterThanOrEqual(2);
    expect(layerAt([{ material: 'a', thickness: 2 }, { material: 'b', thickness: 3 }], 4)).toBe('b');
    expect(layerIndexAt([{ material: 'a', thickness: 2 }], 99)).toBe(0);
    expect(layerAt([{ material: 'a', thickness: 2 }, { material: 'b', thickness: 3 }], -1)).toBe('a');
  });

  it('columns follow the stack downward with at most one level of undulation', () => {
    const { map, result } = gen(spec({ seed: 'layers', geology: 'sedimentary', relief: 2 }));
    const collapse = (xs: number[]): number[] => xs.filter((v, k) => k === 0 || xs[k - 1] !== v);
    const stack = collapse(result.layerStack.map((l) => materials.index(l.material)));
    for (const [x, y] of [[10, 10], [50, 70], [90, 5]] as const) {
      const top = result.surface[y * 96 + x] as number;
      const column: number[] = [];
      for (let z = top - FLAT_TEST_SPEC.soilDepth; z > MAGMA_SEA_TOP_Z + 1; z -= 1) column.push(map.materialAt(map.index(x, y, z)));
      const seq = collapse(column);
      const start = stack.indexOf(seq[0] as number);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(start).toBeLessThanOrEqual(1);
      expect(seq).toEqual(stack.slice(start, start + seq.length));
    }
  });

  it('soil is the biome soil, serene_vale adds two levels of loam only, glasslands is obsidian over basalt', () => {
    const soils = new Set(['loam', 'clay'].map((m) => materials.index(m)));
    const plain = gen(spec({ seed: 'soil', biome: 'temperate_forest', soilDepth: 3 }));
    for (const z of [32, 31, 30]) expect(soils.has(plain.map.materialAt(plain.map.index(20, 20, z)))).toBe(true);
    expect(materials.byIndex(plain.map.materialAt(plain.map.index(20, 20, 29)))).toMatchObject({ class: 'stone' });

    const vale = gen(spec({ seed: 'vale', biome: 'temperate_forest', soilDepth: 3, traits: ['serene_vale'] }));
    const loam = materials.index('loam');
    for (let z = 32; z > 27; z -= 1) expect(vale.map.materialAt(vale.map.index(20, 20, z))).toBe(loam);
    expect(materials.byIndex(vale.map.materialAt(vale.map.index(20, 20, 27)))).toMatchObject({ class: 'stone' });

    const glass = gen(spec({ seed: 'glass', biome: 'mountain', soilDepth: 1, traits: ['glasslands'], volcano: true }));
    const obsidian = materials.index('obsidian');
    for (let y = 0; y < 96; y += 7) {
      for (let x = 0; x < 96; x += 7) {
        const top = glass.result.surface[y * 96 + x] as number;
        expect(glass.map.materialAt(glass.map.index(x, y, top))).toBe(obsidian);
      }
    }
    expect(glass.result.layerStack[0]?.material).toBe('basalt');
  });

  it('every column has exactly one surface Floor, at its surface z, open sky above', () => {
    const { map, result } = gen(spec({ seed: 'floors', relief: 3, elevation: 200, river: { inflowEdges: ['n'], outflowEdge: 's', class: 'major' } }));
    for (let y = 0; y < 96; y += 1) {
      for (let x = 0; x < 96; x += 1) {
        const floors = floorsIn(map, x, y);
        expect(floors).toEqual([result.surface[y * 96 + x]]);
        const top = floors[0] as number;
        expect(map.columnSurfaceZ(x, y)).toBe(top);
        for (let z = top + 1; z < map.d; z += 1) expect(map.kindAt(map.index(x, y, z))).toBe(TileKind.Open);
      }
    }
  });
});

describe('T-M1-05 local map: stage 5 the Sea of Fire', () => {
  it('rim and pillars are basalt, the rest is open magma with a source; the roof is basalt', () => {
    const { map } = gen(spec({ seed: 'sea' }));
    const basalt = materials.index('basalt');
    let open = 0;
    let pillars = 0;
    for (let y = 0; y < 96; y += 1) {
      for (let x = 0; x < 96; x += 1) {
        const roof = map.index(x, y, MAGMA_SEA_TOP_Z + 1);
        expect([map.kindAt(roof), map.materialAt(roof)]).toEqual([TileKind.Wall, basalt]);
        for (let z = 0; z <= MAGMA_SEA_TOP_Z; z += 1) {
          const i = map.index(x, y, z);
          if (isRim(map, x, y)) {
            expect([map.kindAt(i), map.materialAt(i)]).toEqual([TileKind.Wall, basalt]);
          } else if (map.kindAt(i) === TileKind.Wall) {
            expect(map.materialAt(i)).toBe(basalt);
            if (z === 0) pillars += 1;
          } else {
            expect(map.kindAt(i)).toBe(TileKind.Open);
            expect(map.fluidLevelAt(i)).toBe(7);
            expect(map.fluidSourceAt(i)).toBe(true);
            if (z === 0) open += 1;
          }
        }
      }
    }
    expect(pillars).toBeGreaterThan(0);
    expect(pillars / (pillars + open)).toBeLessThan(0.2);
  });

  it('generation is a pure function of the spec', () => {
    const a = gen(spec({ seed: 'same', relief: 2, river: { inflowEdges: ['w'], outflowEdge: 's', class: 'river' } }));
    const b = gen(spec({ seed: 'same', relief: 2, river: { inflowEdges: ['w'], outflowEdge: 's', class: 'river' } }));
    expect(Buffer.from(a.map.kind).equals(Buffer.from(b.map.kind))).toBe(true);
    expect(Buffer.from(a.map.material.buffer).equals(Buffer.from(b.map.material.buffer))).toBe(true);
    expect(Buffer.from(a.map.fluid).equals(Buffer.from(b.map.fluid))).toBe(true);
  });

  it('the region spec of a scenario is the flat-test region with the given fields', () => {
    const s = regionSpec('scenario', { biome: 'taiga', peril: 3 });
    expect([s.biome, s.peril, s.wealth, s.temper, s.elevation]).toEqual(['taiga', 3, 2, 0, 158]);
    expect(s.soilDepth).toBe(2);
    const { result } = gen(s);
    expect(result.surface.every((z) => z === 32)).toBe(true);
  });
});
