/**
 * T-553, Making Do B3: the kiln and the magma kiln, the `pottery` skill, bricks, pots, clay jugs and
 * mugs, glass blocks, potash and bone ash, and steel from bone ash (`12-workshops-and-professions.md`
 * § Workshops fixed by this design, § Recipes; `13-items-and-storage.md` § Containers in play;
 * `16-combat.md` § Pots break; `workshops-and-recipes.md` § Kiln).
 */
import { describe, expect, it } from 'vitest';
import caravanGoods from '@content/caravanGoods.json';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import type { Item } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { ItemsReader } from '@systems/items';
import { preferencePercent } from '@systems/trade/valuation';
import type { WorkshopsReader } from '@systems/workshops';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const items = registry.table<{ id: string; category: string; capacity?: number; containerClass?: string; tags?: readonly string[] }>('items');
const materials = registry.table<{ id: string; class: string; tags?: readonly string[]; meltsAtC: number }>('materials');
const Z = 32;

/** Every item of a type in the world. */
function itemsOf(w: TestWorld, type: string): Item[] {
  const t = items.index(type);
  const out: Item[] = [];
  for (const id of w.game.world.entities.with(C.Item)) {
    const item = w.game.world.entities.get(id, C.Item);
    if (item?.type === t) out.push(item);
  }
  return out;
}

function units(w: TestWorld, type: string, material?: string): number {
  return itemsOf(w, type).filter((i) => material === undefined || i.material === materials.index(material)).reduce((n, i) => n + i.count, 0);
}

function order(w: TestWorld, workshopId: EntityId, recipeId: string, remaining = 1): void {
  expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId, order: { recipeId, mode: 'once', remaining, priority: 5 } })).toEqual({ ok: true });
}

function crafted(w: TestWorld, recipeId: string): number {
  return w.events('ItemCrafted').filter((e) => e['recipeId'] === recipeId).length;
}

/** A magma pool under the tile, at full level. */
function magmaUnder(w: TestWorld, at: TileIndex): void {
  const below = w.map.below(at);
  w.carve(below, TileKind.Open);
  w.setFluid(below, 7, 'magma', true);
}

describe('T-553 the rows', () => {
  it('the kiln is built of blocks with masonry, and the magma kiln is its variant with the same recipes', () => {
    const buildings = registry.table<{ id: string; inputs: { match: string; count: number }[]; labor: string; magmaVariantOf?: string; pattern?: string }>('buildings');
    expect(buildings.byId('kiln')).toMatchObject({ inputs: [{ match: 'stone_block', count: 3 }], labor: 'masonry', pattern: 'kiln' });
    expect(buildings.byId('magma_kiln')).toMatchObject({ magmaVariantOf: 'kiln', pattern: 'kiln' });
    const w = new TestWorld({ seed: 't553-rows', world: 'flat-test', embark: 'none' });
    const reader = w.readers.of<WorkshopsReader>('12');
    const kiln = reader.recipesFor('kiln').map((r) => r.id).sort();
    expect(kiln).toEqual(['burn_bone_ash', 'burn_potash', 'crush_fossil', 'fire_bricks', 'make_glass_block', 'make_glass_block_potash',
      'make_jug', 'make_mugs_clay', 'make_mugs_glass', 'make_pot']);
    expect(reader.recipesFor('magma_kiln').map((r) => r.id).sort()).toEqual(kiln);
    for (const id of kiln) expect(reader.recipe(id), id).toMatchObject({ skill: 'pottery', fuel: true });
  });

  it('pottery is a crafts skill whose profession is Potter', () => {
    expect(registry.table<{ id: string; labor: string; profession: string; attributes: string[] }>('skills').byId('pottery'))
      .toMatchObject({ labor: 'crafts', profession: 'Potter', attributes: ['agi', 'wit'] });
  });

  it('a pot is a barrel of 10, fired clay is fragile, brick and glass are magma-safe, bone ash is a flux and a fertilizer', () => {
    expect(items.byId('pot')).toMatchObject({ category: 'container/pot', capacity: 10, containerClass: 'barrel' });
    expect(items.byId('barrel')?.containerClass).toBe('barrel');
    expect(materials.byId('earthenware')?.tags).toContain('fragile');
    expect(materials.byId('earthenware')?.class).toBe('stone');
    expect(materials.byId('glass')?.class).toBe('glass');
    for (const m of ['brick', 'glass']) expect(materials.byId(m)?.meltsAtC, m).toBeGreaterThan(1200);
    expect(items.byId('bone_ash')?.tags).toEqual(['fertilizer', 'flux']);
    expect(items.byId('potash')?.category).toBe('farm/potash');
  });

  it('the Hillfolk bring bricks and pots, and pay 130% for glass', () => {
    const hillfolk = (caravanGoods as { civ: string; entries: { item: unknown; materials: { material: string }[] }[] }[]).find((g) => g.civ === 'hillfolk');
    expect(hillfolk?.entries.find((e) => e.item === 'pot')).toMatchObject({ materials: [{ material: 'earthenware' }], count: [2, 4], weight: 6 });
    expect(hillfolk?.entries.find((e) => e.item === 'stone_block')).toMatchObject({ materials: [{ material: 'brick' }], count: [5, 10], weight: 6 });
    expect(preferencePercent(registry, 'hillfolk', 'stone/block', 'glass', 'glass')).toBe(130);
    expect(preferencePercent(registry, 'mountainhome', 'stone/block', 'glass', 'glass')).toBe(60);
  });
});

describe('T-553 the kiln at work', () => {
  it('end to end: a kiln is built of blocks and fires a brick from a load of clay and a fuel', () => {
    const w = new TestWorld({ seed: 't553-kiln-e2e', world: 'flat-test', embark: 'none' });
    const at = w.index(15, 15, Z);
    w.spawnItem('stone_block', 'granite', w.index(20, 18, Z), 3);
    w.spawnDwarf({ at: w.index(19, 18, Z), skills: { masonry: 4, pottery: 2 } });
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'kiln', origin: at, orientation: 0 })).toEqual({ ok: true });
    const kiln = w.readers.of<{ byType(type: string): number[] }>('14').byType('kiln')[0] as EntityId;
    w.until(() => w.game.world.entities.get(kiln, C.Building)?.state === 'built', 3000);
    expect(w.game.world.entities.get(kiln, C.Building)?.state).toBe('built');
    w.spawnItem('soil_load', 'clay', w.index(21, 18, Z));
    w.spawnItem('charcoal_bar', 'charcoal', w.index(21, 19, Z));
    order(w, kiln, 'fire_bricks');
    w.until(() => crafted(w, 'fire_bricks') > 0, 3000);
    expect(units(w, 'stone_block', 'brick')).toBe(1);
    expect(units(w, 'soil_load')).toBe(0);
    expect(units(w, 'charcoal_bar')).toBe(0);
    const brick = w.events('ItemCrafted').find((e) => e['recipeId'] === 'fire_bricks');
    expect(w.readers.of<ItemsReader>('13').tileOf(brick?.['itemId'] as EntityId)).toBe(w.index(16, 17, Z));
  });

  it('without a fuel the kiln waits for one; the magma kiln fires glass with none', () => {
    const w = new TestWorld({ seed: 't553-magma-kiln', world: 'flat-test', embark: 'none' });
    const plain = w.build('kiln', w.index(15, 15, Z), 'granite');
    const hot = w.index(25, 15, Z);
    magmaUnder(w, hot);
    const magma = w.build('magma_kiln', hot, 'obsidian');
    w.spawnDwarf({ at: w.index(20, 18, Z), skills: { pottery: 5 } });
    w.spawnItem('soil_load', 'sand', w.index(21, 18, Z), 4);
    w.step(1);
    const reader = w.readers.of<WorkshopsReader>('12');
    expect(reader.isMagmaPowered(magma)).toBe(true);
    expect(reader.isRunnable('make_glass_block', plain).runnable).toBe(false);
    expect(reader.isRunnable('make_glass_block', magma).runnable).toBe(true);
    order(w, magma, 'make_glass_block', 2);
    w.until(() => crafted(w, 'make_glass_block') >= 2, 4000);
    expect(units(w, 'stone_block', 'glass')).toBe(2);
    expect(units(w, 'soil_load')).toBe(0);
  });

  it('potash doubles a glass batch, and glass mugs come from a glass block', () => {
    const w = new TestWorld({ seed: 't553-potash', world: 'flat-test', embark: 'none' });
    const hot = w.index(15, 15, Z);
    magmaUnder(w, hot);
    const kiln = w.build('magma_kiln', hot, 'obsidian');
    w.spawnDwarf({ at: w.index(20, 18, Z), skills: { pottery: 5 } });
    w.spawnItem('log', 'pine', w.index(21, 18, Z));
    w.spawnItem('soil_load', 'sand', w.index(21, 19, Z), 2);
    w.step(1);
    order(w, kiln, 'burn_potash');
    order(w, kiln, 'make_glass_block_potash');
    w.until(() => crafted(w, 'make_glass_block_potash') > 0, 4000);
    expect(units(w, 'potash', 'potash')).toBe(1);
    expect(units(w, 'stone_block', 'glass')).toBe(2);
    order(w, kiln, 'make_mugs_glass');
    w.until(() => crafted(w, 'make_mugs_glass') > 0, 4000);
    expect(units(w, 'mug', 'glass')).toBe(3);
    expect(units(w, 'stone_block', 'glass')).toBe(1);
  });

  it('bone ash from bones and from a crushed fossil makes steel at the smelter (make_steel_bone_ash)', () => {
    const w = new TestWorld({ seed: 't553-bone-ash-steel', world: 'flat-test', embark: 'none' });
    const hot = w.index(15, 15, Z);
    magmaUnder(w, hot);
    const kiln = w.build('magma_kiln', hot, 'obsidian');
    const smelter = w.build('smelter', w.index(25, 15, Z), 'granite');
    w.spawnDwarf({ at: w.index(20, 18, Z), skills: { pottery: 5, smelting: 5 } });
    w.spawnItem('bone_pile', 'bone', w.index(21, 18, Z), 2);
    w.spawnItem('fossil', 'giant_bone', w.index(21, 19, Z));
    w.spawnItem('bar', 'iron', w.index(22, 18, Z));
    w.spawnItem('charcoal_bar', 'charcoal', w.index(22, 19, Z), 2);
    w.step(1);
    order(w, kiln, 'burn_bone_ash');
    order(w, kiln, 'crush_fossil');
    w.until(() => crafted(w, 'crush_fossil') > 0 && crafted(w, 'burn_bone_ash') > 0, 4000);
    expect(units(w, 'bone_ash', 'bone')).toBe(3);
    // The kiln burned no fuel over magma; the smelter takes one for the job and one for the steel.
    expect(units(w, 'charcoal_bar')).toBe(2);
    expect(w.readers.of<WorkshopsReader>('12').isRunnable('make_steel_bone_ash', smelter).runnable).toBe(true);
    order(w, smelter, 'make_steel_bone_ash');
    w.until(() => crafted(w, 'make_steel_bone_ash') > 0, 4000);
    expect(units(w, 'bar', 'steel')).toBe(1);
    expect(units(w, 'bar', 'iron')).toBe(0);
    expect(units(w, 'bone_ash')).toBe(2);
    expect(units(w, 'charcoal_bar')).toBe(0);
  });

  it('pots, clay jugs and clay mugs are of earthenware', () => {
    const w = new TestWorld({ seed: 't553-clay', world: 'flat-test', embark: 'none' });
    const hot = w.index(15, 15, Z);
    magmaUnder(w, hot);
    const kiln = w.build('magma_kiln', hot, 'obsidian');
    w.spawnDwarf({ at: w.index(20, 18, Z), skills: { pottery: 5 } });
    w.spawnItem('soil_load', 'clay', w.index(21, 18, Z), 3);
    w.step(1);
    for (const r of ['make_pot', 'make_jug', 'make_mugs_clay']) order(w, kiln, r);
    w.until(() => crafted(w, 'make_mugs_clay') > 0, 4000);
    expect(units(w, 'pot', 'earthenware')).toBe(1);
    expect(units(w, 'bucket', 'earthenware')).toBe(1);
    expect(units(w, 'mug', 'earthenware')).toBe(3);
    const pot = w.events('ItemCrafted').find((e) => e['recipeId'] === 'make_pot')?.['itemId'] as EntityId;
    expect(w.readers.of<ItemsReader>('13').containerRecord(pot)).toMatchObject({ capacity: 10, classId: 'barrel' });
  });
});

describe('T-553 pots', () => {
  it('a brew into a pot makes the 10 drinks it holds', () => {
    const w = new TestWorld({ seed: 't553-pot-brew', world: 'flat-test', embark: 'none' });
    const still = w.build('still', w.index(15, 15, Z));
    w.spawnItem('plant_food', 'dimcap', w.index(19, 17, Z), 4);
    const pot = w.spawnItem('pot', 'earthenware', w.index(20, 17, Z));
    w.spawnDwarf({ at: w.index(18, 18, Z), skills: { brewing: 3 } });
    w.step(1);
    expect(w.readers.of<ItemsReader>('13').countAvailable({ emptyContainer: 'barrel' })).toBe(1);
    order(w, still, 'brew');
    w.until(() => crafted(w, 'brew') > 0, 3000);
    const reader = w.readers.of<ItemsReader>('13');
    expect(reader.containerRecord(pot)?.contents).toHaveLength(1);
    expect(units(w, 'drink')).toBe(10);
    expect(reader.room(pot)).toBe(0);
  });

  it('a hit breaks the pot and the clay jug its defender carries, and the drink in the pot; a miss, a wooden bucket and a pot on the ground do not break', () => {
    const w = new TestWorld({ seed: 't553-pot-breaks', world: 'flat-test', embark: 'none' });
    const tile = w.index(20, 18, Z);
    const hauler = w.spawnDwarf({ at: tile });
    const api = w.items;
    const pot = w.spawnItem('pot', 'earthenware', w.index(21, 18, Z));
    w.spawnItem('drink', 'ale', { containerId: pot }, 10);
    const jug = w.spawnItem('bucket', 'earthenware', w.index(21, 18, Z));
    const oakBucket = w.spawnItem('bucket', 'oak', w.index(21, 18, Z));
    const grounded = w.spawnItem('pot', 'earthenware', w.index(22, 18, Z));
    w.spawnItem('drink', 'ale', { containerId: grounded }, 5);
    for (const id of [pot, jug, oakBucket]) api.attachToCarrier(id, hauler);
    w.step(1);
    const miss = { type: 'AttackResolved', attackerId: 0, defenderId: hauler, targetId: hauler, part: 'torso', damageType: 'blunt', amount: 0 } as const;
    w.game.world.emit({ ...miss, outcome: 'miss' });
    w.step(1);
    expect(w.game.world.entities.alive(pot)).toBe(true);
    w.game.world.emit({ ...miss, amount: 3, outcome: 'hit' });
    w.step(2);
    expect(w.game.world.entities.alive(pot)).toBe(false);
    expect(w.game.world.entities.alive(jug)).toBe(false);
    expect(w.game.world.entities.alive(oakBucket)).toBe(true);
    const broken = w.events('ItemDestroyed').filter((e) => e['reason'] === 'broken').map((e) => e['itemType']).sort();
    expect(broken).toEqual(['bucket', 'drink', 'pot']);
    // The pot that stood on the ground holds its drink.
    expect(w.game.world.entities.alive(grounded)).toBe(true);
    expect(units(w, 'drink')).toBe(5);
  });

  it('what a broken pot holds that is not drink falls where its carrier stands', () => {
    const w = new TestWorld({ seed: 't553-pot-spills', world: 'flat-test', embark: 'none' });
    const tile = w.index(20, 18, Z);
    const hauler = w.spawnDwarf({ at: tile });
    const pot = w.spawnItem('pot', 'earthenware', tile);
    const meal = w.spawnItem('easy_meal', 'dimcap', { containerId: pot }, 4);
    w.items.attachToCarrier(pot, hauler);
    w.step(1);
    w.game.world.emit({ type: 'AttackResolved', attackerId: 0, defenderId: hauler, targetId: hauler, part: 'torso', damageType: 'edge', amount: 2, outcome: 'hit' });
    w.step(1);
    expect(w.game.world.entities.alive(pot)).toBe(false);
    expect(w.game.world.entities.alive(meal)).toBe(true);
    expect(w.readers.of<ItemsReader>('13').tileOf(meal)).toBe(tile);
    expect(units(w, 'easy_meal')).toBe(4);
  });

  it('a hauler hit while carrying a pot of ale to a stockpile loses the pot and the ale, and its haul ends', () => {
    const w = new TestWorld({ seed: 't553-pot-haul', world: 'flat-test', embark: 'default' });
    const tiles: TileIndex[] = [];
    for (let y = 20; y < 22; y += 1) for (let x = 50; x < 52; x += 1) tiles.push(w.index(x, y, Z));
    const sp = w.zone('stockpile', tiles);
    expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: sp, filter: 'drink' }).ok).toBe(true);
    const pot = w.spawnItem('pot', 'earthenware', w.index(44, 14, Z));
    w.spawnItem('drink', 'ale', { containerId: pot }, 10);
    const items13 = w.readers.of<ItemsReader>('13');
    w.until(() => (items13.get(pot)?.carriedBy ?? 0) !== 0, 3000);
    const hauler = items13.get(pot)?.carriedBy as EntityId;
    expect(hauler).toBeGreaterThan(0);
    const drinkBefore = units(w, 'drink');
    w.game.world.emit({ type: 'AttackResolved', attackerId: 0, defenderId: hauler, targetId: hauler, part: 'torso', damageType: 'blunt', amount: 1, outcome: 'hit' });
    w.step(2);
    expect(w.game.world.entities.alive(pot)).toBe(false);
    expect(units(w, 'drink')).toBe(drinkBefore - 10);
    w.step(200);
    const jobs = w.game.world.services.jobs as unknown as { jobs: Map<number, { workerId: number; data: Record<string, unknown> }> };
    expect(Array.from(jobs.jobs.values()).some((j) => j.data['itemId'] === pot)).toBe(false);
    expect(items13.carriedItems(hauler).filter((id) => !w.game.world.entities.alive(id))).toEqual([]);
  });
});
