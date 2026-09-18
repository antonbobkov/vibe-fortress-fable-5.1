import { describe, it, expect } from 'vitest';
import { contentRegistry } from '@content/loader';
import { FIXED_SCALE } from '@core/fixed';
import * as C from '@systems/worldgen/constants';
import { generate, newGenWorld, runPhysicalStages } from '@systems/worldgen';
import {
  ELEVATION_ATTEMPTS,
  continentalMask,
  elevationAttempt,
  hasEnoughLand,
  hasMountainCluster,
  normalize255,
  stageElevation,
} from '@systems/worldgen/stages/elevation';
import { applyRainShadow, stageClimate, temperatureOf } from '@systems/worldgen/stages/climate';
import { biomeLookup, stageBiomes } from '@systems/worldgen/stages/biomes';
import { classAt, classRank, traceRiver } from '@systems/worldgen/stages/rivers';
import { geologyOf, stageGeology } from '@systems/worldgen/stages/geology';
import {
  ELEV_BANDS,
  RAIN_BANDS,
  TEMP_BANDS,
  elevBand,
  rainBand,
  tempBand,
} from '@systems/worldgen/stages/common';
import { tuningConstants } from '../system-constants';

const registry = contentRegistry();

describe('T-M1-02 worldgen: tuning constants', () => {
  it('every numeric row of 01 § Tuning constants is in constants.ts with its value', () => {
    const rows = tuningConstants('02-systems/01-world-generation.md');
    expect(rows.length).toBeGreaterThanOrEqual(18);
    const code = C as unknown as Record<string, number>;
    for (const row of rows) expect([row.name, code[row.name]]).toEqual([row.name, row.value]);
  });
});

describe('T-M1-02 worldgen: stage 1 elevation', () => {
  it('the continental mask is 1 at the centre and 0 at the corners', () => {
    expect(continentalMask(32, 32, 64)).toBe(FIXED_SCALE);
    expect(continentalMask(0, 0, 64)).toBe(0);
    expect(continentalMask(63, 63, 64)).toBe(0);
    expect(continentalMask(32, 10, 64)).toBeGreaterThan(0);
    expect(continentalMask(32, 10, 64)).toBeLessThan(FIXED_SCALE);
  });

  it('D-038: the field is normalized to 0 … 255', () => {
    const e = elevationAttempt('0123456789abcdef', 64, 0, continentalMask);
    expect(Math.min(...e)).toBe(0);
    expect(Math.max(...e)).toBe(255);
    expect(normalize255([5, 5, 5])).toEqual([0, 0, 0]);
    expect(normalize255([10, 20, 30])).toEqual([0, 128, 255]);
  });

  it('is a pure function of the seed', () => {
    const a = newGenWorld('elev-seed', 32);
    const b = newGenWorld('elev-seed', 32);
    stageElevation(a);
    stageElevation(b);
    expect(a.regions.map((r) => r.elevation)).toEqual(b.regions.map((r) => r.elevation));
    const c = newGenWorld('elev-seed-2', 32);
    stageElevation(c);
    expect(c.regions.map((r) => r.elevation)).not.toEqual(a.regions.map((r) => r.elevation));
  });

  it('retry logic: a rigged all-sea mask retries 8 times and then accepts', () => {
    const g = newGenWorld('rigged', 32);
    stageElevation(g, () => 0);
    expect(g.elevationAttempts).toBe(ELEVATION_ATTEMPTS);
    expect(g.regions.every((r) => r.elevation === 0)).toBe(true);
  });

  it('retry logic: the attempt count is the first attempt meeting both conditions', () => {
    for (const seed of ['retry-a', 'retry-b', 'retry-c']) {
      const g = newGenWorld(seed, 32);
      stageElevation(g);
      let first = ELEVATION_ATTEMPTS;
      for (let a = 0; a < ELEVATION_ATTEMPTS; a += 1) {
        const e = elevationAttempt(g.s, 32, a, continentalMask);
        if (hasEnoughLand(e, 32) && hasMountainCluster(e, 32)) {
          first = a + 1;
          break;
        }
      }
      expect(g.elevationAttempts).toBe(first);
      const kept = elevationAttempt(g.s, 32, g.elevationAttempts - 1, continentalMask);
      expect(g.regions.map((r) => r.elevation)).toEqual(kept);
    }
  });

  it('the land and cluster tests count what they say', () => {
    const size = 4;
    const flat = new Array(16).fill(C.MOUNTAIN_ELEVATION);
    expect(hasMountainCluster(flat, size)).toBe(true);
    const holes = flat.map((v, i) => (i % 2 === 0 ? 0 : v));
    expect(hasMountainCluster(holes, size)).toBe(false);
    const land = new Array(100).fill(0).map((_, i) => (i < 35 ? C.SEA_LEVEL : 0));
    expect(hasEnoughLand(land, 10)).toBe(true);
    expect(hasEnoughLand(land.map((v, i) => (i === 0 ? 0 : v)), 10)).toBe(false);
  });
});

describe('T-M1-02 worldgen: stage 2 climate', () => {
  it('temperature falls with latitude and elevation', () => {
    expect(temperatureOf(0, 64, 0)).toBe(C.TEMP_SOUTH);
    expect(temperatureOf(32, 64, 96)).toBe(30 - 21);
    expect(temperatureOf(0, 64, 196)).toBe(30 - 22);
    expect(temperatureOf(63, 64, 0)).toBeLessThan(temperatureOf(10, 64, 0));
  });

  it('rain shadow decreases east of a mountain row', () => {
    const g = newGenWorld('shadow', 16);
    for (const r of g.regions) {
      r.elevation = r.x === 4 ? C.MOUNTAIN_ELEVATION : 120;
      r.rain = 200;
    }
    applyRainShadow(g);
    const row = g.regions.filter((r) => r.y === 8).map((r) => r.rain);
    // West of the mountain: untouched.
    expect(row.slice(0, 4)).toEqual([200, 200, 200, 200]);
    // At and east of it the shadow bites and fades by RAIN_SHADOW_DECAY per region.
    expect(row[4]).toBe(200 - C.RAIN_SHADOW_STRENGTH);
    expect(row[5]).toBe(200 - (C.RAIN_SHADOW_STRENGTH - C.RAIN_SHADOW_DECAY));
    for (let x = 5; x < 10; x += 1) expect(row[x] as number).toBeGreaterThan(row[x - 1] as number);
    expect(row[10]).toBe(200);
  });

  it('coastal regions gain COAST_RAIN_BONUS', () => {
    const g = newGenWorld('coast', 8);
    for (const r of g.regions) {
      r.elevation = r.x === 0 ? 10 : 120;
      r.rain = 100;
    }
    applyRainShadow(g);
    expect(g.regions[1]?.rain).toBe(100 + C.COAST_RAIN_BONUS);
    expect(g.regions[3]?.rain).toBe(100);
  });

  it('rain is 0 … 255 for a real world', () => {
    const g = newGenWorld('climate', 32);
    stageElevation(g);
    stageClimate(g);
    for (const r of g.regions) {
      expect(r.rain).toBeGreaterThanOrEqual(0);
      expect(r.rain).toBeLessThanOrEqual(255);
    }
  });
});

describe('T-M1-02 worldgen: stage 3 biomes', () => {
  it('the lookup is exhaustive: every temp × rain × elevation cell maps to a defined biome', () => {
    const lookup = biomeLookup(registry);
    const biomes = registry.table('biomes');
    let cells = 0;
    for (const t of TEMP_BANDS) {
      for (const r of RAIN_BANDS) {
        for (const e of ELEV_BANDS) {
          const b = lookup(t, r, e);
          expect(biomes.has(b), `${t} × ${r} × ${e} -> ${b}`).toBe(true);
          cells += 1;
        }
      }
    }
    expect(cells).toBe(5 * 4 * 4);
  });

  it('applies the elevation overrides', () => {
    const lookup = biomeLookup(registry);
    expect(lookup('hot', 'wet', 'ocean')).toBe('ocean');
    expect(lookup('temperate', 'dry', 'mountain')).toBe('mountain');
    expect(lookup('cold', 'dry', 'mountain')).toBe('alpine');
    expect(lookup('frozen', 'wet', 'mountain')).toBe('alpine');
    expect(lookup('temperate', 'dry', 'hills')).toBe('temperate_hills');
    expect(lookup('warm', 'moderate', 'hills')).toBe('temperate_hills');
    expect(lookup('temperate', 'wet', 'hills')).toBe('wetland');
    expect(lookup('hot', 'dry', 'lowland')).toBe('badlands');
    expect(lookup('frozen', 'arid', 'lowland')).toBe('glacier');
  });

  it('the band helpers match the documented edges', () => {
    expect([tempBand(-6), tempBand(-5), tempBand(5), tempBand(18), tempBand(26)]).toEqual([
      'frozen',
      'cold',
      'temperate',
      'warm',
      'hot',
    ]);
    expect([rainBand(59), rainBand(60), rainBand(110), rainBand(170)]).toEqual(['arid', 'dry', 'moderate', 'wet']);
    expect([elevBand(95), elevBand(96), elevBand(130), elevBand(165)]).toEqual(['ocean', 'lowland', 'hills', 'mountain']);
  });

  it('never produces dark_forest (painted by the civilization stage)', () => {
    const g = newGenWorld('biomes', 32);
    stageElevation(g);
    stageClimate(g);
    stageBiomes(g, registry);
    expect(g.regions.some((r) => r.biome === 'dark_forest')).toBe(false);
    expect(g.regions.filter((r) => r.elevation < C.SEA_LEVEL).every((r) => r.biome === 'ocean')).toBe(true);
  });
});

describe('T-M1-02 worldgen: stage 4 rivers', () => {
  function slope(size: number): ReturnType<typeof newGenWorld> {
    const g = newGenWorld('rivers', size);
    // A ramp falling to the east, sea in the last column.
    for (const r of g.regions) r.elevation = r.x === size - 1 ? 50 : 250 - r.x * 8;
    return g;
  }

  it('follows the lowest neighbour to the sea and classes the path', () => {
    const g = slope(20);
    const src = g.regions[5 * 20 + 0];
    if (src === undefined) throw new Error('no source');
    traceRiver(g, src);
    const river = g.rivers[0];
    expect(river?.regions).toHaveLength(20);
    expect(river?.regions[0]).toBe(src.id);
    const last = g.regions[river?.regions[19] as number];
    expect(last?.elevation).toBeLessThan(C.SEA_LEVEL);
    expect(src.river?.outflow).toBe('e');
    expect(g.regions[5 * 20 + 1]?.river?.inflow).toEqual(['w']);
    const classes = (river?.regions ?? []).map((id) => g.regions[id]?.river?.class);
    expect(classes.slice(0, 3)).toEqual(['brook', 'brook', 'brook']);
    expect(classes[3]).toBe('river');
    expect(classes[12]).toBe('major');
    expect([classAt(0), classAt(C.BROOK_LENGTH), classAt(C.MAJOR_LENGTH)]).toEqual(['brook', 'river', 'major']);
  });

  it('ends in a lake at a local minimum', () => {
    const g = newGenWorld('lake', 8);
    for (const r of g.regions) r.elevation = 200 - Math.max(0, 6 - Math.abs(r.x - 4) - Math.abs(r.y - 4)) * 10;
    // The minimum is at (4, 4) with elevation 140: a lake, not the sea.
    const src = g.regions[4 * 8 + 1] as (typeof g.regions)[number];
    traceRiver(g, src);
    const path = g.rivers[0]?.regions ?? [];
    const end = g.regions[path[path.length - 1] as number];
    expect(end?.id).toBe(4 * 8 + 4);
    expect(end?.lake).toBe(true);
    expect(end?.river?.outflow).toBeNull();
  });

  it('a confluence makes the joined region and everything downstream major', () => {
    // A valley along row 5 falling east to the sea; the slopes fall toward it.
    const g = newGenWorld('confluence', 20);
    for (const r of g.regions) r.elevation = r.x === 19 ? 50 : 200 - 2 * r.x + 20 * Math.abs(r.y - 5);
    traceRiver(g, g.regions[5 * 20] as (typeof g.regions)[number]);
    traceRiver(g, g.regions[1 * 20 + 6] as (typeof g.regions)[number]);
    const second = g.rivers[1]?.regions ?? [];
    expect(second).toEqual([26, 46, 66, 86, 106]);
    const first = g.rivers[0]?.regions ?? [];
    const k = first.indexOf(106);
    expect(k).toBe(6);
    for (let i = k; i < first.length; i += 1) expect(g.regions[first[i] as number]?.river?.class).toBe('major');
    expect(g.regions[first[5] as number]?.river?.class).toBe('river');
    expect(g.regions[106]?.river?.inflow).toEqual(['w', 'n']);
    for (const path of [first, second]) {
      for (let i = 1; i < path.length; i += 1) {
        const prev = g.regions[path[i - 1] as number]?.river?.class ?? 'brook';
        const cur = g.regions[path[i] as number]?.river?.class ?? 'brook';
        expect(classRank(cur)).toBeGreaterThanOrEqual(classRank(prev));
      }
    }
  });

  it('D-039: a source already on a river starts no new river', () => {
    const g = slope(20);
    traceRiver(g, g.regions[5 * 20] as (typeof g.regions)[number]);
    traceRiver(g, g.regions[5 * 20 + 3] as (typeof g.regions)[number]);
    expect(g.rivers).toHaveLength(1);
  });
});

describe('T-M1-02 worldgen: stage 5 geology', () => {
  it('buckets the biased noise into the four classes', () => {
    expect([geologyOf(0), geologyOf(101), geologyOf(102), geologyOf(165), geologyOf(166), geologyOf(216), geologyOf(217)]).toEqual([
      'sedimentary',
      'sedimentary',
      'igneous',
      'igneous',
      'metamorphic',
      'metamorphic',
      'mixed',
    ]);
  });

  it('volcanoes only on mountain or alpine, always igneous; deepness 0 … 255', () => {
    let volcanoes = 0;
    for (const seed of ['geo-1', 'geo-2', 'geo-3']) {
      const g = newGenWorld(seed, 64);
      stageElevation(g);
      stageClimate(g);
      stageBiomes(g, registry);
      stageGeology(g);
      for (const r of g.regions) {
        if (r.volcano) {
          volcanoes += 1;
          expect(['mountain', 'alpine']).toContain(r.biome);
          expect(r.geology).toBe('igneous');
        }
        expect(r.deepness).toBeGreaterThanOrEqual(0);
        expect(r.deepness).toBeLessThanOrEqual(255);
      }
      const lowland = g.regions.filter((r) => r.elevation >= C.SEA_LEVEL && r.elevation < C.HILLS_ELEVATION);
      const sed = lowland.filter((r) => r.geology === 'sedimentary').length;
      expect(sed / lowland.length).toBeGreaterThan(0.4);
    }
    expect(volcanoes).toBeGreaterThan(0);
  });
});

describe('T-M1-02 worldgen: stages 1-5 together', () => {
  it('generate is deterministic and reports progress per stage', () => {
    const seen: string[] = [];
    const a = generate('stages', 32, registry, { onProgress: (stage) => seen.push(stage) });
    const b = generate('stages', 32, registry);
    expect(a).toEqual(b);
    expect(seen.slice(0, 5)).toEqual(['elevation', 'climate', 'biomes', 'rivers', 'geology']);
    const g = newGenWorld('stages', 32);
    runPhysicalStages(g, registry);
    expect(g.regions.map((r) => r.rain)).toEqual(a.regions.map((r) => r.rain));
  });
});
