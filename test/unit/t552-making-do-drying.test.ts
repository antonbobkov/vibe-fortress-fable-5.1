/**
 * T-552, Making Do B2: dung from pastured grazers, the drying rack, half fuels and their smoke,
 * curing, the smokehouse, salting and salted meals (`05` § Smoke; `08` § Dung; `12` § Fuel and
 * charcoal, § Smoke, salt and the smokehouse; `13` § Curing; `14` § The drying rack; `items.md`
 * § Drying).
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import caravanGoods from '@content/caravanGoods.json';
import { contentRegistry } from '@content/loader';
import { C, ItemFlag, type Item } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import { RACK_CAPACITY } from '@systems/buildings/constants';
import type { ItemsReader } from '@systems/items';
import type { MaterialsReader } from '@systems/materials';
import { SMOKE_RADIUS, SMOKE_TICKS } from '@systems/materials/constants';
import type { MoraleReader } from '@systems/morale';
import { eventPredicate, type ThoughtDef } from '@systems/morale/thoughts';
import { DUNG_DAYS } from '@systems/animals/constants';
import { mealName } from '@systems/workshops';
import { HALF_FUELS_PER_JOB, SMOKEHOUSE_HUNGER } from '@systems/workshops/constants';
import { preferencePercent } from '@systems/trade/valuation';
import { materialItemName } from '@ui/messages';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const items = registry.table<{ id: string; category: string; mult: number; rotDays: number; tags?: readonly string[] }>('items');
const materials = registry.table<{ id: string; burnable: boolean; tags?: readonly string[] }>('materials');
const Z = 32;
const UNDER = 25;

function b14(w: TestWorld): BuildingsReader {
  return w.readers.of<BuildingsReader>('14');
}

function units(w: TestWorld, type: string, material?: string): number {
  const t = items.index(type);
  let n = 0;
  for (const id of w.game.world.entities.with(C.Item)) {
    const it = w.game.world.entities.get(id, C.Item) as Item;
    if (it.type === t && (material === undefined || it.material === materials.index(material))) n += it.count;
  }
  return n;
}

function crafted(w: TestWorld, recipeId: string): GameEvent[] {
  return w.events('ItemCrafted').filter((e) => e['recipeId'] === recipeId);
}

function order(w: TestWorld, workshopId: EntityId, recipeId: string, remaining = 1): void {
  w.step(1);
  expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId, order: { recipeId, mode: 'once', remaining, priority: 5 } })).toEqual({ ok: true });
}

function thoughtIds(w: TestWorld, id: EntityId): string[] {
  const thoughts = registry.table('thoughts');
  return (w.game.world.entities.get(id, C.Mood)?.thoughts ?? []).map((t) => thoughts.byIndex(t.thought)?.id ?? '');
}

/** A dug room under the surface, discovered, and its tiles (a roof over it). */
function room(w: TestWorld, x: number, y: number, width: number, height: number): TileIndex[] {
  w.digRoom(x, y, UNDER, width, height);
  for (let yy = y - 1; yy <= y + height; yy += 1) for (let xx = x - 1; xx <= x + width; xx += 1) w.discover(w.index(xx, yy, UNDER));
  const out: TileIndex[] = [];
  for (let yy = y; yy < y + height; yy += 1) for (let xx = x; xx < x + width; xx += 1) out.push(w.index(xx, yy, UNDER));
  return out;
}

function system14(w: TestWorld): BuildingsSystem {
  return w.game.world.scheduler.byId('14') as BuildingsSystem;
}

function tickContext(w: TestWorld): TickContext {
  return { world: w.game.world, registry: w.game.registry, spawn: w.game.world.services.spawn, tick: w.tick,
    emit: (event: GameEvent) => w.game.world.emit(event) } as unknown as TickContext;
}

/** One drying day for every rack, with the day's weather as given. */
function dryDay(w: TestWorld, day: { notClear: boolean; wet: boolean }): void {
  const racks = system14(w).racks;
  racks.day = { ...day };
  racks.dayPassed(tickContext(w));
}

/** Hold an item on a rack as 13's delivery does (`Building.held`, installed). */
function hold(w: TestWorld, rack: EntityId, item: EntityId): void {
  w.items.install?.(item);
  const b = w.game.world.entities.get(rack, C.Building);
  if (b === undefined) throw new Error('no rack');
  w.game.world.entities.add(rack, C.Building, { ...b, held: [...(b.held ?? []), item] });
}

describe('T-552 the rows', () => {
  it('cured meat and fish and salted hides never rot and are worth twice; half fuels are smoky; dung is a fertilizer', () => {
    for (const id of ['cured_meat', 'cured_fish']) expect(items.byId(id), id).toMatchObject({ rotDays: 0, mult: 2000, tags: ['ingredient'] });
    expect(items.byId('salted_hide')).toMatchObject({ category: 'textile/hide', rotDays: 0 });
    for (const id of ['peat_brick', 'dung_cake']) expect(items.byId(id)?.tags, id).toEqual(['fuel_half', 'smoky']);
    expect(items.byId('dung')).toMatchObject({ category: 'farm/dung', tags: ['fertilizer'] });
    expect(materials.byId('dung')).toMatchObject({ burnable: true, tags: ['fertilizer'] });
    expect(registry.table<{ id: string; inputs: { match: string }[] }>('recipes').byId('tan_hide')?.inputs[0]?.match).toBe('raw_hide|salted_hide');
  });

  it('the drying table, the rack, the smokehouse and its recipes, the salting at the kitchen', () => {
    const drying = registry.table<{ id: string }>('drying');
    expect([...drying.ids()].sort()).toEqual(['dry_dung', 'dry_fish', 'dry_meat', 'dry_peat', 'salt_hide']);
    expect(drying.byId('dry_peat')).toMatchObject({ input: 'soil_load', material: 'peat', count: 1, output: { item: 'peat_brick', count: 1 }, days: 7 });
    expect(drying.byId('dry_dung')).toMatchObject({ input: 'dung', count: 3, output: { item: 'dung_cake', count: 1 }, days: 7 });
    expect(drying.byId('salt_hide')).toMatchObject({ input: 'raw_hide', with: { item: 'salt', count: 1 }, output: { item: 'salted_hide' }, days: 5 });
    const buildings = registry.table<{ id: string }>('buildings');
    expect(buildings.byId('drying_rack')).toMatchObject({ category: 'special', tags: ['rack'], passable: false, value: 3, labor: 'construction',
      inputs: [{ match: 'log|stone_block|bone_pile', count: 2 }], wants: [{ match: 'drying', count: RACK_CAPACITY }] });
    expect(buildings.byId('smokehouse')).toMatchObject({ category: 'workshop', inputs: [{ match: 'stone_block', count: 3 }], labor: 'masonry', pattern: 'smokehouse' });
    const recipes = registry.table<{ id: string }>('recipes');
    for (const id of ['smoke_meat', 'smoke_fish']) expect(recipes.byId(id), id).toMatchObject({ workshop: 'smokehouse', skill: 'cooking', fuel: true });
    expect(recipes.byId('salt_meat')).toMatchObject({ workshop: 'kitchen', fuel: false, inputs: [{ match: 'raw_meat', count: 5, sameMaterial: true }, { match: 'salt', count: 1 }],
      outputs: [{ item: 'cured_meat', count: 5 }] });
    expect(recipes.byId('salt_fish')).toMatchObject({ workshop: 'kitchen', outputs: [{ item: 'cured_fish', count: 5 }] });
  });

  it('the Hillfolk bring dung in sacks and cured meat, and pay 120% for cured meat and fish', () => {
    const hillfolk = (caravanGoods as { civ: string; entries: { item: unknown; materials: { material: string }[]; container?: string }[] }[]).find((g) => g.civ === 'hillfolk');
    expect(hillfolk?.entries.find((e) => e.item === 'dung')).toMatchObject({ materials: [{ material: 'dung' }], weight: 6, container: 'bag', sundries: true, units: 10 });
    expect(hillfolk?.entries.find((e) => e.item === 'cured_meat')).toMatchObject({ weight: 6, sundries: true, units: 10 });
    expect(preferencePercent(registry, 'hillfolk', 'food/meat/cured', 'cow_meat', 'meat')).toBe(120);
    expect(preferencePercent(registry, 'hillfolk', 'food/fish/cured', 'trout_meat', 'meat')).toBe(120);
    expect(preferencePercent(registry, 'hillfolk', 'food/meat/raw', 'cow_meat', 'meat')).toBe(80);
  });

  it('a cured or salted item names itself so', () => {
    expect(materialItemName('boar meat', { name: 'cured meat' })).toBe('cured boar meat');
    expect(materialItemName('trout', { name: 'cured fish' })).toBe('cured trout');
    expect(materialItemName('boar hide', { name: 'salted hide' })).toBe('salted boar hide');
    expect(materialItemName('boar meat', { name: 'raw meat' })).toBe('boar meat raw meat');
  });
});

describe('T-552 half fuels and smoke', () => {
  /** A kiln with a potter beside it and a clay load; `fuel` lists what lies by the kiln. */
  function kiln(seed: string, fuel: readonly [string, string, number][]): { w: TestWorld; kiln: EntityId; potter: EntityId; near: EntityId; far: EntityId } {
    const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
    const at = w.index(15, 15, Z);
    const id = w.build('kiln', at, 'granite');
    const potter = w.spawnDwarf({ at: w.index(20, 18, Z), skills: { pottery: 5 } });
    w.spawnItem('soil_load', 'clay', w.index(21, 18, Z));
    for (const [type, material, n] of fuel) w.spawnItem(type, material, w.index(22, 18, Z), n);
    // An idle onlooker in the smoke's reach and one out of it; neither works the kiln.
    const near = w.spawnDwarf({ at: w.index(14, 16, Z) });
    const far = w.spawnDwarf({ at: w.index(30, 30, Z) });
    for (const d of [near, far]) for (const labor of ['pottery', 'hauling', 'crafts']) w.setLabor(d, labor, false);
    return { w, kiln: id, potter, near, far };
  }

  it('with no bar, two peat bricks fire a brick, the kiln smokes for half a day and everyone within 3 tiles thinks the hall is full of smoke', () => {
    const { w, kiln: id, near, far } = kiln('t552-peat', [['peat_brick', 'peat', 3]]);
    order(w, id, 'fire_bricks');
    // Who stands within the smoke's reach when the job completes.
    let inReach: EntityId[] = [];
    w.game.world.onEvents?.((events: readonly GameEvent[]) => {
      if (!events.some((e) => e.type === 'SmokyFuelBurned')) return;
      inReach = [near, far].filter((d) => {
        const p = w.game.world.entities.get(d, C.Position);
        return p !== undefined && p.z === Z && Math.max(Math.abs(p.x - 16), Math.abs(p.y - 16)) <= SMOKE_RADIUS;
      });
    });
    w.until((v) => crafted(v, 'fire_bricks').length > 0, 4000);
    expect(units(w, 'stone_block', 'brick')).toBe(1);
    expect(units(w, 'peat_brick')).toBe(3 - HALF_FUELS_PER_JOB);
    const smoke = w.events('SmokyFuelBurned');
    expect(smoke.length).toBe(1);
    const centre = w.index(16, 16, Z);
    expect(smoke[0]).toMatchObject({ workshopId: id, tile: centre });
    w.step(10);
    const materials05 = w.readers.of<MaterialsReader>('05');
    expect(materials05.isSmoky(centre)).toBe(true);
    expect(materials05.isSmoky(w.index(16 + SMOKE_RADIUS, 16, Z))).toBe(true);
    expect(materials05.isSmoky(w.index(16 + SMOKE_RADIUS + 1, 16, Z))).toBe(false);
    expect(materials05.isSmoky(w.index(16, 16, Z - 1))).toBe(false);
    expect(inReach).toContain(near);
    expect(inReach).not.toContain(far);
    expect(thoughtIds(w, near)).toContain('smoky_hall');
    expect(thoughtIds(w, far)).not.toContain('smoky_hall');
    // Saved and loaded, the smoke stays; it clears after `SMOKE_TICKS`.
    expect(roundTrip(w.game).game.world.readers.of<MaterialsReader>('05').isSmoky(centre)).toBe(true);
    w.step(SMOKE_TICKS);
    expect(materials05.isSmoky(centre)).toBe(false);
  });

  it('bars are burned first: with a charcoal bar and peat bricks to hand, the bar burns and nothing smokes', () => {
    const { w, kiln: id } = kiln('t552-bars-first', [['charcoal_bar', 'charcoal', 1], ['peat_brick', 'peat', 2]]);
    order(w, id, 'fire_bricks');
    w.until((v) => crafted(v, 'fire_bricks').length > 0, 4000);
    expect(units(w, 'charcoal_bar')).toBe(0);
    expect(units(w, 'peat_brick')).toBe(2);
    expect(w.events('SmokyFuelBurned').length).toBe(0);
  });

  it('one half fuel is not enough: the kiln waits for fuel', () => {
    const { w, kiln: id } = kiln('t552-one-half', [['dung_cake', 'dung', 1]]);
    w.step(1);
    expect(w.readers.of<{ isRunnable(r: string, id: EntityId): { runnable: boolean } }>('12').isRunnable('fire_bricks', id).runnable).toBe(false);
    w.spawnItem('dung_cake', 'dung', w.index(22, 19, Z));
    w.step(1);
    expect(w.readers.of<{ isRunnable(r: string, id: EntityId): { runnable: boolean } }>('12').isRunnable('fire_bricks', id).runnable).toBe(true);
  });
});

describe('T-552 the smokehouse and salt', () => {
  it('smoking five boar meat makes five cured boar meat that never rot; a dwarf nearby smells it and is hungrier', () => {
    const w = new TestWorld({ seed: 't552-smokehouse', world: 'flat-test', embark: 'none' });
    const id = w.build('smokehouse', w.index(15, 15, Z), 'granite');
    const cook = w.spawnDwarf({ at: w.index(20, 18, Z), skills: { cooking: 5 } });
    w.spawnItem('raw_meat', 'boar_meat', w.index(21, 18, Z), 5);
    w.spawnItem('charcoal_bar', 'charcoal', w.index(22, 18, Z));
    const by = w.spawnDwarf({ at: w.index(17, 18, Z) });
    for (const labor of ['cooking', 'hauling', 'crafts', 'butchery']) w.setLabor(by, labor, false);
    w.setNeed(by, 'hunger', 10);
    order(w, id, 'smoke_meat');
    w.until((v) => crafted(v, 'smoke_meat').length > 0, 4000);
    expect(units(w, 'cured_meat', 'boar_meat')).toBe(5);
    expect(units(w, 'raw_meat')).toBe(0);
    expect(w.events('SmokyFuelBurned').length).toBe(0);
    const event = crafted(w, 'smoke_meat')[0] as GameEvent;
    expect(event['crafterId']).toBe(cook);
    const at = w.game.world.entities.get(by, C.Position);
    const within = at !== undefined && at.z === Z && Math.max(Math.abs(at.x - 16), Math.abs(at.y - 16)) <= SMOKE_RADIUS;
    expect(within).toBe(true);
    expect(thoughtIds(w, by)).toContain('smelled_smokehouse');
    expect(thoughtIds(w, cook)).not.toContain('smelled_smokehouse');
    const view = w.readers.of<MoraleReader>('15').thoughts(by).find((t) => t.id === 'smelled_smokehouse');
    expect(view?.text).toBe('Smells of smoked boar. Hungry now.');
    expect(w.game.world.entities.get(by, C.Needs)?.hunger ?? 0).toBeGreaterThanOrEqual(10 + SMOKEHOUSE_HUNGER);
    // The thought's word is saved with it.
    const loaded = roundTrip(w.game).game;
    expect(loaded.world.readers.of<MoraleReader>('15').thoughts(by).find((t) => t.id === 'smelled_smokehouse')?.text).toBe('Smells of smoked boar. Hungry now.');
    // Cured meat has no rot timer: a month on the ground leaves it fresh.
    const cured = event['itemId'] as EntityId;
    w.step(30 * TICKS_PER_DAY / 10);
    expect(w.readers.of<ItemsReader>('13').get(cured)?.rotStage ?? 0).toBe(0);
  });

  it('the kitchen salts five raw fish with one salt and no fuel', () => {
    const w = new TestWorld({ seed: 't552-salt', world: 'flat-test', embark: 'none' });
    const id = w.build('kitchen', w.index(15, 15, Z), 'granite');
    w.spawnDwarf({ at: w.index(20, 18, Z), skills: { cooking: 5 } });
    w.spawnItem('raw_fish', 'trout_meat', w.index(21, 18, Z), 5);
    w.spawnItem('salt', 'salt', w.index(22, 18, Z), 2);
    order(w, id, 'salt_fish');
    w.until((v) => crafted(v, 'salt_fish').length > 0, 4000);
    expect(units(w, 'cured_fish', 'trout_meat')).toBe(5);
    expect(units(w, 'salt')).toBe(1);
  });

  it('a meal seasoned with salt is "salted …", and its eater thinks it was well salted', () => {
    const w = new TestWorld({ seed: 't552-salted-meal', world: 'flat-test', embark: 'none' });
    const meal = w.spawnItem('easy_meal', 'boar_meat', w.index(10, 10, Z), 1, 2);
    const plain = mealName(w.game.world.entities, registry, meal) ?? '';
    const it = w.game.world.entities.get(meal, C.Item) as Item;
    w.game.world.entities.add(meal, C.Item, { ...it, seasoned: [materials.index('salt')] });
    expect(mealName(w.game.world.entities, registry, meal)).toBe(`salted ${plain}`);
    const def = registry.table<ThoughtDef>('thoughts').byId('ate_salted_meal') as ThoughtDef;
    expect(def).toMatchObject({ value: 1, hours: 24, trigger: { event: 'MealEaten' } });
    expect(eventPredicate(def, { type: 'MealEaten', id: 1, seasoned: ['salt'] }, registry)).toBe(true);
    expect(eventPredicate(def, { type: 'MealEaten', id: 1, seasoned: ['wyrmtongue'] }, registry)).toBe(false);
    expect(eventPredicate(def, { type: 'MealEaten', id: 1 }, registry)).toBe(false);
  });
});

describe('T-552 the drying rack', () => {
  it('haulers fill a rack under a roof with up to 5 units of its rows (a peat load, not any soil), and a held raw item does not rot', () => {
    const w = new TestWorld({ seed: 't552-rack-fill', world: 'flat-test', embark: 'none' });
    const tiles = room(w, 10, 30, 5, 3);
    const rack = w.build('drying_rack', tiles[2] as TileIndex, 'oak');
    w.spawnDwarf({ at: tiles[10] as TileIndex });
    w.spawnItem('soil_load', 'clay', tiles[13] as TileIndex, 1);
    const peat = w.spawnItem('soil_load', 'peat', tiles[14] as TileIndex, 1);
    const meat = w.spawnItem('raw_meat', 'boar_meat', tiles[12] as TileIndex, 3);
    w.until((v) => b14(v).held(rack).length >= 2, 2000);
    const held = b14(w).held(rack);
    expect(held.sort((a, b) => a - b)).toEqual([peat, meat].sort((a, b) => a - b));
    for (const it of held) expect(((w.readers.of<ItemsReader>('13').get(it)?.flags ?? 0) & ItemFlag.Installed) !== 0).toBe(true);
    // Four units held: room for one more, and the clay load is no peat.
    expect(b14(w).holderWants(rack).filter((want) => want.pool !== undefined).every((want) => want.count === RACK_CAPACITY)).toBe(true);
    expect(units(w, 'soil_load', 'clay')).toBe(1);
    expect(b14(w).rackItems(rack).map((r) => r.row).sort()).toEqual(['dry_meat', 'dry_peat']);
    // A day of hauling later the meat has not begun to rot.
    w.step(TICKS_PER_DAY);
    expect(w.readers.of<ItemsReader>('13').get(meat)?.rotStage).toBe(0);
  });

  it('under a roof a peat load is a brick in 7 days; outdoors a clear day counts twice and a wet one not at all', () => {
    const w = new TestWorld({ seed: 't552-rack-days', world: 'flat-test', embark: 'none' });
    const tiles = room(w, 10, 30, 4, 3);
    const inside = w.build('drying_rack', tiles[0] as TileIndex, 'oak');
    const outside = w.build('drying_rack', w.index(10, 10, Z), 'oak');
    const wet = w.build('drying_rack', w.index(14, 10, Z), 'oak');
    const peat = (at: TileIndex): EntityId => w.spawnItem('soil_load', 'peat', at, 1);
    hold(w, inside, peat(tiles[1] as TileIndex));
    hold(w, outside, peat(w.index(11, 10, Z)));
    const soaked = peat(w.index(15, 10, Z));
    hold(w, wet, soaked);
    // Three clear days: the outdoor racks gain 6, the indoor one 3.
    for (let d = 0; d < 3; d += 1) {
      // The wet rack's tile is rained on: run it apart below.
      dryDay(w, { notClear: false, wet: false });
    }
    expect(b14(w).rackItems(inside)[0]).toMatchObject({ days: 3, left: 4 });
    expect(b14(w).rackItems(outside)[0]).toMatchObject({ days: 6, left: 1 });
    // A rainy day: outdoors nothing, indoors a day.
    dryDay(w, { notClear: true, wet: true });
    expect(b14(w).rackItems(outside)[0]).toMatchObject({ days: 6 });
    expect(b14(w).rackItems(inside)[0]).toMatchObject({ days: 4 });
    // An overcast dry day: one everywhere. The outdoor peat is a brick.
    dryDay(w, { notClear: true, wet: false });
    expect(b14(w).held(outside)).toEqual([]);
    expect(b14(w).held(wet)).toEqual([]);
    expect(units(w, 'peat_brick', 'peat')).toBe(2);
    const brick = w.game.world.entities.with(C.Item).find((it) => w.game.world.entities.get(it, C.Item)?.type === items.index('peat_brick')) as EntityId;
    expect(w.readers.of<ItemsReader>('13').tileOf(brick)).toBeGreaterThanOrEqual(0);
    expect(((w.readers.of<ItemsReader>('13').get(brick)?.flags ?? 0) & ItemFlag.Installed)).toBe(0);
    // Saved with its days.
    expect(roundTrip(w.game).game.world.readers.of<BuildingsReader>('14').rackItems(inside)[0]).toMatchObject({ days: 5, left: 2 });
    dryDay(w, { notClear: true, wet: true });
    dryDay(w, { notClear: true, wet: true });
    expect(b14(w).held(inside)).toEqual([]);
    expect(units(w, 'peat_brick', 'peat')).toBe(3);
  });

  it('stepped: under a roof a held peat load is a brick after 7 DayPassed, and the rack keeps its day record while it stands', () => {
    const w = new TestWorld({ seed: 't552-rack-stepped', world: 'flat-test', embark: 'none' });
    const tiles = room(w, 10, 30, 4, 3);
    const rack = w.build('drying_rack', tiles[0] as TileIndex, 'oak');
    hold(w, rack, w.spawnItem('soil_load', 'peat', tiles[1] as TileIndex, 1));
    w.step(6 * TICKS_PER_DAY + 20);
    expect(units(w, 'peat_brick')).toBe(0);
    expect(b14(w).rackItems(rack)[0]).toMatchObject({ row: 'dry_peat', left: 1 });
    expect(system14(w).serialize().rackDay).toBeDefined();
    w.step(TICKS_PER_DAY);
    expect(units(w, 'peat_brick', 'peat')).toBe(1);
    expect(b14(w).held(rack)).toEqual([]);
  });

  it('the day record follows the weather: one hour of rain makes a wet day', () => {
    const w = new TestWorld({ seed: 't552-rack-weather', world: 'flat-test', embark: 'none' });
    w.build('drying_rack', w.index(10, 10, Z), 'oak');
    const racks = system14(w).racks;
    racks.day = null;
    racks.weatherChanged('clear', 'clear');
    expect(racks.day).toEqual({ notClear: false, wet: false });
    racks.weatherChanged('clear', 'overcast');
    expect(racks.day).toEqual({ notClear: true, wet: false });
    racks.weatherChanged('overcast', 'rain');
    racks.weatherChanged('rain', 'clear');
    expect(racks.day).toEqual({ notClear: true, wet: true });
  });

  it('three dung dry to one cake; a dry remainder waits; a hide is salted only with salt on the rack', () => {
    const w = new TestWorld({ seed: 't552-rack-dung', world: 'flat-test', embark: 'none' });
    const tiles = room(w, 10, 30, 4, 3);
    const rack = w.build('drying_rack', tiles[0] as TileIndex, 'oak');
    for (let k = 0; k < 4; k += 1) hold(w, rack, w.spawnItem('dung', 'dung', tiles[1] as TileIndex, 1));
    const hide = w.spawnItem('raw_hide', 'cow_hide', tiles[2] as TileIndex, 1);
    hold(w, rack, hide);
    expect(b14(w).holderWants(rack).find((want) => want.types.includes(items.index('salt')))).toMatchObject({ count: 1 });
    for (let d = 0; d < 7; d += 1) dryDay(w, { notClear: true, wet: false });
    expect(units(w, 'dung_cake', 'dung')).toBe(1);
    expect(b14(w).rackItems(rack).filter((r) => r.row === 'dry_dung')).toEqual([expect.objectContaining({ left: 0 })]);
    // The hide waits for its salt, and does not rot.
    expect(units(w, 'salted_hide')).toBe(0);
    expect(w.readers.of<ItemsReader>('13').get(hide)?.rotStage).toBe(0);
    hold(w, rack, w.spawnItem('salt', 'salt', tiles[3] as TileIndex, 1));
    dryDay(w, { notClear: true, wet: false });
    expect(units(w, 'salted_hide', 'cow_hide')).toBe(1);
    expect(units(w, 'salt')).toBe(0);
  });

  it('SetRackDrying: the rows it takes; a held item no row takes drops on its tile; bad rows are refused', () => {
    const w = new TestWorld({ seed: 't552-rack-setting', world: 'flat-test', embark: 'none' });
    const tiles = room(w, 10, 30, 4, 3);
    const rack = w.build('drying_rack', tiles[0] as TileIndex, 'oak');
    const meat = w.spawnItem('raw_meat', 'boar_meat', tiles[1] as TileIndex, 2);
    const peat = w.spawnItem('soil_load', 'peat', tiles[1] as TileIndex, 1);
    hold(w, rack, meat);
    hold(w, rack, peat);
    expect(b14(w).rackDrying(rack)).toEqual(['dry_peat', 'dry_dung', 'dry_fish', 'dry_meat', 'salt_hide']);
    expect(w.game.world.applyCommand({ type: 'SetRackDrying', buildingId: rack, rows: ['dry_peat', 'nonsense'] })).toMatchObject({ ok: false, reason: 'bad_setting' });
    expect(w.game.world.applyCommand({ type: 'SetRackDrying', buildingId: 99999, rows: [] })).toMatchObject({ ok: false, reason: 'not_found' });
    expect(w.game.world.applyCommand({ type: 'SetRackDrying', buildingId: rack, rows: ['dry_peat'] })).toEqual({ ok: true });
    expect(b14(w).rackDrying(rack)).toEqual(['dry_peat']);
    expect(b14(w).held(rack)).toEqual([peat]);
    expect(((w.readers.of<ItemsReader>('13').get(meat)?.flags ?? 0) & ItemFlag.Installed)).toBe(0);
    expect(w.readers.of<ItemsReader>('13').tileOf(meat)).toBe(tiles[0]);
    expect(b14(w).holderWants(rack).map((want) => want.types)).toEqual([[items.index('soil_load')]]);
    // Every row again is the default: the setting goes.
    expect(w.game.world.applyCommand({ type: 'SetRackDrying', buildingId: rack, rows: ['salt_hide', 'dry_meat', 'dry_fish', 'dry_dung', 'dry_peat'] })).toEqual({ ok: true });
    expect(w.game.world.entities.get(rack, C.Building)?.settings['drying']).toBeUndefined();
    // Taken out, its days go with it.
    dryDay(w, { notClear: true, wet: false });
    expect(w.game.world.entities.get(rack, C.Building)?.dryDays).toEqual([[peat, 1]]);
    expect(w.game.world.applyCommand({ type: 'ReleaseHeld', buildingId: rack })).toEqual({ ok: true });
    expect(w.game.world.entities.get(rack, C.Building)?.dryDays).toBeUndefined();
  });
});

describe('T-552 dung', () => {
  it('a pastured cow drops one dung every 7 days on its tile, a cow on no pasture none', () => {
    const w = new TestWorld({ seed: 't552-dung', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const own: TileIndex[] = [];
    for (let y = 5; y < 13; y += 1) for (let x = 5; x < 13; x += 1) own.push(w.index(x, y, Z));
    const zone = w.zone('pasture', own);
    const cow = w.spawnTame('cow', own[0] as TileIndex, { sex: 1 });
    w.spawnTame('cow', w.index(25, 25, Z), { sex: 1 });
    expect(w.game.world.applyCommand({ type: 'AssignPasture', animalId: cow, zoneId: zone }).ok).toBe(true);
    w.step(2 * DUNG_DAYS * TICKS_PER_DAY + 20);
    expect(units(w, 'dung', 'dung')).toBe(2);
    for (const id of w.game.world.entities.with(C.Item)) {
      const it = w.game.world.entities.get(id, C.Item) as Item;
      if (it.type !== items.index('dung')) continue;
      expect(own).toContain(w.readers.of<ItemsReader>('13').tileOf(id));
    }
  });
});
