/**
 * T-560, Making Do C4: the `starfall` region trait and star steel (`01-world-generation.md`
 * § Traits; `03-terrain-and-mining.md` § Local map generation stage 10; `10-dwarves.md`
 * § Movement; `15-happiness-and-morale.md` § Thoughts; `20-trade-and-caravans.md` § Never sold,
 * § Trading; `minerals-and-metals.md` § Ores, § Metals).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_LAYERS, FLAT_TEST_SPEC, HeadlessGame, regionSpec } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { WORLD_SIZE_STANDARD } from '@core/constants';
import { TileKind } from '@core/map3d';
import { RngStream } from '@core/rng';
import { StateHasher } from '@core/serialize';
import type { TileIndex } from '@core/types';
import type { CombatReader } from '@systems/combat';
import type { ItemsReader } from '@systems/items';
import type { MoraleReader } from '@systems/morale';
import { generateLocalMap } from '@systems/terrain/generate';
import { CRATER_EDGE_DISTANCE, CRATER_RADIUS_MAX, CRATER_RADIUS_MIN, CRATER_WYRMTONGUE_PERMILLE } from '@systems/terrain/constants';
import { generateGoods } from '@systems/trade/goods';
import { preferencePercent } from '@systems/trade/valuation';
import type { TradeReader } from '@systems/trade';
import { generate } from '@systems/worldgen';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const materials = registry.table('materials');

/** The world hashes before T-560 (test-1…3 are `world-hashes.json`'s values before it moved). */
const BEFORE: Readonly<Record<string, string>> = {
  'test-1': '1bb32794cf837f0d',
  'test-2': '821944a3b03e2f9d',
  'test-3': '01d22ac05b29cd63',
  deepholm: '9399e2c8eda13f31',
  emberhall: '479e9fafef8520b3',
};

describe('T-560 starfall is rolled on its own stream (01 § Traits)', () => {
  const traits = registry.table<{ id: string; companion: boolean }>('regionTraits');
  const companion = new Map(traits.ids().map((id) => [id, traits.byId(id)?.companion === true]));
  for (const seed of Object.keys(BEFORE)) {
    it(`${seed}: every other trait of every region is what it was; only starfall is new`, () => {
      const world = generate(seed, WORLD_SIZE_STANDARD, registry);
      const starfall = world.regions.filter((r) => r.traits.includes('starfall'));
      expect(starfall.length).toBeGreaterThan(0);
      for (const r of starfall) {
        expect(['ocean', 'glacier']).not.toContain(r.biome);
        expect(r.traits.length).toBeLessThanOrEqual(2);
        expect(r.traits[r.traits.length - 1]).toBe('starfall');
        for (const t of r.traits) expect(companion.get(t), t).toBe(true);
      }
      const stripped = { ...world, regions: world.regions.map((r) => ({ ...r, traits: r.traits.filter((t) => t !== 'starfall') })) };
      expect(new StateHasher().value(stripped).digest()).toBe(BEFORE[seed]);
    });
  }
});

interface Crater {
  readonly tiles: readonly TileIndex[];
  readonly floorZ: number;
  readonly meteorite: TileIndex;
}

/** The crater of a generated map: its tiles and the one star iron tile. */
function crater(spec: ReturnType<typeof regionSpec>): Crater & { map: ReturnType<typeof generateLocalMap>['map'] } {
  const { map, result } = generateLocalMap(spec, registry);
  const star = materials.index('star_iron');
  const meteorites: TileIndex[] = [];
  for (let i = 0; i < map.material.length; i += 1) if (map.material[i] === star) meteorites.push(i);
  expect(meteorites).toHaveLength(1);
  const tiles = result.craterTiles;
  const zs = new Set(tiles.map((i) => map.zOf(i)));
  expect(zs.size).toBe(1);
  return { tiles, floorZ: [...zs][0] as number, meteorite: meteorites[0] as TileIndex, map };
}

describe('T-560 the crater (03 stage 10)', () => {
  const biomes = ['temperate_grassland', 'temperate_forest', 'desert', 'tundra', 'mountain'];
  for (const biome of biomes) {
    it(`${biome}: one crater of ash, wild wyrmtongue, one star iron boulder below its centre; nothing else moves`, () => {
      const plain = regionSpec(`t560-${biome}`, { biome, relief: 2, traits: [] });
      const spec = { ...plain, traits: ['starfall'] };
      const c = crater(spec);
      const map = c.map;
      const ash = materials.index('ash_soil');
      const plant = materials.index('wild_wyrmtongue');
      // The meteorite is a boulder one level below the crater floor's centre.
      expect(map.kindAt(c.meteorite)).toBe(TileKind.Boulder);
      expect(map.zOf(c.meteorite)).toBe(c.floorZ - 1);
      const above = map.index(map.xOf(c.meteorite), map.yOf(c.meteorite), c.floorZ);
      expect(c.tiles).toContain(above);
      // A disc of radius 3–5: every tile is ash floor, an ash ramp or wild wyrmtongue, open above.
      const cx = map.xOf(c.meteorite);
      const cy = map.yOf(c.meteorite);
      let shrubs = 0;
      let radius = 0;
      for (const i of c.tiles) {
        const kind = map.kindAt(i);
        if (kind === TileKind.Shrub) {
          expect(map.materialAt(i)).toBe(plant);
          shrubs += 1;
        } else {
          expect([TileKind.Floor, TileKind.Ramp]).toContain(kind);
          expect(map.materialAt(i)).toBe(ash);
        }
        expect(map.kindAt(map.index(map.xOf(i), map.yOf(i), c.floorZ + 1))).toBe(TileKind.Open);
        radius = Math.max(radius, Math.round(Math.sqrt((map.xOf(i) - cx) ** 2 + (map.yOf(i) - cy) ** 2)));
      }
      expect(radius).toBeGreaterThanOrEqual(CRATER_RADIUS_MIN);
      expect(radius).toBeLessThanOrEqual(CRATER_RADIUS_MAX);
      expect(shrubs).toBeLessThan(c.tiles.length);
      // At least `CRATER_EDGE_DISTANCE` from the arrival edge.
      const e = spec.arrivalEdge;
      const inward = e === 'n' ? cy : e === 's' ? map.h - 1 - cy : e === 'w' ? cx : map.w - 1 - cx;
      expect(inward).toBeGreaterThanOrEqual(CRATER_EDGE_DISTANCE);
      // Only the crater's columns and the ring beside them differ from the map without the trait.
      const before = generateLocalMap(plain, registry).map;
      for (let i = 0; i < map.kind.length; i += 1) {
        if (map.kind[i] === before.kind[i] && map.material[i] === before.material[i] && map.fluid[i] === before.fluid[i]) continue;
        const d = Math.max(Math.abs(map.xOf(i) - cx), Math.abs(map.yOf(i) - cy));
        expect(d, `tile ${i}`).toBeLessThanOrEqual(CRATER_RADIUS_MAX + 1);
      }
    });
  }

  it('wild wyrmtongue grows on about CRATER_WYRMTONGUE_PERMILLE of the crater floor', () => {
    const plant = materials.index('wild_wyrmtongue');
    let shrubs = 0;
    let floor = 0;
    for (let k = 0; k < 8; k += 1) {
      const c = crater({ ...regionSpec(`t560-grass-${k}`, { biome: 'temperate_grassland', relief: 1, traits: [] }), traits: ['starfall'] });
      for (const i of c.tiles) {
        if (c.map.kindAt(i) === TileKind.Ramp) continue;
        floor += 1;
        if (c.map.kindAt(i) === TileKind.Shrub && c.map.materialAt(i) === plant) shrubs += 1;
      }
    }
    expect(shrubs / floor).toBeGreaterThan(CRATER_WYRMTONGUE_PERMILLE / 1000 / 2);
    expect(shrubs / floor).toBeLessThan((CRATER_WYRMTONGUE_PERMILLE / 1000) * 2);
  });

  it('a map without the trait has no crater and no star iron', () => {
    const { map, result } = generateLocalMap(regionSpec('t560-plain', { biome: 'temperate_grassland', relief: 2, traits: [] }), registry);
    expect(result.craterTiles).toEqual([]);
    expect(map.material.includes(materials.index('star_iron'))).toBe(false);
  });
});

describe('T-560 star iron and star steel (minerals-and-metals.md)', () => {
  it('smelt_star_iron makes three bars of star steel from one ore, with fuel and no flux', () => {
    const w = new TestWorld({ seed: 't560-smelt', world: 'flat-test', embark: 'none' });
    const smelter = w.build('smelter', w.index(15, 15, 32));
    const smith = w.spawnDwarf({ at: w.index(19, 18, 32), skills: { smelting: 6 } });
    w.spawnItem('ore', 'star_iron', w.index(18, 17, 32));
    w.spawnItem('charcoal_bar', 'charcoal', w.index(18, 18, 32));
    w.step(1);
    const recipe = w.game.registry.table<{ id: string; inputs: readonly { match: string; material?: string }[]; fuel: boolean }>('recipes').byId('smelt_star_iron');
    expect(recipe?.fuel).toBe(true);
    expect(recipe?.inputs).toEqual([{ match: 'ore', count: 1, material: 'star_iron' }]);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: smelter,
      order: { recipeId: 'smelt_star_iron', mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
    const items = w.readers.of<ItemsReader>('13');
    w.until(() => w.events('ItemCrafted').some((e) => e['recipeId'] === 'smelt_star_iron'), 2000);
    const made = w.events('ItemCrafted').find((e) => e['recipeId'] === 'smelt_star_iron')!;
    const bar = items.get(made['itemId'] as number)!;
    expect(bar.count).toBe(3);
    expect(materials.byIndex(bar.material)?.id).toBe('star_steel');
    expect(items.count('charcoal_bar')).toBe(0);
    // The bars are not a forged piece: the smelter has no `forged_the_star`.
    w.step(2);
    expect(w.readers.of<MoraleReader>('15').thoughts(smith).some((t) => t.id === 'forged_the_star')).toBe(false);
  });

  it('a piece forged of star steel gives its smith forged_the_star', () => {
    const w = new TestWorld({ seed: 't560-forge', world: 'flat-test', embark: 'none' });
    const forge = w.build('forge', w.index(15, 15, 32));
    const smith = w.spawnDwarf({ at: w.index(19, 18, 32), skills: { weaponsmithing: 6 } });
    w.spawnItem('bar', 'star_steel', w.index(18, 17, 32));
    w.spawnItem('bar', 'star_steel', w.index(18, 17, 32));
    w.spawnItem('charcoal_bar', 'charcoal', w.index(18, 18, 32));
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: forge,
      order: { recipeId: 'forge_battle_axe', mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
    w.until(() => w.events('ItemCrafted').some((e) => e['recipeId'] === 'forge_battle_axe'), 3000);
    const made = w.events('ItemCrafted').find((e) => e['recipeId'] === 'forge_battle_axe')!;
    expect(materials.byIndex(w.readers.of<ItemsReader>('13').get(made['itemId'] as number)!.material)?.id).toBe('star_steel');
    w.step(2);
    expect(w.readers.of<MoraleReader>('15').thoughts(smith).some((t) => t.id === 'forged_the_star')).toBe(true);
  });
});

describe('T-560 standing in the crater (10 § Movement, 15 § Thoughts)', () => {
  it('a dwarf stepping into the crater emits CraterEntered, the first with first: true, and gets saw_the_star', () => {
    const centre = (x: number, y: number): TileIndex => (32 * 96 + y) * 96 + x;
    const tiles: TileIndex[] = [];
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) tiles.push(centre(20 + dx, 20 + dy));
    const w = new TestWorld({ seed: 't560-crater', world: 'flat-test', embark: 'none',
      systems: HeadlessGame.standardSystems(FLAT_TEST_SPEC, FLAT_TEST_LAYERS, { sinks: [], warmSprings: [], craterTiles: tiles }) });
    expect(w.index(20, 20, 32)).toBe(centre(20, 20));
    const dwarf = w.spawnDwarf({ at: w.index(10, 20, 32) });
    const apply = w.game.world.applyCommand.bind(w.game.world);
    expect(apply({ type: 'CreateSquad', name: 'Stargazers' }).ok).toBe(true);
    const squad = w.readers.of<CombatReader>('16').squads()[0]!.id;
    expect(apply({ type: 'SetSquadMembers', squadId: squad, members: [dwarf] }).ok).toBe(true);
    expect(apply({ type: 'SetSquadStation', squadId: squad, tile: centre(20, 20) }).ok).toBe(true);
    expect(apply({ type: 'SetSquadMode', squadId: squad, mode: 'active' }).ok).toBe(true);
    w.until((v) => v.events('CraterEntered').length > 0, 300);
    expect(w.events('CraterEntered')[0]).toEqual(expect.objectContaining({ id: dwarf, first: true }));
    w.step(2);
    expect(w.readers.of<MoraleReader>('15').thoughts(dwarf).some((t) => t.id === 'saw_the_star')).toBe(true);
    // Saved: a load keeps the first entry made.
    const terrain = w.game.world.scheduler.byId('03')?.serialize() as { craterTiles?: number[] };
    expect(terrain.craterTiles).toEqual(tiles);
    const dwarves = w.game.world.scheduler.byId('10')?.serialize() as { craterEntered?: boolean };
    expect(dwarves.craterEntered).toBe(true);
  });

  it('a map with no crater saves no crater fields', () => {
    const w = new TestWorld({ seed: 't560-none', world: 'flat-test', embark: 'none' });
    w.step(1);
    expect('craterTiles' in (w.game.world.scheduler.byId('03')?.serialize() as object)).toBe(false);
    expect('craterEntered' in (w.game.world.scheduler.byId('10')?.serialize() as object)).toBe(false);
  });
});

describe('T-560 star steel is never sold, and merchants pay 200% (20)', () => {
  it('every civilization values star steel at 200%', () => {
    for (const civ of ['mountainhome', 'hillfolk', 'wildwood'] as const) {
      expect(preferencePercent(registry, civ, 'bar/metal', 'star_steel', 'metal')).toBe(200);
      expect(preferencePercent(registry, civ, 'weapon/axe', 'star_steel', 'metal')).toBe(200);
    }
  });

  it('no caravan brings any, in many draws of every civilization', () => {
    const steel = materials.index('star_steel');
    for (const civ of ['mountainhome', 'hillfolk', 'wildwood'] as const) {
      for (let k = 0; k < 200; k += 1) {
        const goods = generateGoods(registry, civ, 2000, 90, [], new RngStream(5600 + k), new RngStream(9600 + k));
        expect(goods.some((g) => g.material === steel), `${civ} ${k}`).toBe(false);
      }
    }
  });

  it('a request for star steel is refused', () => {
    const w = new TestWorld({ seed: 't560-request', world: 'flat-test', embark: 'none' });
    w.step(1);
    const r = w.game.world.applyCommand({ type: 'SetRequests', civ: 'mountainhome', entries: [{ itemType: 'bar', material: 'star_steel', priority: 1 }] });
    expect(r.ok).toBe(false);
    expect(w.readers.of<TradeReader>('20').requests('mountainhome')).toEqual([]);
  });
});
