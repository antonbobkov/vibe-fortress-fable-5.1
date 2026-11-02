/** T-468: glowcap under a lamp, the laboratory, rune vials, wild patches and the caravan's extra goods. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateLocalMap } from '@systems/terrain/generate';
import { loadGame } from '@app/game-save';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import { RngStream } from '@core/rng';
import type { TileIndex } from '@core/types';
import { contentRegistry, loadContent, rawTables } from '@content/loader';
import type { BuildingsSystem } from '@systems/buildings';
import { EmbarkSession } from '@systems/embark';
import { FLAT_TEST_SURFACE_Z, generatedSpec } from '@app/headless';
import { lightOk, stageLength } from '@systems/plants/growth';
import type { PlantRow, PlantsReader } from '@systems/plants';
import { packAnimalsFor } from '@systems/trade/caravan';
import { caravanBudget, generateGoods, type PlannedGood } from '@systems/trade/goods';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;

function darkSquare(w: TestWorld, x: number, y: number, side = 3): TileIndex[] {
  const tiles: TileIndex[] = [];
  for (let dy = 0; dy < side; dy += 1) for (let dx = 0; dx < side; dx += 1) {
    const tile = w.index(x + dx, y + dy, Z);
    w.game.world.services.terrain.setFlag(tile, TileFlag.Lit, false);
    tiles.push(tile);
  }
  return tiles;
}

function growth(w: TestWorld, crop: number): number {
  return w.game.world.entities.get(crop, C.Crop)?.growth ?? -1;
}

const hour = 50;

describe('T-468 glowcap under a lamp', () => {
  it('the light rule: dark under a lamp and nothing else', () => {
    const row = registry.table<PlantRow>('plants').byId('glowcap') as PlantRow;
    expect(lightOk(row, false, true)).toBe(true);
    expect(lightOk(row, false, false)).toBe(false);
    expect(lightOk(row, true, true)).toBe(false);
    expect(lightOk(row, true, false)).toBe(false);
  });

  it('grows on a dark tile under a lamp; not with the lamp removed, on a dark tile with none, or on a lit tile', () => {
    const w = new TestWorld({ seed: 't468-growth', embark: 'none' });
    w.forceTemperature(w.index(21, 20, Z), 15);
    const tiles = darkSquare(w, 20, 20);
    const lamp = w.build('statue', w.index(21, 21, Z), 'glowstone');
    const lampedTile = w.index(21, 20, Z);
    const lamped = w.plantCrop(lampedTile, 'glowcap');
    const uncovered = darkSquare(w, 40, 40, 1)[0] as TileIndex;
    w.forceTemperature(uncovered, 15);
    const dark = w.plantCrop(uncovered, 'glowcap');
    const litTile = w.index(30, 30, Z);
    w.forceTemperature(litTile, 15);
    const lit = w.plantCrop(litTile, 'glowcap');
    w.step(hour * 26);
    const grown = growth(w, lamped);
    expect(grown).toBeGreaterThan(0);
    expect(growth(w, dark)).toBe(0);
    expect(growth(w, lit)).toBe(0);

    (w.game.world.scheduler.byId('14') as BuildingsSystem).buildings.remove(lamp);
    expect(w.map.hasFlag(tiles[1] as number, TileFlag.Lit)).toBe(false);
    w.step(hour * 26);
    expect(w.game.world.entities.alive(lamped)).toBe(true);
    expect(growth(w, lamped)).toBe(grown);
    expect(w.game.world.entities.get(lamped, C.Crop)?.stage).toBe(0);
  });

  it('a stage takes its row\'s six days', () => {
    expect(stageLength(registry.table<PlantRow>('plants').byId('glowcap') as PlantRow)).toBeGreaterThan(
      stageLength(registry.table<PlantRow>('plants').byId('dimcap') as PlantRow));
  });

  it('SetPlotCrop takes glowcap only on a plot wholly under lamps', () => {
    const w = new TestWorld({ seed: 't468-plot', embark: 'none' });
    const tiles = darkSquare(w, 20, 20);
    const zoneId = w.zone('farm_plot', tiles);
    const world = w.game.world;
    const reader = w.readers.of<PlantsReader>('07');
    expect(reader.plotKind(zoneId)).toBe('cave');
    const set = (speciesId: string) => world.applyCommand({ type: 'SetPlotCrop', zoneId, season: 0, speciesId });
    expect(set('glowcap')).toEqual({ ok: false, reason: 'light_mismatch' });

    // One lamp at the edge leaves a third of the plot uncovered.
    const edge = w.build('statue', w.index(19, 21, Z), 'glowstone');
    expect(reader.plotKind(zoneId)).toBe('cave');
    expect(set('glowcap')).toEqual({ ok: false, reason: 'light_mismatch' });
    (world.scheduler.byId('14') as BuildingsSystem).buildings.remove(edge);

    w.build('statue', w.index(21, 21, Z), 'glowstone');
    expect(reader.plotKind(zoneId)).toBe('glow');
    expect(set('glowcap').ok).toBe(true);
    expect(set('dimcap').ok).toBe(true);
    expect(set('barley')).toEqual({ ok: false, reason: 'light_mismatch' });

    const lit = w.zone('farm_plot', [w.index(30, 30, Z), w.index(31, 30, Z)]);
    expect(world.applyCommand({ type: 'SetPlotCrop', zoneId: lit, season: 0, speciesId: 'glowcap' })).toEqual({ ok: false, reason: 'light_mismatch' });
  });

  it('the four-slot zone setting follows the same rule', () => {
    const w = new TestWorld({ seed: 't468-setting', embark: 'none' });
    const tiles = darkSquare(w, 20, 20);
    const zoneId = w.zone('farm_plot', tiles);
    const setting = { type: 'SetZoneSetting', zoneId, key: 'crop_per_season', value: ['glowcap', 0, 0, 0] } as const;
    expect(w.game.world.applyCommand(setting as never).ok).toBe(false);
    w.build('statue', w.index(21, 21, Z), 'glowstone');
    expect(w.game.world.applyCommand(setting as never).ok).toBe(true);
  });
});

describe('T-468 the laboratory', () => {
  it('two glowcap make one vial, through a dwarf with the alchemy labor', () => {
    const w = new TestWorld({ seed: 't468-lab', embark: 'none' });
    const lab = w.build('alchemist', w.index(12, 12, Z), 'granite');
    w.spawnDwarf({ at: w.index(16, 16, Z) });
    const glowcap = w.spawnItem('glowcap', 'glowcap', w.index(16, 14, Z), 3);
    w.step(1);
    expect(w.game.world.applyCommand({
      type: 'AddWorkOrder', workshopId: lab,
      order: { recipeId: 'distill_rune', mode: 'once', remaining: 1, priority: 5 },
    }).ok).toBe(true);
    w.until((world) => world.events('ItemCrafted').some((e) => e['recipeId'] === 'distill_rune'), 2000);
    expect(w.events('ItemCrafted').filter((e) => e['recipeId'] === 'distill_rune')).toHaveLength(1);
    const items = registry.table('items');
    const materials = registry.table('materials');
    const entities = w.game.world.entities;
    const vials = entities.with(C.Item).map((id) => entities.get(id, C.Item)!).filter((i) => i.type === items.index('rune_vial'));
    expect(vials.map((i) => [i.count, i.material])).toEqual([[1, materials.index('rune')]]);
    expect(entities.get(glowcap, C.Item)?.count).toBe(1);
  });

  it('the laboratory carries rune_work and takes alchemy; a vial is rune_fuel; neither item is food', () => {
    const buildings = registry.table<{ id: string; tags: string[]; category: string }>('buildings');
    expect(buildings.byId('alchemist')?.tags).toEqual(['rune_work']);
    expect(buildings.byId('alchemist')?.category).toBe('workshop');
    const items = registry.table<{ id: string; tags?: string[]; edible?: boolean; category: string }>('items');
    expect(items.byId('rune_vial')?.tags).toEqual(['rune_fuel']);
    for (const id of ['glowcap', 'rune_vial']) {
      expect(items.byId(id)?.edible).toBeUndefined();
      expect(items.byId(id)?.tags ?? []).not.toContain('ingredient');
      expect(items.byId(id)?.category.startsWith('medical/')).toBe(true);
    }
  });

  it('no dwarf eats a glowcap and no kitchen takes one', () => {
    const w = new TestWorld({ seed: 't468-food', embark: 'none' });
    const dwarf = w.spawnDwarf({ at: w.index(16, 16, Z), skills: { cooking: 5 } });
    w.setNeed(dwarf, 'hunger', 950);
    const glowcap = w.spawnItem('glowcap', 'glowcap', w.index(17, 16, Z), 5);
    const kitchen = w.build('kitchen', w.index(12, 12, Z), 'granite');
    w.step(1);
    w.game.world.applyCommand({
      type: 'AddWorkOrder', workshopId: kitchen,
      order: { recipeId: 'cook_easy_meal', mode: 'once', remaining: 1, priority: 5 },
    });
    w.step(600);
    expect(w.events('MealEaten')).toHaveLength(0);
    expect(w.events('ItemCrafted')).toHaveLength(0);
    expect(w.game.world.entities.get(glowcap, C.Item)?.count).toBe(5);
  });
});

describe('T-468 wild patches', () => {
  it('only tiles that were already cave shrubs change, at the row\'s permille, and nothing else moves', () => {
    const plants = (rawTables()['plants'] as PlantRow[]).map((row) => {
      if (row.rarePermille === undefined) return row;
      const { rarePermille: _gone, ...rest } = row;
      return rest;
    });
    const plain = loadContent({ overrides: { plants } });
    const seed = 'test-1';
    const before = generateLocalMap(generatedSpec(seed, plain), plain);
    const after = generateLocalMap(generatedSpec(seed, registry), registry);
    const patch = registry.table('materials').index('glowcap_patch');
    let shrubs = 0;
    let converted = 0;
    expect(Array.from(after.map.kind)).toEqual(Array.from(before.map.kind));
    expect(Array.from(after.map.flags)).toEqual(Array.from(before.map.flags));
    expect(after.result.spawns).toEqual(before.result.spawns);
    const size = after.map.material.length;
    for (let i = 0; i < size; i += 1) {
      if (after.map.material[i] === before.map.material[i]) {
        if (after.map.kind[i] === TileKind.Shrub) shrubs += 1;
        continue;
      }
      expect(after.map.kind[i]).toBe(TileKind.Shrub);
      expect(after.map.material[i]).toBe(patch);
      converted += 1;
    }
    expect(converted).toBeGreaterThan(0);
    expect(converted).toBeLessThan(shrubs);
  });

  it('a patch gathers glowcap, and its seed is glowcap\'s', () => {
    const row = registry.table<PlantRow>('plants').byId('glowcap_patch') as PlantRow;
    expect(row.kind).toBe('shrub');
    expect(row.yieldItem).toBe('glowcap');
    expect(row.yieldMaterial).toBe('glowcap');
    expect(row.seedOf).toBe('glowcap');
    expect(row.caverns).toBeUndefined();
    expect(row.rarePermille).toEqual([100, 130, 250]);
  });
});

describe('T-468 caravan extras', () => {
  const good = (goods: readonly PlannedGood[], item: string, material: string): PlannedGood[] => goods.filter((g) =>
    g.type === registry.table('items').index(item) && g.material === registry.table('materials').index(material));

  it('the ordinary goods and the main stream do not change, and extras come past the budget', () => {
    let seeds = 0;
    let stones = 0;
    const runs = 400;
    for (let n = 0; n < runs; n += 1) {
      const main = new RngStream(n + 1);
      const goods = generateGoods(registry, 'mountainhome', 0, 0, [], main, new RngStream(9000 + n));
      const other = new RngStream(n + 1);
      const again = generateGoods(registry, 'mountainhome', 0, 0, [], other, new RngStream(1 + n));
      expect(main.state()).toEqual(other.state());
      const ordinary = goods.filter((g) => !g.extra);
      expect(ordinary).toEqual(again.filter((g) => !g.extra));
      expect(ordinary.some((g) => g.material === registry.table('materials').index('glowcap'))).toBe(false);
      expect(ordinary.some((g) => g.material === registry.table('materials').index('glowstone'))).toBe(false);
      expect(goods.slice(0, ordinary.length)).toEqual(ordinary);
      expect(ordinary.reduce((s, g) => s + g.value, 0)).toBeLessThanOrEqual(caravanBudget(0, 0) * 1.2);
      seeds += good(goods, 'seed', 'glowcap').length;
      stones += good(goods, 'rough_gem', 'glowstone').length;
    }
    expect(seeds / runs).toBeGreaterThan(0.6);
    expect(seeds / runs).toBeLessThan(0.8);
    expect(stones / runs).toBeGreaterThan(0.4);
    expect(stones / runs).toBeLessThan(0.6);
  });

  it('a bag holds ten seeds, and the other civilizations bring no extras', () => {
    const goods = generateGoods(registry, 'mountainhome', 0, 0, [], new RngStream(3), new RngStream(4));
    for (const g of good(goods, 'seed', 'glowcap')) expect(g.count % 10).toBe(0);
    for (const civ of ['hillfolk', 'wildwood'] as const) {
      expect(generateGoods(registry, civ, 0, 0, [], new RngStream(3), new RngStream(4)).some((g) => g.extra)).toBe(false);
    }
  });

  it('a request still finds an extra entry', () => {
    const goods = generateGoods(registry, 'mountainhome', 0, 0, [{ itemType: 'rough_gem', material: 'glowstone', priority: 3 }], new RngStream(5), new RngStream(6));
    expect(good(goods, 'rough_gem', 'glowstone').filter((g) => !g.extra).length).toBeGreaterThan(0);
  });

  it('minReputation holds an entry back until the reputation reaches it', () => {
    const caravanGoods = (rawTables()['caravanGoods'] as { civ: string; entries: { extra?: unknown }[] }[]).map((row) => ({
      ...row,
      entries: row.entries.map((e) => (e.extra === undefined ? e : { ...e, extra: { permille: 1000, minReputation: 50 } })),
    }));
    const gated = loadContent({ overrides: { caravanGoods } });
    expect(generateGoods(gated, 'mountainhome', 0, 49, [], new RngStream(7), new RngStream(8)).some((g) => g.extra)).toBe(false);
    expect(generateGoods(gated, 'mountainhome', 0, 50, [], new RngStream(7), new RngStream(8)).filter((g) => g.extra)).toHaveLength(2);
  });

  it('extra goods add no pack animal', () => {
    const goods = generateGoods(registry, 'mountainhome', 0, 0, [], new RngStream(3), new RngStream(4));
    const planned = [...goods, { type: 1, material: 1, count: 1, value: 100_000, extra: true as const }];
    expect(packAnimalsFor(planned)).toBe(packAnimalsFor(goods.filter((g) => !g.extra)));
  });
});

describe('T-468 the alchemy skill and labor', () => {
  it('the embark screen does not offer alchemy and SetSkill refuses it', () => {
    const session = new EmbarkSession(registry, 't468', 0);
    expect(session.apply({ type: 'SetSkill', dwarf: 0, skill: 'alchemy', level: 1 })).toEqual({ ok: false, reason: 'not_found' });
    expect(session.apply({ type: 'SetSkill', dwarf: 0, skill: 'brewing', level: 1 }).ok).toBe(true);
    expect(registry.table<{ id: string; embark?: boolean }>('skills').byId('alchemy')?.embark).toBe(false);
  });

  it('numbers after every older row', () => {
    const baseline = JSON.parse(readFileSync(fileURLToPath(new URL('../../fixtures/content-row-baseline.json', import.meta.url)), 'utf8')) as { tables: Record<string, string[]> };
    expect(registry.table('skills').index('alchemy')).toBeGreaterThan(baseline.tables['skills']?.length ?? Infinity);
    expect(registry.table('labors').index('alchemy')).toBeGreaterThan(baseline.tables['labors']?.length ?? Infinity);
  });

  it('a new dwarf has the labor on; a dwarf of an older save has it off, at skill 0', async () => {
    const w = new TestWorld({ seed: 't468-labor', embark: 'none' });
    const fresh = w.spawnDwarf({ at: w.index(16, 16, Z) });
    const labor = registry.table('labors').index('alchemy');
    const on = (entities: TestWorld['game']['world']['entities'], id: number): boolean => {
      const enabled = entities.get(id, C.Labors)?.enabled as Uint8Array;
      return ((enabled[labor >> 3] as number) & (1 << (labor & 7))) !== 0;
    };
    const fixture = new Uint8Array(readFileSync(fileURLToPath(new URL('../../fixtures/played-fortress.deepholm', import.meta.url))));
    const { game } = await loadGame(fixture, { registry });
    const dwarves = game.world.entities.with(C.Labors);
    expect(dwarves.length).toBeGreaterThan(0);
    expect(on(w.game.world.entities, fresh)).toBe(true);
    const skill = registry.table('skills').index('alchemy');
    for (const id of dwarves) {
      expect(on(game.world.entities, id)).toBe(false);
      expect(game.world.entities.get(id, C.Skills)?.level[skill]).toBe(0);
    }
  });
});
