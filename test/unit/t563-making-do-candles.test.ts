/**
 * T-563, Making Do B3b: candles of tallow or beeswax, the candle stand that wants five and burns them
 * by days, the lantern, comfort light and what it does: a meal by candlelight, a thief seen two tiles
 * farther, tallow smoke, a cellar that a stand spoils (`14` § Candle stands and lanterns; `18` §
 * Stealth; `10` § Eating and drinking; `13` § Aging in a cellar; `20` § Sundries; `23` § Compositor).
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { contentRegistry } from '@content/loader';
import { C, ItemFlag, type Building, type Item } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import type { GameEvent } from '@core/events';
import { TileFlag } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { CANDLE_DAYS_TALLOW, CANDLE_DAYS_WAX, CANDLE_SPOT_BONUS, STAND_CANDLES, TALLOW_SMOKE_PERMILLE } from '@systems/buildings/constants';
import type { ItemsReader } from '@systems/items';
import { eventPredicate, eventTargets, type ThoughtDef } from '@systems/morale/thoughts';
import { checkSpotted } from '@systems/threats/ai';
import { SPOT_RADIUS } from '@systems/threats/constants';
import { eligibleGoodsEntries } from '@systems/trade/goods';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const items = registry.table<{ id: string; category: string; stack: number; container: string; materials: unknown; notes?: string }>('items');
const materials = registry.table<{ id: string }>('materials');
const Z = 25;
const LABORS = registry.table<{ id: string }>('labors').ids();
const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

function b14(w: TestWorld): BuildingsReader {
  return w.readers.of<BuildingsReader>('14');
}

function items13(w: TestWorld): ItemsReader {
  return w.readers.of<ItemsReader>('13');
}

/** A dug, discovered room on the flat test map underground (dark: no `lit` flag), and its tiles. */
function room(w: TestWorld, x: number, y: number, width: number, height: number): TileIndex[] {
  w.digRoom(x, y, Z, width, height);
  for (let yy = y - 1; yy <= y + height; yy += 1) for (let xx = x - 1; xx <= x + width; xx += 1) w.discover(w.index(xx, yy, Z));
  const out: TileIndex[] = [];
  for (let yy = y; yy < y + height; yy += 1) for (let xx = x; xx < x + width; xx += 1) out.push(w.index(xx, yy, Z));
  return out;
}

/** A worker with only `labor` on and no needs pressing. */
function worker(w: TestWorld, at: TileIndex, labor: string, skills: Record<string, number> = {}): EntityId {
  const id = w.spawnDwarf({ at, skills });
  for (const l of LABORS) w.setLabor(id, l, l === labor);
  for (const need of NEEDS) w.setNeed(id, need, 0);
  return id;
}

/** The candle units a stand holds. */
function held(w: TestWorld, stand: EntityId): number {
  return b14(w).standCandles(stand)?.candles ?? 0;
}

function units(w: TestWorld, type: string): number {
  const t = items.index(type);
  let n = 0;
  for (const id of w.game.world.entities.with(C.Item)) {
    const it = w.game.world.entities.get(id, C.Item) as Item;
    if (it.type === t) n += it.count;
  }
  return n;
}

/** A stand built in a dark room with `count` candles of `material` put straight into it (setup only). */
function litStand(w: TestWorld, at: TileIndex, material: string, count: number): EntityId {
  const stand = w.build('candle_stand', at, 'granite');
  const candle = w.spawnItem('candle', material, at, count);
  w.items.install?.(candle);
  const ent = w.game.world.entities;
  ent.add(stand, C.Building, { ...(ent.get(stand, C.Building) as Building), held: [candle] });
  return stand;
}

function thoughtIds(w: TestWorld, id: EntityId): string[] {
  const thoughts = registry.table('thoughts');
  return (w.game.world.entities.get(id, C.Mood)?.thoughts ?? []).map((t) => thoughts.byIndex(t.thought)?.id ?? '');
}

describe('T-563 the rows', () => {
  it('candles and lanterns, the stand and the lantern building, the recipes, the thought and the Hillfolk candles', () => {
    expect(items.byId('candle')).toMatchObject({ category: 'tool/candle', stack: 10, container: 'bin', materials: ['liquid'] });
    expect(items.byId('lantern')).toMatchObject({ category: 'furniture/lantern', stack: 1, materials: ['glass'] });
    const buildings = registry.table<{ id: string; category: string; tags: string[]; passable: boolean; value: number; labor: string; wants?: { match: string; count: number }[]; inputs: { match: string; count: number }[]; roomValue: unknown }>('buildings');
    expect(buildings.byId('candle_stand')).toMatchObject({ category: 'special', tags: ['light'], passable: false, value: 2, labor: 'construction',
      inputs: [{ match: 'stone_block|bar', count: 1 }], wants: [{ match: 'candle', count: STAND_CANDLES }] });
    expect(buildings.byId('lantern')).toMatchObject({ category: 'furniture', tags: ['light'], passable: false, labor: 'construction', roomValue: 'item',
      inputs: [{ match: 'lantern', count: 1 }] });
    const recipes = registry.table<{ id: string; workshop: string; inputs: unknown; outputs: unknown; fuel: boolean; quality: boolean }>('recipes');
    expect(recipes.byId('make_candles_tallow')).toMatchObject({ workshop: 'craftdwarf', inputs: [{ match: 'tallow', count: 1 }],
      outputs: [{ item: 'candle', count: 4, material: { fixed: 'tallow' } }] });
    expect(recipes.byId('make_candles_wax')).toMatchObject({ workshop: 'craftdwarf', inputs: [{ match: 'beeswax', count: 1 }],
      outputs: [{ item: 'candle', count: 4, material: { fixed: 'beeswax' } }] });
    expect(recipes.byId('make_lantern')).toMatchObject({ workshop: 'kiln', fuel: true, quality: true,
      inputs: [{ match: 'stone_block', count: 1, material: 'glass' }, { match: 'candle', count: 1 }], outputs: [{ item: 'lantern', count: 1, material: { fixed: 'glass' } }] });
    const thought = registry.table<ThoughtDef>('thoughts').byId('ate_by_candlelight') as ThoughtDef;
    expect(thought).toMatchObject({ text: 'Ate by candlelight.', value: 1, hours: 24, group: 'room' });
    expect(eventPredicate(thought, { type: 'MealEaten', id: 1, atTable: true, candlelit: true }, registry)).toBe(true);
    expect(eventPredicate(thought, { type: 'MealEaten', id: 1, atTable: true }, registry)).toBe(false);
    const hillfolk = eligibleGoodsEntries(registry, 'hillfolk', 1);
    expect(hillfolk.some((e) => e.item === 'candle' && e.sundries === true)).toBe(true);
  });
});

describe('T-563 a candle stand', () => {
  it('haulers feed it candles, counted in units; it lights its 3×3 for comfort and not for crops; it burns a tallow candle in 7 days', () => {
    const w = new TestWorld({ seed: 't563-stand', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const tiles = room(w, 10, 10, 7, 5);
    const at = w.index(12, 12, Z);
    const stand = w.build('candle_stand', at, 'granite');
    w.step(10);
    expect(b14(w).standCandles(stand)).toEqual({ candles: 0, burning: '', daysLeft: 0 });
    expect(b14(w).comfortLightAt(w.index(13, 13, Z))).toBe(false);
    // Three tallow candles and a stack of four: the stand takes the three, then the four whole (seven).
    w.spawnItem('candle', 'tallow', w.index(16, 14, Z), 3);
    w.spawnItem('candle', 'tallow', w.index(16, 13, Z), 4);
    worker(w, w.index(15, 14, Z), 'hauling');
    w.until((v) => held(v, stand) >= STAND_CANDLES, 2000);
    expect(held(w, stand)).toBeLessThanOrEqual(7);
    for (const id of b14(w).held(stand)) expect(((items13(w).get(id)?.flags ?? 0) & ItemFlag.Installed) !== 0).toBe(true);
    expect(b14(w).standCandles(stand)).toMatchObject({ burning: 'tallow', daysLeft: CANDLE_DAYS_TALLOW });
    // Its 3×3 on its level is in comfort light; the next tile is not; no crop light, no `lit` flag.
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const t = w.index(12 + dx, 12 + dy, Z);
      expect(b14(w).comfortLightAt(t)).toBe(true);
      expect(w.game.world.map.hasFlag(t, TileFlag.Lit)).toBe(false);
      expect(b14(w).cropLitAt(t)).toBe(false);
      expect(b14(w).tallowSmokeAt(t)).toBe(true);
    }
    expect(b14(w).comfortLightAt(w.index(14, 12, Z))).toBe(false);
    expect(tiles.length).toBe(35);
    // Seven days burn one candle: one unit fewer, the next lit.
    const before = held(w, stand);
    const before0 = units(w, 'candle');
    w.step(CANDLE_DAYS_TALLOW * TICKS_PER_DAY + 20);
    expect(held(w, stand)).toBe(before - 1);
    expect(units(w, 'candle')).toBe(before0 - 1);
    expect(b14(w).standCandles(stand)?.burning).toBe('tallow');
  }, 120_000);

  it('beeswax burns 14 days and does not smoke; burnDays is saved; a save from before it loads as none burned; taken out it forgets the days', () => {
    const w = new TestWorld({ seed: 't563-wax', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    room(w, 10, 10, 5, 5);
    const at = w.index(12, 12, Z);
    const stand = litStand(w, at, 'beeswax', 2);
    expect(b14(w).standCandles(stand)).toEqual({ candles: 2, burning: 'beeswax', daysLeft: CANDLE_DAYS_WAX });
    expect(b14(w).comfortLightAt(at)).toBe(true);
    expect(b14(w).tallowSmokeAt(at)).toBe(false);
    w.step(3 * TICKS_PER_DAY + 20);
    expect(b14(w).standCandles(stand)?.daysLeft).toBe(CANDLE_DAYS_WAX - 3);
    expect(w.game.world.entities.get(stand, C.Building)?.burnDays).toBe(3);
    const loaded = roundTrip(w.game).game;
    expect(loaded.world.readers.of<BuildingsReader>('14').standCandles(stand)?.daysLeft).toBe(CANDLE_DAYS_WAX - 3);
    const old = roundTrip(w.game).game;
    const { burnDays: _days, ...before } = old.world.entities.get(stand, C.Building) as Building;
    old.world.entities.add(stand, C.Building, before);
    expect(roundTrip(old).game.world.readers.of<BuildingsReader>('14').standCandles(stand)?.daysLeft).toBe(CANDLE_DAYS_WAX);
    w.step((CANDLE_DAYS_WAX - 3) * TICKS_PER_DAY);
    expect(b14(w).standCandles(stand)).toMatchObject({ candles: 1, burning: 'beeswax' });
    expect(w.game.world.applyCommand({ type: 'ReleaseHeld', buildingId: stand })).toEqual({ ok: true });
    expect(w.game.world.entities.get(stand, C.Building)?.burnDays).toBeUndefined();
    expect(b14(w).standCandles(stand)).toEqual({ candles: 0, burning: '', daysLeft: 0 });
    expect(b14(w).comfortLightAt(at)).toBe(false);
  }, 120_000);

  it('a stand burns out and goes dark; a lantern lights its 3×3 forever; a stand\'s candles add to its room', () => {
    const w = new TestWorld({ seed: 't563-dark', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const tiles = room(w, 10, 10, 6, 4);
    const zone = w.zone('dining_hall', tiles);
    const at = w.index(11, 11, Z);
    const empty = b14(w).roomScore(zone)?.score ?? 0;
    const stand = litStand(w, at, 'tallow', 1);
    w.step(TICKS_PER_DAY + 20);
    expect(b14(w).roomScore(zone)?.score ?? 0).toBeGreaterThan(empty);
    w.step(CANDLE_DAYS_TALLOW * TICKS_PER_DAY);
    expect(b14(w).standCandles(stand)).toEqual({ candles: 0, burning: '', daysLeft: 0 });
    expect(b14(w).comfortLightAt(at)).toBe(false);
    const lantern = w.build('lantern', w.index(14, 12, Z), 'glass');
    expect(b14(w).get(lantern)?.typeId).toBe('lantern');
    expect(b14(w).comfortLightAt(w.index(15, 13, Z))).toBe(true);
    expect(b14(w).tallowSmokeAt(w.index(15, 13, Z))).toBe(false);
    w.step(30 * TICKS_PER_DAY);
    expect(b14(w).comfortLightAt(w.index(15, 13, Z))).toBe(true);
  }, 120_000);
});

describe('T-563 a maintain order keeps a stand fed', () => {
  it('the craftsdwarf makes tallow candles to a maintain order and haulers fill the stand', () => {
    const w = new TestWorld({ seed: 't563-maintain', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    room(w, 10, 10, 12, 8);
    const shop = w.build('craftdwarf', w.index(11, 11, Z), 'oak');
    const stand = w.build('candle_stand', w.index(19, 15, Z), 'granite');
    w.spawnItem('tallow', 'tallow', w.index(15, 12, Z), 4);
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: shop, order: { recipeId: 'make_candles_tallow', mode: 'maintain', threshold: 2, priority: 5 } }))
      .toEqual({ ok: true });
    worker(w, w.index(14, 14, Z), 'crafts', { crafting: 5 });
    worker(w, w.index(15, 15, Z), 'hauling');
    w.until((v) => held(v, stand) >= STAND_CANDLES, 6000);
    expect(held(w, stand)).toBeGreaterThanOrEqual(STAND_CANDLES);
    expect(w.events('ItemCrafted').filter((e) => e['recipeId'] === 'make_candles_tallow').length).toBeGreaterThanOrEqual(2);
    expect(b14(w).standCandles(stand)?.burning).toBe('tallow');
  }, 120_000);
});

describe('T-563 what light does', () => {
  it('a meal at a table in comfort light is eaten by candlelight; away from it, not', () => {
    const w = new TestWorld({ seed: 't563-meal', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const tiles = room(w, 10, 10, 6, 4);
    w.zone('dining_hall', tiles);
    w.build('table', w.index(11, 11, Z), 'oak');
    w.build('chair', w.index(12, 11, Z), 'oak');
    litStand(w, w.index(12, 12, Z), 'beeswax', 3);
    w.spawnItem('easy_meal', 'boar_meat', w.index(14, 13, Z), 2, 2);
    const dwarf = w.spawnDwarf({ at: w.index(15, 13, Z) });
    for (const need of NEEDS) w.setNeed(dwarf, need, 0);
    w.setNeed(dwarf, 'hunger', 80);
    w.until((v) => v.events('MealEaten').some((e) => e['id'] === dwarf), 3000);
    const meal = w.events('MealEaten').find((e) => e['id'] === dwarf) as GameEvent;
    expect(meal).toMatchObject({ atTable: true, candlelit: true });
    w.step(20);
    expect(thoughtIds(w, dwarf)).toContain('ate_by_candlelight');
  }, 120_000);

  it('a hidden creature is spotted CANDLE_SPOT_BONUS farther when either stands in comfort light', () => {
    const w = new TestWorld({ seed: 't563-spot', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    room(w, 10, 10, 30, 3);
    const dwarfAt = w.index(12, 11, Z);
    w.spawnDwarf({ at: dwarfAt });
    const ctx = { world: w.game.world, registry, tick: w.tick, readers: w.readers, emit: () => {}, rng: null } as unknown as TickContext;
    const spots = (dx: number): boolean => checkSpotted(0, w.index(12 + dx, 11, Z), ctx);
    expect([spots(SPOT_RADIUS), spots(SPOT_RADIUS + 1)]).toEqual([true, false]);
    // A stand by the dwarf: it sees two tiles farther.
    const stand = litStand(w, w.index(12, 12, Z), 'tallow', 2);
    expect([spots(SPOT_RADIUS + CANDLE_SPOT_BONUS), spots(SPOT_RADIUS + CANDLE_SPOT_BONUS + 1)]).toEqual([true, false]);
    expect(w.game.world.applyCommand({ type: 'ReleaseHeld', buildingId: stand })).toEqual({ ok: true });
    expect(spots(SPOT_RADIUS + 1)).toBe(false);
    // A lantern by the thief instead: it is seen two tiles farther.
    w.build('lantern', w.index(12 + SPOT_RADIUS + 2, 12, Z), 'glass');
    expect(spots(SPOT_RADIUS + CANDLE_SPOT_BONUS)).toBe(true);
    expect(spots(SPOT_RADIUS + 1)).toBe(true);
  });

  it('tallow smoke: a dwarf lit only by tallow draws on 10\'s stream and gets smoky_hall alone, and 05 draws no haze for it', () => {
    const w = new TestWorld({ seed: 't563-smoke', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    room(w, 10, 10, 12, 4);
    litStand(w, w.index(11, 11, Z), 'tallow', 10);
    const inSmoke = worker(w, w.index(11, 12, Z), 'none');
    const beside = worker(w, w.index(14, 12, Z), 'none');
    // Held where they stand: idle dwarves would wander off the lit tiles.
    const hours = Math.ceil(5000 / TALLOW_SMOKE_PERMILLE);
    let smoked = 0;
    for (let h = 0; h < hours && smoked === 0; h += 1) {
      for (const [id, x] of [[inSmoke, 11], [beside, 14]] as const) {
        w.game.world.entities.add(id, C.Position, { ...(w.game.world.entities.get(id, C.Position) as { x: number; y: number; z: number }), x, y: 12, z: Z });
        for (const need of NEEDS) w.setNeed(id, need, 0);
      }
      w.step(TICKS_PER_HOUR);
      smoked = w.events('SmokyFuelBurned').length;
    }
    const smoke = w.events('SmokyFuelBurned');
    expect(smoke.length).toBeGreaterThan(0);
    expect(smoke.every((e) => e['dwarfId'] === inSmoke && e['workshopId'] === 0)).toBe(true);
    w.step(20);
    expect(thoughtIds(w, inSmoke)).toContain('smoky_hall');
    expect(thoughtIds(w, beside)).not.toContain('smoky_hall');
    // 05 draws no smoke for it.
    const materialsReader = w.readers.of<{ isSmoky(i: TileIndex): boolean }>('05');
    expect(materialsReader.isSmoky(w.index(11, 12, Z))).toBe(false);
    // 15 gives it to the dwarf it names alone, even with another beside.
    const def = registry.table<ThoughtDef>('thoughts').byId('smoky_hall') as ThoughtDef;
    const ctx = { world: w.game.world, registry, tick: w.tick, readers: w.readers, emit: () => {} } as unknown as TickContext;
    expect(eventTargets(def, { type: 'SmokyFuelBurned', workshopId: 0, tile: w.index(11, 12, Z), dwarfId: inSmoke }, ctx)).toEqual([inSmoke]);
  }, 240_000);

  it('a cellar beside a burning stand stops working, and works again when the stand goes dark', () => {
    const w = new TestWorld({ seed: 't563-cellar', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const tiles = room(w, 10, 10, 3, 3);
    room(w, 13, 10, 2, 3);
    for (const t of tiles) w.forceTemperature(t, 10);
    const zone = w.zone('stockpile', tiles);
    expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: zone, filter: 'everything' })).toEqual({ ok: true });
    expect(w.game.world.applyCommand({ type: 'SetStockpileCellar', zoneId: zone, on: true })).toEqual({ ok: true });
    expect(items13(w).stockpile(zone)?.cellarOk).toBe(true);
    const stand = litStand(w, w.index(13, 11, Z), 'tallow', 1);
    w.step(TICKS_PER_DAY + 20);
    expect(items13(w).stockpile(zone)).toMatchObject({ cellarReason: 'lit' });
    expect(w.game.world.applyCommand({ type: 'ReleaseHeld', buildingId: stand })).toEqual({ ok: true });
    // The candle dropped on the stand's tile: forbid it so no hauler brings it back.
    for (const id of items13(w).at(w.index(13, 11, Z))) w.game.world.applyCommand({ type: 'ForbidItem', itemId: id, on: true });
    w.step(TICKS_PER_DAY + 20);
    expect(items13(w).stockpile(zone)?.cellarOk).toBe(true);
    expect(materials.has('tallow')).toBe(true);
  }, 120_000);
});
