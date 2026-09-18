import { describe, it, expect } from 'vitest';
import { contentRegistry } from '@content/loader';
import { WORLD_SIZE_SMALL, WORLD_SIZE_STANDARD } from '@core/constants';
import { RngStream } from '@core/rng';
import { CIV_MIN_SEPARATION, PERIL_DISTANCE_STEP } from '@systems/worldgen/constants';
import { CIVS, generate, newGenWorld, worldReader, type GenRegion } from '@systems/worldgen';
import {
  edgeTowardHome,
  landDistances,
  placeHome,
  unreachableDistance,
} from '@systems/worldgen/stages/civilizations';
import {
  biomeTemper,
  bucket,
  geologyScore,
  perilScore,
  ratingThresholds,
  temperScore,
  wealthScore,
} from '@systems/worldgen/stages/ratings';
import { meets, rollTraits, traitsInTableOrder } from '@systems/worldgen/stages/traits';
import { flavorGroup, landformOf, regionName } from '@systems/worldgen/stages/names';

const registry = contentRegistry();

function landWorld(size: number, elevation = 120): ReturnType<typeof newGenWorld> {
  const g = newGenWorld('political', size);
  for (const r of g.regions) {
    r.elevation = elevation;
    r.biome = 'temperate_grassland';
  }
  return g;
}

describe('T-M1-03 worldgen: stage 6 civilizations', () => {
  it('place picks the best score at the separation, ties by id, and relaxes by 2 when none fits', () => {
    const g = landWorld(8);
    const first = placeHome(g, [], (r) => (r.x === 5 ? 10 : 0));
    expect(first.id).toBe(5); // x = 5, lowest id among the ties
    // Every region is within 7 of (5, 0) on an 8-wide map, so the separation relaxes 10 -> 8 -> 6.
    const second = placeHome(g, [first], () => 1);
    expect(Math.max(Math.abs(second.x - 5), Math.abs(second.y - 0))).toBe(CIV_MIN_SEPARATION - 4);
    expect(second.id).toBe(6 * 8); // first region at distance ≥ 6: (0, 6)
  });

  it('place never picks the sea', () => {
    const g = landWorld(8);
    for (const r of g.regions) if (r.x < 4) r.elevation = 10;
    const home = placeHome(g, [], () => 1);
    expect(home.x).toBeGreaterThanOrEqual(4);
  });

  it('distances cost 1 per land step, 2 into mountains, and are unreachable over the sea', () => {
    const g = landWorld(6);
    const home = g.regions[0] as GenRegion;
    (g.regions[1] as GenRegion).biome = 'mountain';
    (g.regions[2 * 6 + 0] as GenRegion).elevation = 10;
    const d = landDistances(g, home);
    expect(d[1]).toBe(2);
    expect(d[2]).toBe(3); // through the mountain: 2 + 1; round it: 4
    expect(d[6]).toBe(1);
    expect(d[12]).toBe(unreachableDistance(6));
    expect(d[13]).toBe(3);
  });

  it('the edge toward a home follows the dominant axis, north is row 0', () => {
    expect(edgeTowardHome({ x: 5, y: 5 }, { x: 9, y: 6 })).toBe('e');
    expect(edgeTowardHome({ x: 5, y: 5 }, { x: 1, y: 4 })).toBe('w');
    expect(edgeTowardHome({ x: 5, y: 5 }, { x: 5, y: 0 })).toBe('n');
    expect(edgeTowardHome({ x: 5, y: 5 }, { x: 6, y: 20 })).toBe('s');
    expect(edgeTowardHome({ x: 5, y: 5 }, { x: 8, y: 8 })).toBe('e');
    expect(edgeTowardHome({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe('n');
  });

  it('a generated world has four homes on land, the Gloam ringed by dark forest', () => {
    const world = generate('civs', WORLD_SIZE_STANDARD, registry);
    const reader = worldReader(world);
    for (const civ of CIVS) {
      const home = reader.region(reader.civHome(civ));
      expect(home?.biome).not.toBe('ocean');
      expect(home?.civDistance[civ]).toBe(0);
    }
    const gloam = reader.region(reader.civHome('gloam')) as NonNullable<ReturnType<typeof reader.region>>;
    const gx = gloam.id % world.size;
    const gy = Math.floor(gloam.id / world.size);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const n = reader.regionAt(gx + dx, gy + dy);
        if (n !== undefined && n.elevation >= 96) expect(n.biome).toBe('dark_forest');
      }
    }
  });
});

describe('T-M1-03 worldgen: stage 7 ratings', () => {
  it('thresholds come from content and bucket counts thresholds ≤ v', () => {
    const t = ratingThresholds(registry);
    expect(t.wealth).toEqual([3, 5, 7, 9]);
    expect(t.peril).toEqual([1, 2, 3, 4]);
    expect(t.temper).toEqual([1, 2, 3, 4]);
    expect([bucket(0, t.wealth), bucket(2, t.wealth), bucket(3, t.wealth), bucket(8, t.wealth), bucket(30, t.wealth)]).toEqual([
      0, 0, 1, 3, 4,
    ]);
  });

  it('the three scores follow the documented formulas', () => {
    const g = landWorld(4);
    const r = g.regions[0] as GenRegion;
    r.geology = 'igneous';
    r.volcano = true;
    r.deepness = 200;
    expect(wealthScore(r, 2)).toBe(3 + 2 + 3 + 2);
    r.civDistance.gloam = PERIL_DISTANCE_STEP * 2 + 1;
    r.biome = 'wetland';
    expect(perilScore(r)).toBe(4 - 2 + 2 + 1);
    r.civDistance.gloam = 1000;
    r.deepness = 0;
    r.biome = 'temperate_grassland';
    expect(perilScore(r)).toBe(0);
    r.biome = 'alpine';
    r.elevation = 200;
    r.rain = 201;
    expect(temperScore(r, 1)).toBe(2 + 1 + 1 + 1);
    expect([geologyScore('sedimentary'), geologyScore('mixed'), geologyScore('metamorphic')]).toEqual([1, 2, 3]);
    expect([biomeTemper('desert'), biomeTemper('savanna'), biomeTemper('wetland')]).toEqual([2, 1, 0]);
  });
});

describe('T-M1-03 worldgen: stage 8 traits', () => {
  const traits = traitsInTableOrder(registry);

  it('the table is walked in document order', () => {
    expect(traits.map((t) => t.id).slice(0, 5)).toEqual([
      'serene_vale',
      'wyrm_roost',
      'fungal_depths',
      'glasslands',
      'frostmarrow',
    ]);
  });

  it('D-040: requirements include temperature bands and biome exclusions', () => {
    const g = landWorld(4);
    const r = g.regions[0] as GenRegion;
    const frost = traits.find((t) => t.id === 'frostmarrow');
    const battle = traits.find((t) => t.id === 'old_battlefield');
    if (frost === undefined || battle === undefined) throw new Error('missing trait rows');
    r.tempC = 20;
    expect(meets(frost.requirements, r)).toBe(false);
    r.tempC = 0;
    expect(meets(frost.requirements, r)).toBe(true);
    r.peril = 2;
    expect(meets(battle.requirements, r)).toBe(true);
    r.biome = 'glacier';
    expect(meets(battle.requirements, r)).toBe(false);
    r.biome = 'tundra';
    r.peril = 1;
    expect(meets(battle.requirements, r)).toBe(false);
  });

  it('a success without a companion stops the roll; at most two traits; hooks raise ratings', () => {
    const g = landWorld(4);
    const vale = g.regions[0] as GenRegion;
    vale.biome = 'temperate_forest';
    vale.peril = 0;
    vale.river = { inflow: [], outflow: 'e', class: 'brook' };
    vale.tempC = 10;
    rollTraits(vale, traits, () => true);
    expect(vale.traits).toEqual(['serene_vale']);

    const iron = g.regions[1] as GenRegion;
    iron.biome = 'temperate_grassland';
    iron.geology = 'igneous';
    iron.wealth = 2;
    iron.peril = 1;
    iron.tempC = 10;
    rollTraits(iron, traits, (permille) => permille === 80);
    // ironheart (80) rolls before any later 80-permille trait could; wyrm_roost needs wealth 3.
    expect(iron.traits[0]).toBe('ironheart');
    expect(iron.traits.length).toBeLessThanOrEqual(2);
    expect(iron.wealth).toBe(3);

    const many = g.regions[2] as GenRegion;
    many.biome = 'taiga';
    many.deepness = 200;
    many.peril = 3;
    many.temper = 2;
    many.tempC = 0;
    rollTraits(many, traits, () => true);
    expect(many.traits).toEqual(['fungal_depths', 'frostmarrow']);
  });

  it('trait requirements honoured on 50 seeds: no wyrm_roost below wealth 3, serene_vale at peril 0', () => {
    let wyrms = 0;
    let vales = 0;
    for (let k = 0; k < 50; k += 1) {
      const world = generate(`traits-${k}`, WORLD_SIZE_STANDARD, registry);
      for (const r of world.regions) {
        expect(r.traits.length).toBeLessThanOrEqual(2);
        if (r.traits.includes('wyrm_roost')) {
          wyrms += 1;
          expect(r.wealth).toBeGreaterThanOrEqual(3);
        }
        if (r.traits.includes('serene_vale')) {
          vales += 1;
          expect(r.peril).toBe(0);
          expect(r.traits).toEqual(['serene_vale']);
        }
        if (r.traits.includes('glasslands')) expect(r.volcano).toBe(true);
        if (r.traits.includes('old_battlefield')) expect(r.peril).toBeGreaterThanOrEqual(2);
      }
    }
    expect(wyrms).toBeGreaterThan(0);
    expect(vales).toBeGreaterThan(0);
  });
});

describe('T-M1-03 worldgen: stage 9 names', () => {
  const names = registry.derived<{ regionFlavor: Record<string, string[]>; landform: Record<string, string[]> }>('names');
  const groups = Object.keys(names.regionFlavor);

  it('every land biome has a flavor group; the sea has none', () => {
    const biomes = registry.table('biomes').ids();
    for (const b of biomes) {
      if (b === 'ocean') expect(flavorGroup(b, groups)).toBeNull();
      else expect(flavorGroup(b, groups), b).not.toBeNull();
    }
    expect(flavorGroup('cold_steppe', groups)).toContain('steppe');
    expect(flavorGroup('dark_forest', groups)).toContain('forest');
    expect(flavorGroup('temperate_hills', groups)).toContain('hills');
  });

  it('names are flavor + landform, with the water landform on rivers and lakes', () => {
    const g = landWorld(4);
    const r = g.regions[0] as GenRegion;
    r.biome = 'wetland';
    r.lake = true;
    expect(landformOf(r)).toBe('water');
    const name = regionName(new RngStream(1), r, names);
    const flavor = (names.regionFlavor['wetland'] as string[]).find((f) => name.startsWith(f));
    expect(flavor).toBeDefined();
    expect(names.landform['water']).toContain(name.slice((flavor as string).length));
    r.lake = false;
    r.elevation = 170;
    expect(landformOf(r)).toBe('high');
    r.elevation = 140;
    expect(landformOf(r)).toBe('hills');
    r.elevation = 100;
    expect(landformOf(r)).toBe('low');
    r.biome = 'ocean';
    expect(regionName(new RngStream(1), r, names)).toBe('');
  });
});

describe('T-M1-03 worldgen: the reader', () => {
  const world = generate('reader', WORLD_SIZE_SMALL, registry);
  const reader = worldReader(world);

  it('region, regionAt and regions agree', () => {
    expect(reader.size()).toBe(WORLD_SIZE_SMALL);
    expect(reader.regions()).toHaveLength(WORLD_SIZE_SMALL * WORLD_SIZE_SMALL);
    expect(reader.regionAt(3, 2)).toBe(reader.region(2 * WORLD_SIZE_SMALL + 3));
    expect(reader.regionAt(-1, 0)).toBeUndefined();
    expect(reader.regionAt(0, WORLD_SIZE_SMALL)).toBeUndefined();
    expect(Object.isFrozen(reader.regions())).toBe(true);
  });

  it('findRegions filters by every field and returns id order', () => {
    const all = reader.regions();
    const land = reader.findRegions({ biomes: ['ocean'] });
    expect(land.every((r) => r.biome === 'ocean')).toBe(true);
    expect(land.length).toBe(all.filter((r) => r.biome === 'ocean').length);
    const rich = reader.findRegions({ wealth: [3, 4] });
    expect(rich.every((r) => r.wealth >= 3)).toBe(true);
    expect(rich.length).toBe(all.filter((r) => r.wealth >= 3).length);
    const safe = reader.findRegions({ peril: [0, 0], temper: [0, 1] });
    expect(safe.every((r) => r.peril === 0 && r.temper <= 1)).toBe(true);
    const rivers = reader.findRegions({ river: true });
    expect(rivers.length).toBe(all.filter((r) => r.river !== null).length);
    expect(reader.findRegions({ river: false }).length).toBe(all.length - rivers.length);
    expect(reader.findRegions({ volcano: true }).every((r) => r.volcano)).toBe(true);
    const withTrait = all.find((r) => r.traits.length > 0);
    if (withTrait !== undefined) {
      const hits = reader.findRegions({ traits: [withTrait.traits[0] as string] });
      expect(hits).toContain(withTrait);
      expect(hits.every((r) => r.traits.includes(withTrait.traits[0] as string))).toBe(true);
    }
    const ids = reader.findRegions({}).map((r) => r.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it('riverOf returns the river through a region', () => {
    const big = generate('reader-rivers', WORLD_SIZE_STANDARD, registry);
    const r = worldReader(big);
    const river = big.rivers[0];
    if (river === undefined) throw new Error('no river');
    expect(r.riverOf(river.regions[0] as number)).toBe(river);
    const dry = big.regions.find((reg) => reg.river === null);
    expect(r.riverOf(dry?.id as number)).toBeUndefined();
  });
});
