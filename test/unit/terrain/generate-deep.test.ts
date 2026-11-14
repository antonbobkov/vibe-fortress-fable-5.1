import { describe, it, expect } from 'vitest';
import { contentRegistry } from '@content/loader';
import { CAVERN_3_Z_MIN, DEEPSILVER_Z_MAX } from '@core/constants';
import { FIXED_SCALE } from '@core/fixed';
import { FluidType, TileFlag, TileKind, type Map3D } from '@core/map3d';
import { buildFlatTestMap, FLAT_TEST_SPEC, FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { LocalMapSpec } from '@systems/embark';
import { generateLocalMap, type LocalStage } from '@systems/terrain/generate';
import { cavernBand, cavernOpenTarget } from '@systems/terrain/generate/caverns';
import { nearMagma } from '@systems/terrain/generate/minerals';
import { isRim } from '@systems/terrain/generate/sea';
import { stageLight } from '@systems/terrain/generate/light';
import {
  BATTLEFIELD_BAND_MAX,
  BATTLEFIELD_BAND_MIN,
  BATTLEFIELD_BONE_PILES,
  BATTLEFIELD_ITEM_COUNT,
  BATTLEFIELD_SKULLS,
  HALL_FURNITURE_COUNT,
  VAULT_TREASURE,
  WYRM_CHAMBER_SIZE,
} from '@systems/terrain/constants';
import { tuningConstants } from '../system-constants';
import * as T from '@systems/terrain/constants';

const registry = contentRegistry();
const materials = registry.table<{ id: string; class: string }>('materials');

function spec(overrides: Partial<LocalMapSpec>): LocalMapSpec {
  return { ...FLAT_TEST_SPEC, seed: 'deep-test', traits: [], ...overrides };
}

function gen(s: LocalMapSpec, until?: LocalStage): ReturnType<typeof generateLocalMap> {
  return generateLocalMap(s, registry, until === undefined ? {} : { until });
}

describe('T-M1-06 terrain: tuning constants', () => {
  it('every numeric row of 03 § Tuning constants is in constants.ts with its value', () => {
    const rows = tuningConstants('02-systems/03-terrain-and-mining.md');
    expect(rows.length).toBeGreaterThanOrEqual(13);
    const code = T as unknown as Record<string, number>;
    for (const row of rows) expect([row.name, code[row.name]]).toEqual([row.name, row.value]);
  });
});

describe('T-M1-06 local map: stage 6 caverns', () => {
  it('D-047: the open fraction of each band is within ±0.05 of its target, by deepness and trait', () => {
    const cases: [number, string[]][] = [[0, []], [128, []], [255, []], [100, ['fungal_depths']], [130, ['deep_well']]];
    for (const [deepness, traits] of cases) {
      const { map, result } = gen(spec({ seed: `cavern-${deepness}`, deepness, traits }), 'caverns');
      for (let tier = 1; tier <= 3; tier += 1) {
        const target = cavernOpenTarget(deepness, tier, traits) / FIXED_SCALE;
        const [lo, hi] = cavernBand(tier);
        let open = 0;
        let all = 0;
        for (let z = lo; z <= hi; z += 1) {
          for (let y = 0; y < map.h; y += 1) {
            for (let x = 0; x < map.w; x += 1) {
              if (isRim(map, x, y)) continue;
              all += 1;
              // A floor made from the wall below an open tile does not change what was opened.
              if (map.kindAt(map.index(x, y, z)) === TileKind.Open) open += 1;
            }
          }
        }
        expect(Math.abs((result.cavernOpen[tier] as number) / FIXED_SCALE - target)).toBeLessThanOrEqual(0.05);
        expect(Math.abs(open / all - target)).toBeLessThanOrEqual(0.05);
      }
    }
    expect(cavernOpenTarget(0, 2, [])).toBe(250);
    expect(cavernOpenTarget(255, 2, [])).toBe(550);
    expect(cavernOpenTarget(255, 1, ['fungal_depths'])).toBe(700);
    expect(cavernOpenTarget(0, 1, ['deep_well'])).toBe(700);
  });

  it('cavern floors get cave_loam at about 60%, with grass', () => {
    const { map, result } = gen(spec({ seed: 'loam', deepness: 200 }), 'caverns');
    const loam = materials.index('cave_loam');
    let floors = 0;
    let loamy = 0;
    for (let tier = 1; tier <= 3; tier += 1) {
      for (const i of result.cavernFloors[tier] ?? []) {
        floors += 1;
        if (map.materialAt(i) === loam) {
          loamy += 1;
          expect(map.hasFlag(i, TileFlag.Grass)).toBe(true);
        }
      }
    }
    expect(floors).toBeGreaterThan(1000);
    expect(Math.abs(loamy / floors - 0.6)).toBeLessThan(0.03);
  });

  it('caverns hold lakes, and caverns two and three magma pools without sources', () => {
    let water = 0;
    let magma = 0;
    for (const seed of ['pools-1', 'pools-2']) {
      const { map } = gen(spec({ seed, deepness: 255 }), 'caverns');
      for (let tier = 1; tier <= 3; tier += 1) {
        const [lo, hi] = cavernBand(tier);
        for (let z = lo - 1; z <= hi; z += 1) {
          for (let c = 0; c < map.w * map.h; c += 1) {
            const i = z * map.w * map.h + c;
            if (map.fluidLevelAt(i) === 0) continue;
            if (map.fluidTypeAt(i) === FluidType.Magma) {
              magma += 1;
              expect(tier).toBeGreaterThanOrEqual(2);
              expect(map.fluidSourceAt(i)).toBe(false);
            } else {
              water += 1;
            }
          }
        }
      }
    }
    expect(water).toBeGreaterThan(0);
    expect(magma).toBeGreaterThan(0);
  });
});

describe('T-M1-06 local map: stage 7 minerals', () => {
  it('vein counts over 30 seeds are within ±30% of the expectation for each wealth', () => {
    const byWealth = new Map<number, { expected: number; placed: number }>();
    for (let k = 0; k < 30; k += 1) {
      const wealth = k % 5;
      const geology = ['sedimentary', 'igneous', 'metamorphic', 'mixed'][k % 4] as string;
      const { result } = gen(spec({ seed: `veins-${k}`, wealth, geology }), 'minerals');
      const inStack = new Set(result.layerStack.map((l) => l.material));
      const minerals = registry.table<{ id: string; hosts: string[] }>('minerals');
      const gems = registry.table<{ id: string; hosts: string[]; cavernOnly?: boolean }>('gems');
      const acc = byWealth.get(wealth) ?? { expected: 0, placed: 0 };
      for (const v of result.veins) {
        const row = minerals.byId(v.mineral) ?? gems.byId(v.mineral);
        const hosts = row?.hosts ?? [];
        if (v.mineral === 'deepsilver_ore' || hosts.length === 0 || !hosts.some((h) => inStack.has(h))) continue;
        acc.expected += v.expected / FIXED_SCALE;
        acc.placed += v.placed;
      }
      byWealth.set(wealth, acc);
    }
    for (let wealth = 0; wealth <= 4; wealth += 1) {
      const acc = byWealth.get(wealth) as { expected: number; placed: number };
      expect(acc.expected).toBeGreaterThan(0);
      expect(Math.abs(acc.placed - acc.expected) / acc.expected, `wealth ${wealth}`).toBeLessThanOrEqual(0.3);
    }
  });

  it('deepsilver only at z ≤ DEEPSILVER_Z_MAX within 2 of magma, and only at wealth ≥ 2', () => {
    const ore = materials.index('deepsilver_ore');
    for (let wealth = 0; wealth <= 4; wealth += 1) {
      for (const seed of ['ds-a', 'ds-b']) {
        const { map } = gen(spec({ seed: `${seed}-${wealth}`, wealth, deepness: 255 }), 'minerals');
        const near = nearMagma(map, 2, DEEPSILVER_Z_MAX);
        let count = 0;
        for (let i = 0; i < map.tileCount; i += 1) {
          if (map.materialAt(i) !== ore) continue;
          count += 1;
          expect(map.zOf(i)).toBeLessThanOrEqual(DEEPSILVER_Z_MAX);
          expect(near[i]).toBe(1);
        }
        if (wealth < 2) expect(count).toBe(0);
        else expect(count).toBeGreaterThan(0);
      }
    }
  });

  it('ironheart sets hematite and magnetite; diamonds stay at z ≤ 10', () => {
    const { result } = gen(spec({ seed: 'iron', wealth: 0, traits: ['ironheart'] }), 'minerals');
    expect(result.veins.find((v) => v.mineral === 'hematite')?.expected).toBe(12 * FIXED_SCALE);
    expect(result.veins.find((v) => v.mineral === 'magnetite')?.expected).toBe(6 * FIXED_SCALE);
    const diamond = materials.index('diamond');
    for (const seed of ['dia-1', 'dia-2', 'dia-3']) {
      const { map } = gen(spec({ seed, wealth: 4, geology: 'igneous' }), 'minerals');
      for (let i = 0; i < map.tileCount; i += 1) if (map.materialAt(i) === diamond) expect(map.zOf(i)).toBeLessThanOrEqual(10);
    }
  });
});

describe('T-M1-06 local map: stages 8-10', () => {
  it('the volcano pipe reaches the surface, ringed by obsidian', () => {
    for (const traits of [[], ['glasslands']]) {
      const { map, result } = gen(spec({ seed: `volcano-${traits.length}`, volcano: true, traits, biome: 'mountain' }));
      expect(result.volcano).toBeGreaterThanOrEqual(0);
      const x = result.volcano % map.w;
      const y = Math.floor(result.volcano / map.w);
      const top = result.surface[result.volcano] as number;
      for (let z = 0; z <= top; z += 1) {
        const i = map.index(x, y, z);
        expect(map.kindAt(i)).toBe(TileKind.Open);
        expect(map.fluidTypeAt(i)).toBe(FluidType.Magma);
        expect(map.fluidLevelAt(i)).toBe(7);
      }
      const r = traits.length > 0 ? 3 : 2;
      const ring = map.index(x + r + 1, y, top - 1);
      expect(materials.byIndex(map.materialAt(ring))?.id).toBe('obsidian');
    }
  });

  it('sunken_halls: the hall template is carved, the vault is sealed, the spawn list is recorded', () => {
    const { map, result } = gen(spec({ seed: 'halls', biome: 'temperate_hills', traits: ['sunken_halls'], relief: 1 }));
    const stairs = [];
    for (let i = 0; i < map.tileCount; i += 1) {
      const k = map.kindAt(i);
      if (k === TileKind.StairsDown || k === TileKind.StairsUp || k === TileKind.StairsUpDown) stairs.push(i);
    }
    expect(stairs).toHaveLength(6);
    const stalker = result.spawns.find((s) => s.type === 'blind_stalker');
    if (stalker === undefined) throw new Error('no stalker');
    expect(stalker.asleep).toBe(true);
    const vz = map.zOf(stalker.tile);
    const vx = map.xOf(stalker.tile);
    const vy = map.yOf(stalker.tile) - 1;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dy = -3; dy <= 3; dy += 1) {
        for (let dx = -3; dx <= 3; dx += 1) {
          const k = map.kindAt(map.index(vx + dx, vy + dy, vz + dz));
          const inside = dz === 0 && Math.abs(dx) <= 2 && Math.abs(dy) <= 2;
          expect(k).toBe(inside ? TileKind.Floor : TileKind.Wall);
        }
      }
    }
    const hall = result.spawns.filter((s) => s.source === 'sunken_halls' && s.kind === 'item');
    expect(hall.filter((s) => s.material === 'deepsilver')).toHaveLength(VAULT_TREASURE);
    expect(hall.filter((s) => s.material !== 'deepsilver')).toHaveLength(HALL_FURNITURE_COUNT);
    for (const s of hall) expect(map.kindAt(s.tile)).toBe(TileKind.Floor);
  });

  it('old_battlefield, gemsprings and wyrm_roost leave their features and spawn lists', () => {
    const { map, result } = gen(
      spec({
        seed: 'traits',
        wealth: 3,
        traits: ['old_battlefield', 'gemsprings', 'wyrm_roost'],
        river: { inflowEdges: ['w'], outflowEdge: 'e', class: 'river' },
      }),
    );
    // This map also holds the old channel of 03 stage 10 (one wand): the arms are counted without it.
    const field = result.spawns.filter((s) => s.source === 'old_battlefield' && s.type !== 'wand');
    expect(field).toHaveLength(BATTLEFIELD_ITEM_COUNT + BATTLEFIELD_BONE_PILES + BATTLEFIELD_SKULLS);
    expect(field.filter((s) => s.type === 'skull')).toHaveLength(BATTLEFIELD_SKULLS);
    for (const s of field) {
      const d = map.yOf(s.tile); // arrival edge n
      expect(d).toBeGreaterThanOrEqual(BATTLEFIELD_BAND_MIN);
      expect(d).toBeLessThanOrEqual(BATTLEFIELD_BAND_MAX);
    }
    expect(field.filter((s) => s.quality === 0)).toHaveLength(BATTLEFIELD_ITEM_COUNT);
    expect(result.warmSprings).toHaveLength(12);
    for (const i of result.warmSprings) {
      expect(map.kindAt(i)).toBe(TileKind.Open);
      expect(map.fluidLevelAt(i)).toBe(7);
      expect(map.fluidTypeAt(i)).toBe(FluidType.Water);
    }
    const wyrm = result.spawns.find((s) => s.type === 'magma_wyrm');
    if (wyrm === undefined) throw new Error('no wyrm');
    expect(map.zOf(wyrm.tile)).toBe(CAVERN_3_Z_MIN);
    const half = Math.floor(WYRM_CHAMBER_SIZE / 2);
    for (let dy = -half; dy <= half; dy += 1) {
      for (let dx = -half; dx <= half; dx += 1) {
        expect(map.kindAt(map.index(map.xOf(wyrm.tile) + dx, map.yOf(wyrm.tile) + dy, CAVERN_3_Z_MIN))).toBe(TileKind.Floor);
      }
    }
  });

  it('vegetation: trees and shrubs on surface soil by the biome, none on river beds', () => {
    const { map, result } = gen(spec({ seed: 'trees', biome: 'temperate_forest', river: { inflowEdges: ['n'], outflowEdge: 's', class: 'river' } }));
    const trees: string[] = [];
    let grass = 0;
    for (let c = 0; c < map.w * map.h; c += 1) {
      const i = map.index(c % map.w, Math.floor(c / map.w), result.surface[c] as number);
      if (map.kindAt(i) === TileKind.Tree) trees.push(materials.byIndex(map.materialAt(i))?.id as string);
      if (map.hasFlag(i, TileFlag.Grass)) grass += 1;
      if ((result.columns[c] as number) !== 0) expect(map.kindAt(i)).toBe(TileKind.Floor);
    }
    const share = trees.length / (map.w * map.h);
    expect(share).toBeGreaterThan(0.15);
    expect(share).toBeLessThan(0.3);
    expect(new Set(trees)).toContain('oak');
    expect(trees.every((t) => ['oak', 'birch', 'yew', 'ash', 'maple', 'willow', 'ironwood'].includes(t))).toBe(true);
    expect(grass).toBeGreaterThan(1000);
  });

  it('generation of a full map takes at most 3 s', () => {
    const t0 = globalThis.performance.now();
    gen(spec({ seed: 'timed', relief: 3, elevation: 200, deepness: 255, volcano: true, traits: ['sunken_halls', 'wyrm_roost'], wealth: 4 }));
    expect(globalThis.performance.now() - t0).toBeLessThanOrEqual(3000);
  });
});

describe('T-M1-06 local map: stage 11 discovery, outdoor and lit', () => {
  function pitMap(): Map3D {
    // flat-test: surface floor at z = 32. A 2-wide pit three levels deep at (40..41, 40..41), with
    // its bottom floor at z = 29, and a tunnel east from the bottom and an alcove at z = 30.
    const map = buildFlatTestMap(registry);
    for (let y = 0; y < map.h; y += 1) for (let x = 0; x < map.w; x += 1) for (let z = 0; z < map.d; z += 1) map.flags[map.index(x, y, z)] = 0;
    const s = FLAT_TEST_SURFACE_Z;
    for (const [x, y] of [[40, 40], [41, 40], [40, 41], [41, 41]] as const) {
      for (let z = s; z > s - 3; z -= 1) map.kind[map.index(x, y, z)] = TileKind.Open;
      map.kind[map.index(x, y, s - 3)] = TileKind.Floor;
    }
    for (let x = 42; x <= 47; x += 1) map.kind[map.index(x, 40, s - 3)] = TileKind.Floor;
    map.kind[map.index(42, 40, s - 2)] = TileKind.Floor;
    stageLight(map);
    return map;
  }

  it('a 2-wide pit: outdoor and lit at the rim, dark at depth 3', () => {
    const map = pitMap();
    const s = FLAT_TEST_SURFACE_Z;
    const rim = map.index(39, 40, s);
    expect(map.hasFlag(rim, TileFlag.Outdoor)).toBe(true);
    expect(map.hasFlag(rim, TileFlag.Lit)).toBe(true);
    const bottom = map.index(40, 40, s - 3);
    expect(map.hasFlag(bottom, TileFlag.Outdoor)).toBe(true);
    expect(map.hasFlag(bottom, TileFlag.Lit)).toBe(true);
    // The alcove at depth 2 is one step from the pit's open air: lit, not outdoor.
    const alcove = map.index(42, 40, s - 2);
    expect(map.hasFlag(alcove, TileFlag.Outdoor)).toBe(false);
    expect(map.hasFlag(alcove, TileFlag.Lit)).toBe(true);
    // At depth 3 the pit's bottom is a floor, not open air: the tunnel beside it is dark.
    for (let x = 42; x <= 47; x += 1) {
      const t = map.index(x, 40, s - 3);
      expect(map.hasFlag(t, TileFlag.Outdoor)).toBe(false);
      expect(map.hasFlag(t, TileFlag.Lit)).toBe(false);
    }
    // Rock under the ground is neither outdoor nor lit.
    expect(map.hasFlag(map.index(10, 10, s - 1), TileFlag.Lit)).toBe(false);
  });

  it('outdoor tiles and their 26 neighbours are discovered, deep rock is not', () => {
    const map = pitMap();
    const s = FLAT_TEST_SURFACE_Z;
    expect(map.hasFlag(map.index(10, 10, s), TileFlag.Discovered)).toBe(true);
    expect(map.hasFlag(map.index(10, 10, s - 1), TileFlag.Discovered)).toBe(true);
    expect(map.hasFlag(map.index(10, 10, s - 2), TileFlag.Discovered)).toBe(false);
    expect(map.hasFlag(map.index(43, 40, s - 3), TileFlag.Discovered)).toBe(false);
    expect(map.hasFlag(map.index(42, 41, s - 3), TileFlag.Discovered)).toBe(true);
  });

  it('a generated map has an outdoor, lit, discovered surface and undiscovered caverns', () => {
    const { map, result } = gen(spec({ seed: 'lit', relief: 2 }));
    for (let c = 0; c < map.w * map.h; c += 7) {
      const i = map.index(c % map.w, Math.floor(c / map.w), result.surface[c] as number);
      expect(map.hasFlag(i, TileFlag.Outdoor)).toBe(true);
      expect(map.hasFlag(i, TileFlag.Lit)).toBe(true);
      expect(map.hasFlag(i, TileFlag.Discovered)).toBe(true);
    }
    for (const i of result.cavernFloors[2] ?? []) expect(map.hasFlag(i, TileFlag.Discovered)).toBe(false);
  });
});
