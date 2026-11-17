/**
 * T-555, Making Do B5: beehives, the flower tiles, honeycomb from spring to autumn, `collect_honey`,
 * stings, honey and beeswax at the farmer's workshop, mead, and honey as a wound dressing
 * (`07` § Flowers; `08` § Hives; `14` § Special buildings; `17` § Patients and hospitals; `20` § Sundries).
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C, ItemFlag, type Item } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { flowerTile } from '@core/flowers';
import type { GameEvent } from '@core/events';
import { TileFlag } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { Hives, type AnimalsReader } from '@systems/animals';
import {
  HIVE_CAPACITY, HIVE_DAYS, HIVE_FLOWERS_MIN, HIVE_FLOWER_RADIUS, HIVE_PASSER_PERMILLE, HIVE_STING_RADIUS, STING_PERMILLE,
} from '@systems/animals/constants';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import type { PlantsReader } from '@systems/plants';
import { eventPredicate, type ThoughtDef } from '@systems/morale/thoughts';
import { eligibleGoodsEntries } from '@systems/trade/goods';
import { preferencePercent } from '@systems/trade/valuation';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const items = registry.table<{ id: string; category: string; edible?: boolean; tags?: readonly string[] }>('items');
const materials = registry.table<{ id: string; class: string; value: number; burnable: boolean; tags?: readonly string[] }>('materials');
const UNDER = 25;
const LABORS = registry.table<{ id: string }>('labors').ids();
const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

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

function order(w: TestWorld, workshopId: EntityId, recipeId: string): void {
  w.step(1);
  expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId, order: { recipeId, mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
}

/** A worker with only `labor` on and no needs pressing. */
function worker(w: TestWorld, at: TileIndex, labor: string, skills: Record<string, number> = {}): EntityId {
  const id = w.spawnDwarf({ at, skills });
  for (const l of LABORS) w.setLabor(id, l, l === labor);
  for (const need of NEEDS) w.setNeed(id, need, 0);
  return id;
}

/** Grass over the surface square [x0, x1] × [y0, y1]: a meadow whose flowers are the biome's share. */
function meadow(w: TestWorld, x0: number, y0: number, x1: number, y1: number): void {
  const map = w.game.world.map;
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
    const i = w.index(x, y, Z);
    map.flags[i] = (map.flags[i] ?? 0) | TileFlag.Grass;
  }
}

/** The surface tile in [20, 40)² with the most flowers in a hive's reach. */
function flowerySpot(w: TestWorld): TileIndex {
  const plants = w.readers.of<PlantsReader>('07');
  let best = -1;
  let bestN = -1;
  for (let y = 20; y < 40; y += 1) for (let x = 20; x < 40; x += 1) {
    let n = 0;
    for (let yy = y - HIVE_FLOWER_RADIUS; yy <= y + HIVE_FLOWER_RADIUS; yy += 1)
      for (let xx = x - HIVE_FLOWER_RADIUS; xx <= x + HIVE_FLOWER_RADIUS; xx += 1) if (plants.flowerAt(w.index(xx, yy, Z))) n += 1;
    if (n > bestN && !plants.flowerAt(w.index(x, y, Z))) { best = w.index(x, y, Z); bestN = n; }
  }
  return best;
}

describe('T-555 the rows', () => {
  it('honey, honeycomb and beeswax are food leaves; honey is an ingredient and edible, beeswax is not; the beehive is furniture', () => {
    expect(items.byId('honey')).toMatchObject({ category: 'food/honey', edible: true });
    expect(items.byId('honey')?.tags).toContain('ingredient');
    expect(items.byId('honeycomb')).toMatchObject({ category: 'food/honeycomb', edible: true });
    expect(items.byId('beeswax')?.category).toBe('food/wax');
    expect(items.byId('beeswax')?.edible).toBeUndefined();
    expect(items.byId('beehive')?.category).toBe('furniture/beehive');
    const hive = registry.table<{ id: string; on: string; tags: readonly string[]; passable: boolean }>('buildings').byId('beehive');
    expect(hive).toMatchObject({ on: 'an outdoor soil floor', passable: false });
    expect(hive?.tags).toEqual(['hive']);
    expect(materials.byId('honey')).toMatchObject({ class: 'liquid', value: 6 });
    expect(materials.byId('beeswax')).toMatchObject({ class: 'liquid', value: 4, burnable: true });
    expect(materials.byId('mead')).toMatchObject({ class: 'liquid', value: 5 });
    expect(materials.byId('mead')?.tags).toEqual(['drink', 'wine']);
  });

  it('the hive recipes, the press, mead, the job, the thought and the hint', () => {
    const recipes = registry.table<{ id: string; workshop: string; skill: string }>('recipes');
    expect(recipes.byId('make_hive_wood')?.workshop).toBe('carpenter');
    expect(recipes.byId('make_hive_clay')?.workshop).toBe('kiln');
    expect(recipes.byId('weave_hive')?.workshop).toBe('craftdwarf');
    expect(recipes.byId('press_honeycomb')).toMatchObject({ workshop: 'farmers_workshop', skill: 'animal_care' });
    expect(recipes.byId('brew_mead')).toMatchObject({ workshop: 'still', skill: 'brewing' });
    // The wax candles make T-563's candle: they came with it.
    expect(recipes.byId('make_candles_wax')?.workshop).toBe('craftdwarf');
    expect(registry.table<{ id: string; labor: string; xp: number }>('jobTypes').byId('collect_honey')).toMatchObject({ labor: 'animal_care', xp: 4 });
    const thought = registry.table<ThoughtDef>('thoughts').byId('stung') as ThoughtDef;
    expect(thought.text).toBe('Stung. The bees were not consulted.');
    expect(eventPredicate(thought, { type: 'Stung', id: 1, source: 'bees' }, registry)).toBe(true);
    expect(eventPredicate(thought, { type: 'Stung', id: 1, source: 'nettle' }, registry)).toBe(false);
    const nettles = registry.table<ThoughtDef>('thoughts').byId('nettles') as ThoughtDef;
    expect(eventPredicate(nettles, { type: 'Stung', id: 1, source: 'bees' }, registry)).toBe(false);
    expect(registry.table<{ id: string; text: string }>('hints').byId('hint_hive')?.text).toContain('three within six tiles');
  });

  it('the Wildwood bring honey and beeswax and pay 100 for them; the Hillfolk bring honey only when the Wildwood are farther', () => {
    const goods = (civ: 'hillfolk' | 'wildwood', wildwoodFarther?: boolean): string[] =>
      eligibleGoodsEntries(registry, civ, 0, wildwoodFarther === undefined ? {} : { wildwoodFarther })
        .filter((e) => e.sundries === true).flatMap((e) => (Array.isArray(e.item) ? e.item : [e.item]));
    expect(goods('wildwood')).toEqual(expect.arrayContaining(['honey', 'beeswax']));
    expect(goods('hillfolk')).not.toContain('honey');
    expect(goods('hillfolk', false)).not.toContain('honey');
    expect(goods('hillfolk', true)).toContain('honey');
    expect(preferencePercent(registry, 'wildwood', 'food/honey', 'honey', 'liquid')).toBe(100);
    expect(preferencePercent(registry, 'wildwood', 'food/wax', 'beeswax', 'liquid')).toBe(100);
    expect(preferencePercent(registry, 'wildwood', 'food/cheese', 'cheese', 'meat')).toBe(110);
  });
});

describe('T-555 flowers', () => {
  it('a flower is an outdoor grass floor the biome share picks, the compositor\'s test; snow and a missing grass hide it', () => {
    const w = new TestWorld({ seed: 't555-flowers', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const plants = w.readers.of<PlantsReader>('07');
    const share = registry.table<{ id: string; surface?: { flowers?: number } }>('biomes').byId('temperate_grassland')?.surface?.flowers ?? 0;
    expect(share).toBeGreaterThan(0);
    // No grass, no flower.
    let picked = -1;
    for (let x = 0; x < 60 && picked < 0; x += 1) if (flowerTile(share, x, 10, Z)) picked = w.index(x, 10, Z);
    expect(picked).toBeGreaterThanOrEqual(0);
    expect(plants.flowerAt(picked)).toBe(false);
    meadow(w, 0, 10, 60, 10);
    let n = 0;
    for (let x = 0; x <= 60; x += 1) {
      const i = w.index(x, 10, Z);
      expect(plants.flowerAt(i)).toBe(flowerTile(share, x, 10, Z));
      if (plants.flowerAt(i)) n += 1;
    }
    expect(n).toBeGreaterThan(0);
    const map = w.game.world.map;
    map.flags[picked] = (map.flags[picked] ?? 0) | TileFlag.Snow;
    expect(plants.flowerAt(picked)).toBe(false);
  });
});

describe('T-555 placing a hive', () => {
  it('a hive stands on an outdoor soil floor; underground it is refused with bad_placement', () => {
    const w = new TestWorld({ seed: 't555-place', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    w.spawnItem('beehive', 'oak', w.index(5, 5, Z));
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'beehive', origin: w.index(10, 10, Z), orientation: 0, materialChoice: 'oak' }).ok).toBe(true);
    w.digRoom(10, 10, UNDER, 4, 4);
    for (let y = 9; y <= 14; y += 1) for (let x = 9; x <= 14; x += 1) w.discover(w.index(x, y, UNDER));
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'beehive', origin: w.index(11, 11, UNDER), orientation: 0, materialChoice: 'oak' }))
      .toEqual({ ok: false, reason: 'bad_placement' });
    const system = w.game.world.scheduler.byId('14') as unknown as { buildings: { ghost(type: string, origin: TileIndex, o: number): { reason: string | null; rule: string } } };
    expect(system.buildings.ghost('beehive', w.index(11, 11, UNDER), 0)).toMatchObject({ reason: 'bad_placement', rule: 'outdoor_soil_floor' });
  });
});

describe('T-555 a hive fills with comb and its keeper empties it', () => {
  it('a hive by a meadow makes a comb within 14 days, held reserved in the hive; saved and loaded it keeps it; the keeper lifts it out', () => {
    const w = new TestWorld({ seed: 't555-hive', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    // An early spring snow would hide the meadow's flowers: hold the weather clear.
    w.forceWeather('clear');
    meadow(w, 10, 10, 50, 50);
    const at = flowerySpot(w);
    const animals = w.readers.of<AnimalsReader>('08');
    const hive = w.build('beehive', at, 'oak');
    w.step(1);
    expect(animals.hives()).toEqual([hive]);
    expect(animals.hiveFlowers(hive)).toBeGreaterThanOrEqual(HIVE_FLOWERS_MIN);
    expect(w.readers.calendar.season).toBe(0);
    w.step(HIVE_DAYS * TICKS_PER_DAY + 10);
    const combs = animals.hiveCombs(hive);
    expect(combs).toBeGreaterThanOrEqual(1);
    expect(combs).toBeLessThanOrEqual(HIVE_CAPACITY);
    const itemsReader = w.readers.of<ItemsReader>('13');
    const inHive = itemsReader.at(at).filter((id) => itemsReader.get(id)?.type === items.index('honeycomb'));
    expect(inHive.length).toBe(combs);
    for (const id of inHive) {
      expect(((itemsReader.get(id)?.flags ?? 0) & ItemFlag.Reserved) !== 0).toBe(true);
      expect(itemsReader.get(id)?.material).toBe(materials.index('honey'));
    }
    const loaded = roundTrip(w.game).game;
    expect(loaded.world.readers.of<AnimalsReader>('08').hives()).toEqual([hive]);
    expect(loaded.world.readers.of<AnimalsReader>('08').hiveCombs(hive)).toBe(combs);

    const keeper = worker(w, w.index(15, 15, Z), 'animal_care');
    w.until((v) => v.readers.of<AnimalsReader>('08').hiveCombs(hive) === 0, 2000);
    expect(w.events('JobCompleted').some((e) => e['jobType'] === 'collect_honey' || String(e['key'] ?? '').startsWith('collect_honey:'))).toBe(true);
    const keeperAt = w.game.world.entities.get(keeper, C.Position);
    expect(keeperAt).toBeDefined();
    for (const id of inHive) {
      expect(((itemsReader.get(id)?.flags ?? 0) & ItemFlag.Reserved) !== 0).toBe(false);
      expect(itemsReader.tileOf(id)).not.toBe(at);
    }
  });

  it('the hive is pressed into honey and beeswax at the farmer\'s workshop, and honey brews mead at the still', () => {
    const w = new TestWorld({ seed: 't555-press', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const farm = w.build('farmers_workshop', w.index(15, 15, Z), 'oak');
    worker(w, w.index(20, 18, Z), 'animal_care', { animal_care: 5 });
    w.spawnItem('honeycomb', 'honey', w.index(21, 18, Z), 1);
    order(w, farm, 'press_honeycomb');
    w.until((v) => crafted(v, 'press_honeycomb').length > 0, 3000);
    expect(units(w, 'honey', 'honey')).toBe(1);
    expect(units(w, 'beeswax', 'beeswax')).toBe(1);
    expect(units(w, 'honeycomb')).toBe(0);

    const still = w.build('still', w.index(30, 15, Z), 'oak');
    worker(w, w.index(35, 18, Z), 'brewing', { brewing: 5 });
    w.spawnItem('honey', 'honey', w.index(36, 18, Z), 3);
    w.spawnItem('barrel', 'oak', w.index(36, 19, Z), 1);
    order(w, still, 'brew_mead');
    w.until((v) => crafted(v, 'brew_mead').length > 0, 4000);
    expect(units(w, 'drink', 'mead')).toBe(20);
    expect(units(w, 'honey')).toBe(0);
  });
});

/** A fixed `ctx` for {@link Hives}: one hive at (30, 30) on level 32 of a 64² map, its flowers given. */
function hiveCtx(season: number, flowers: number, chance: boolean, dwarfAt: readonly [number, number, number][]) {
  const W = 64;
  const index = (x: number, y: number, z: number): number => (z * W + y) * W + x;
  const origin = index(30, 30, 32);
  const events: GameEvent[] = [];
  const spawned: EntityId[] = [];
  const reserved: EntityId[] = [];
  let next = 1000;
  const dwarves = dwarfAt.map((_, k) => 10 + k);
  const draws: number[] = [];
  const flowerTiles = new Set<number>();
  for (let k = 0; k < flowers; k += 1) flowerTiles.add(index(25 + k, 28, 32));
  const host = {
    rng: { chance: (p: number) => { draws.push(p); return chance; } } as never,
    buildings: () => ({ byTag: () => [7], get: (id: EntityId) => (id === 7 ? { state: 'built', origin } : undefined) }) as never,
    plants: () => ({ flowerAt: (i: number) => flowerTiles.has(i) }) as never,
    dwarves: () => ({ list: () => dwarves }) as never,
  };
  const ctx = {
    tick: 0,
    world: {
      map: { w: W, h: W, index, xOf: (i: number) => i % W, yOf: (i: number) => Math.floor(i / W) % W, zOf: (i: number) => Math.floor(i / (W * W)) },
      entities: {
        alive: () => true,
        get: (id: EntityId) => { const k = dwarves.indexOf(id); const p = dwarfAt[k]; return p === undefined ? undefined : { x: p[0], y: p[1], z: p[2] }; },
      },
      services: { items: { reserve: (id: EntityId) => reserved.push(id), release: () => undefined } },
    },
    readers: { calendar: { season } },
    registry,
    spawn: { item: () => { next += 1; spawned.push(next); return next; } },
    emit: (e: GameEvent) => events.push(e),
  } as unknown as TickContext;
  const hives = new Hives(host);
  hives.built(7);
  return { hives, ctx, events, spawned, reserved, draws };
}

describe('T-555 the hive\'s days and its stings', () => {
  /** The tick of a day on which hive 7's comb comes due: (day + 7) % 14 === 0. */
  const DUE = (HIVE_DAYS - 7) * TICKS_PER_DAY;

  it('a hive with flowers enough adds a comb on its day, reserved, up to its capacity; none in winter or short of flowers', () => {
    const a = hiveCtx(1, HIVE_FLOWERS_MIN, false, []);
    (a.ctx as { tick: number }).tick = DUE;
    a.hives.daily(a.ctx);
    expect(a.spawned.length).toBe(1);
    expect(a.reserved).toEqual(a.spawned);
    (a.ctx as { tick: number }).tick = DUE + TICKS_PER_DAY;
    a.hives.daily(a.ctx);
    expect(a.spawned.length).toBe(1);
    for (let k = 1; k <= 4; k += 1) {
      (a.ctx as { tick: number }).tick = DUE + k * HIVE_DAYS * TICKS_PER_DAY;
      a.hives.daily(a.ctx);
    }
    expect(a.spawned.length).toBe(HIVE_CAPACITY);
    const winter = hiveCtx(3, HIVE_FLOWERS_MIN, false, []);
    (winter.ctx as { tick: number }).tick = DUE;
    winter.hives.daily(winter.ctx);
    expect(winter.spawned).toEqual([]);
    const short = hiveCtx(1, HIVE_FLOWERS_MIN - 1, false, []);
    (short.ctx as { tick: number }).tick = DUE;
    short.hives.daily(short.ctx);
    expect(short.spawned).toEqual([]);
    expect(short.hives.flowers(7, short.ctx.world.map)).toBe(HIVE_FLOWERS_MIN - 1);
  });

  it('in summer a dwarf within 3 tiles of a hive draws once an hour; one farther or on another level, or any in spring, draws nothing', () => {
    const near: [number, number, number] = [30 + HIVE_STING_RADIUS, 30, 32];
    const far: [number, number, number] = [30 + HIVE_STING_RADIUS + 1, 30, 32];
    const below: [number, number, number] = [30, 30, 31];
    const summer = hiveCtx(1, HIVE_FLOWERS_MIN, true, [near, far, below]);
    summer.hives.hourly(summer.ctx);
    expect(summer.draws).toEqual([HIVE_PASSER_PERMILLE]);
    expect(summer.events).toEqual([{ type: 'Stung', id: 10, source: 'bees' }]);
    const spring = hiveCtx(0, HIVE_FLOWERS_MIN, true, [near]);
    spring.hives.hourly(spring.ctx);
    expect(spring.draws).toEqual([]);
  });

  it('the collector draws STING_PERMILLE; a fortress with no hive never draws', () => {
    const a = hiveCtx(1, HIVE_FLOWERS_MIN, true, []);
    a.hives.stingCollector(42, (e) => a.events.push(e));
    expect(a.draws).toEqual([STING_PERMILLE]);
    expect(a.events).toEqual([{ type: 'Stung', id: 42, source: 'bees' }]);
    const none = hiveCtx(1, HIVE_FLOWERS_MIN, true, [[30, 30, 32]]);
    none.hives.removed(7, none.ctx);
    none.hives.hourly(none.ctx);
    none.hives.daily(none.ctx);
    expect(none.draws).toEqual([]);
    expect(none.spawned).toEqual([]);
  });
});

describe('T-555 honey dresses a wound where there is no cloth or bucket', () => {
  function burned(seed: string, supplies: readonly [string, string, number][]) {
    const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const world = w.game.world;
    const medics = [w.spawnDwarf({ at: w.index(10, 10, Z), skills: { medicine: 20 } }), w.spawnDwarf({ at: w.index(12, 10, Z), skills: { medicine: 20 } })];
    for (const id of medics) {
      for (const l of LABORS) w.setLabor(id, l, l === 'medicine');
      for (const need of NEEDS) w.setNeed(id, need, 0);
    }
    for (const [type, material, n] of supplies) w.spawnItem(type, material, w.index(11, 11, Z), n);
    // Meals to eat, so a hungry medic does not eat the honey.
    w.spawnItem('easy_meal', 'boar_meat', w.index(13, 13, Z), 6, 2);
    for (const id of medics) world.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0, part: 'left_arm', damageType: 'burn', amount: 5 });
    w.step(3);
    const burns = (id: number) => world.entities.get(id, C.Body)!.parts.flatMap((p) => p.wounds).filter((x) => x.type === 'burn');
    return { w, medics, burns };
  }

  it('with no cloth and no bucket, the medics dress and clean their burns with honey: each honeyed burn is cleaned', () => {
    const a = burned('t555-honey-burn', [['honey', 'honey', 10]]);
    a.w.until(() => a.medics.every((id) => a.burns(id).every((b) => b.dressed && b.cleaned)), 2 * TICKS_PER_DAY);
    for (const id of a.medics) for (const b of a.burns(id)) expect(b).toMatchObject({ dressed: true, cleaned: true });
    expect(units(a.w, 'honey')).toBeLessThan(10);
    expect(units(a.w, 'honey')).toBeGreaterThanOrEqual(10 - 4);
  });

  it('with cloth and a bucket to hand, the honey stays: cloth and water first', () => {
    const a = burned('t555-cloth-first', [['honey', 'honey', 10], ['cloth', 'flax_cloth', 10], ['bucket', 'oak', 2]]);
    a.w.until(() => a.medics.every((id) => a.burns(id).every((b) => b.dressed)), 2 * TICKS_PER_DAY);
    for (const id of a.medics) for (const b of a.burns(id)) expect(b.dressed).toBe(true);
    a.w.step(TICKS_PER_DAY / 2);
    expect(units(a.w, 'honey')).toBe(10);
  });
});

describe('T-555 the hive\'s panel and the hospital\'s honey', () => {
  it('the hospital wants no honey unless asked; SetHospitalSupplies takes honey', () => {
    const w = new TestWorld({ seed: 't555-hospital', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const tiles: TileIndex[] = [];
    for (let x = 10; x < 13; x += 1) tiles.push(w.index(x, 10, Z));
    const zone = w.zone('hospital', tiles);
    expect(w.game.world.applyCommand({ type: 'SetHospitalSupplies', zoneId: zone, wants: { honey: 4 } }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'SetHospitalSupplies', zoneId: zone, wants: { mead: 4 } })).toEqual({ ok: false, reason: 'bad_setting' });
    expect(w.readers.of<BuildingsReader>('14').zone(zone)?.settings['desired supplies']).toEqual({ honey: 4 });
  });
});
