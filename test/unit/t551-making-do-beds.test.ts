/**
 * T-551, Making Do B1: beds that rest differently, pallets and stone beds, bedding and pillows, and
 * buildings that want items (`10-dwarves.md` § Sleeping; `13-items-and-storage.md` § Buildings that
 * want items, § Value; `14-buildings-and-rooms.md` § Beds, § Building wants; `12` § Operation).
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { contentRegistry } from '@content/loader';
import { C, ItemFlag, type Building, type Item } from '@core/components';
import { TICKS_PER_HOUR } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { Job } from '@systems/jobs';
import type { WorkshopsSystem } from '@systems/workshops';
import type { BuildingsReader } from '@systems/buildings';
import { MADE_UP_REST_PERCENT } from '@systems/buildings/constants';
import { FLOOR_REST_PERCENT, SLEEP_HOURS } from '@systems/dwarves/constants';
import { advanceNeeds, REST_ASLEEP_PER_HOUR } from '@systems/dwarves/needs';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const Z = 25;

function b14(w: TestWorld): BuildingsReader {
  return w.readers.of<BuildingsReader>('14');
}

function items13(w: TestWorld): ItemsReader {
  return w.readers.of<ItemsReader>('13');
}

/** A dug room on the flat test map, discovered, and its tiles. */
function room(w: TestWorld, x: number, y: number, width: number, height: number): TileIndex[] {
  w.digRoom(x, y, Z, width, height);
  for (let yy = y - 1; yy <= y + height; yy += 1) for (let xx = x - 1; xx <= x + width; xx += 1) w.discover(w.index(xx, yy, Z));
  const out: TileIndex[] = [];
  for (let yy = y; yy < y + height; yy += 1) for (let xx = x; xx < x + width; xx += 1) out.push(w.index(xx, yy, Z));
  return out;
}

function slept(w: TestWorld, id: EntityId): GameEvent[] {
  return w.events('Slept').filter((e) => e['id'] === id);
}

function thoughtIds(w: TestWorld, id: EntityId): string[] {
  const thoughts = registry.table('thoughts');
  return (w.game.world.entities.get(id, C.Mood)?.thoughts ?? []).map((t) => thoughts.byIndex(t.thought)?.id ?? '');
}

/** Spawn a stuffed item (a bedding or a pillow) stuffed with `stuffing`. */
function stuffed(w: TestWorld, type: string, at: TileIndex, stuffing: string): EntityId {
  const id = w.spawnItem(type, 'flax_cloth', at, 1, 2);
  w.items.setStuffing?.(id, registry.table('materials').index(stuffing));
  return id;
}

describe('T-551 the bed rows', () => {
  const buildings = registry.table<{ id: string; labor: string; buildTicks: number; tags: string[]; rest?: number; wants?: { match: string; count: number }[]; inputs: { match: string; count: number }[] }>('buildings');

  it('pallets are laid by hauling in 20 ticks from counted materials; a stone bed is a mason\'s; every bed has its rest', () => {
    expect(buildings.byId('pallet')).toMatchObject({ labor: 'hauling', buildTicks: 20, rest: 60, inputs: [{ match: 'cloth|wool_raw', count: 2 }] });
    expect(buildings.byId('straw_pallet')).toMatchObject({ labor: 'hauling', buildTicks: 20, rest: 60, inputs: [{ match: 'fiber|straw|reed', count: 3 }] });
    expect(buildings.byId('stone_bed')).toMatchObject({ labor: 'masonry', rest: 75, inputs: [{ match: 'stone_bed', count: 1 }] });
    expect(buildings.byId('bed')).toMatchObject({ rest: 100, wants: [{ match: 'bedding', count: 1 }, { match: 'pillow', count: 1 }] });
    for (const id of ['pallet', 'straw_pallet', 'stone_bed', 'bed']) expect(buildings.byId(id)?.tags).toContain('sleep');
    // The floor rests below every bed, a made-up bed above.
    const rests = ['pallet', 'straw_pallet', 'stone_bed', 'bed'].map((id) => buildings.byId(id)?.rest ?? 0);
    expect(Math.min(...rests)).toBeGreaterThan(FLOOR_REST_PERCENT);
    expect(MADE_UP_REST_PERCENT).toBeGreaterThan(Math.max(...rests));
  });

  it('the stone bed and bedding recipes', () => {
    const recipes = registry.table<{ id: string; workshop: string; inputs: { match: string; count: number; sameMaterial?: boolean }[]; outputs: { item: string }[] }>('recipes');
    expect(recipes.byId('make_stone_bed')).toMatchObject({ workshop: 'mason', inputs: [{ match: 'raw_stone', count: 1 }, { match: 'cloth|wool_raw', count: 2 }], outputs: [{ item: 'stone_bed' }] });
    expect(recipes.byId('make_stone_bed_straw')).toMatchObject({ workshop: 'mason', inputs: [{ match: 'raw_stone', count: 1 }, { match: 'fiber|straw|reed', count: 3 }] });
    expect(recipes.byId('make_bedding')).toMatchObject({ workshop: 'clothier', inputs: [{ match: 'cloth', count: 2 }, { match: 'straw|wool_raw|feather', count: 2, sameMaterial: true }] });
    expect(recipes.byId('make_pillow')).toMatchObject({ workshop: 'clothier', inputs: [{ match: 'cloth', count: 1 }, { match: 'straw|wool_raw|feather', count: 1 }] });
    for (const id of ['bedding', 'pillow']) expect(registry.table<{ id: string; tags?: string[] }>('items').byId(id)?.tags).toContain('stuffed');
  });
});

describe('T-551 the clothier records the stuffing', () => {
  it('bedding of feathers records its feathers and is worth double; a pillow of straw records the straw\'s crop', () => {
    const w = new TestWorld({ seed: 't551-clothier', world: 'flat-test', embark: 'none' });
    const at = w.index(15, 15, 32);
    const workshop = w.build('clothier', at);
    const dwarf = w.spawnDwarf({ at: w.index(18, 16, 32) });
    w.step(1);
    const system = w.game.world.scheduler.byId('12') as WorkshopsSystem;
    const ctx = { world: w.game.world, registry: w.game.registry, spawn: w.game.world.services.spawn,
      emit: (event: Parameters<typeof w.game.world.emit>[0]) => w.game.world.emit(event) } as unknown as TickContext;
    const make = (recipe: string, inputs: readonly [string, string, number][]): EntityId => {
      const jobInputs = inputs.map(([type, material, count]) => {
        const delivered = [w.spawnItem(type, material, at, count)];
        return { filter: {}, count, reserved: delivered.slice(), delivered };
      });
      const before = new Set(w.game.world.entities.with(C.Item));
      const job = { id: 0, workerId: dwarf, target: { kind: 'building', ref: workshop }, inputs: jobInputs,
        data: { recipe, orderIndex: 0, globalOrder: false } } as unknown as Job;
      system.operator.producer().onComplete?.(job, ctx);
      const made = w.game.world.entities.with(C.Item).filter((id) => !before.has(id));
      expect(made.length).toBe(1);
      return made[0] as EntityId;
    };
    const item = (id: EntityId): Item => items13(w).get(id) as Item;
    const materials = registry.table('materials');
    const feather = make('make_bedding', [['cloth', 'flax_cloth', 2], ['feather', 'feather', 2]]);
    expect(item(feather)).toMatchObject({ material: materials.index('flax_cloth'), stuffing: materials.index('feather') });
    const wool = make('make_bedding', [['cloth', 'flax_cloth', 2], ['wool_raw', 'wool', 2]]);
    expect(item(wool).stuffing).toBe(materials.index('wool'));
    const pillow = make('make_pillow', [['cloth', 'flax_cloth', 1], ['straw', 'barley', 1]]);
    expect(item(pillow).stuffing).toBe(materials.index('barley'));
    // Feathers double the bedding's worth (same cloth; quality permille aside).
    const value = (id: EntityId): number => items13(w).value(id);
    if (item(feather).quality === item(wool).quality) expect(value(feather)).toBe(2 * value(wool));
  });
});

describe('T-551 rest falls by the bed', () => {
  it('rest falls 15 × rest / 100 an hour asleep', () => {
    const zero = { hunger: 0, thirst: 0, rest: 60, social: 0, comfort: 0, purpose: 0, joy: 0 };
    expect(advanceNeeds(zero, 50, 100, true, false).rest).toBe(60 + REST_ASLEEP_PER_HOUR);
    expect(advanceNeeds(zero, 50, 100, true, false, FLOOR_REST_PERCENT).rest).toBe(60 + REST_ASLEEP_PER_HOUR / 2);
    expect(advanceNeeds(zero, 50, 100, true, false, 60).rest).toBe(51);
    expect(advanceNeeds(zero, 50, 100, true, false, MADE_UP_REST_PERCENT).rest).toBe(60 - 18.75);
  });

  it('a dwarf with no bed sleeps on the floor at 50: twice as long as in a bed', () => {
    const run = (withBed: boolean): { ticks: number; event: GameEvent } => {
      const w = new TestWorld({ seed: 't551-floor', world: 'flat-test', embark: 'none' });
      const tiles = room(w, 10, 30, 3, 2);
      if (withBed) w.build('bed', tiles[0] as TileIndex, 'oak');
      w.step(10);
      const dwarf = w.spawnDwarf({ at: tiles[4] as TileIndex });
      w.setNeed(dwarf, 'rest', 89);
      const start = w.tick;
      w.until((v) => slept(v, dwarf).length > 0, 2000);
      const event = slept(w, dwarf)[0] as GameEvent;
      return { ticks: w.tick - start, event };
    };
    const floor = run(false);
    const bed = run(true);
    expect(floor.event).toMatchObject({ onFloor: true, rest: FLOOR_REST_PERCENT, bedding: 'none', bedType: '' });
    expect(bed.event).toMatchObject({ onFloor: false, rest: 100, bedding: 'none', bedType: 'bed' });
    // From 89, rest 0 is 89 / 7.5 hours on the floor and 89 / 15 in a bed, within the hour's rounding.
    expect(floor.ticks).toBeGreaterThan(1.8 * bed.ticks);
    expect(floor.ticks).toBeLessThan(SLEEP_HOURS * TICKS_PER_HOUR * 100 / FLOOR_REST_PERCENT);
  });
});

describe('T-551 pallets', () => {
  it('seven dwarves of the default embark lay seven pallets of cloth on the first day and sleep on them; one taken apart returns its cloth', () => {
    const w = new TestWorld({ seed: 't551-pallets', world: 'flat-test', embark: 'default' });
    const reader = b14(w);
    const wagon = reader.get(reader.wagon());
    expect(wagon).toBeDefined();
    const map = w.map;
    const wx = map.xOf(wagon?.origin as TileIndex);
    const wy = map.yOf(wagon?.origin as TileIndex);
    const wz = map.zOf(wagon?.origin as TileIndex);
    // The wagon's cloth and more of it beside the wagon: 14 units for 7 pallets.
    w.spawnItem('cloth', 'flax_cloth', w.index(wx + 4, wy, wz), 10);
    const dwarves = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress');
    expect(dwarves.length).toBe(7);
    // No beds: the embark's beds are not placed, so the pallets are the only beds.
    const pallets: EntityId[] = [];
    for (let k = 0; k < 7; k += 1) {
      const at = w.index(wx - 3 + k, wy + 4, wz);
      expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'pallet', origin: at, orientation: 0, materialChoice: 0, priority: 4 })).toEqual({ ok: true });
      pallets.push(reader.at(at));
    }
    const start = w.tick;
    w.until((v) => pallets.every((id) => b14(v).get(id)?.state === 'built'), 12 * TICKS_PER_HOUR);
    const laid = w.tick - start;
    for (const id of pallets) expect(reader.get(id)).toMatchObject({ state: 'built', itemId: 0 });
    expect(laid).toBeLessThanOrEqual(6 * TICKS_PER_HOUR);
    // Laid from materials: no linked item, two cloth consumed and kept for taking apart; no xp for the layer.
    expect(reader.get(pallets[0] as EntityId)?.settings['inputs']).toEqual([{ type: 'cloth', material: registry.table('materials').index('flax_cloth') }, { type: 'cloth', material: registry.table('materials').index('flax_cloth') }]);
    expect(reader.restPercent(pallets[0] as EntityId)).toBe(60);
    // The night: every founder sleeps on a pallet and thinks so.
    w.until((v) => dwarves.every((id) => slept(v, id).length > 0), 2 * 1200);
    for (const id of dwarves) {
      const event = slept(w, id)[0] as GameEvent;
      expect(event).toMatchObject({ onFloor: false, rest: 60, bedType: 'pallet', bedding: 'none' });
    }
    expect(dwarves.some((id) => thoughtIds(w, id).includes('slept_on_a_pallet'))).toBe(true);
    // Taking one apart returns its two cloth.
    const clothBefore = items13(w).count('cloth');
    expect(w.game.world.applyCommand({ type: 'DeconstructBuilding', buildingId: pallets[6] })).toEqual({ ok: true });
    w.until((v) => b14(v).get(pallets[6] as EntityId) === undefined, 1200);
    expect(reader.get(pallets[6] as EntityId)).toBeUndefined();
    expect(items13(w).count('cloth')).toBe(clothBefore + 2);
  });

  it('a child lays a pallet: its labor is hauling, which children have', () => {
    const w = new TestWorld({ seed: 't551-child', world: 'flat-test', embark: 'none' });
    const tiles = room(w, 10, 30, 4, 3);
    const child = w.spawnDwarf({ at: tiles[0] as TileIndex, ageYears: 6 });
    w.spawnItem('straw', 'barley', tiles[1] as TileIndex, 3);
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'straw_pallet', origin: tiles[10] as TileIndex, orientation: 0, materialChoice: 0, priority: 4 })).toEqual({ ok: true });
    const id = b14(w).at(tiles[10] as TileIndex);
    w.until((v) => b14(v).get(id)?.state === 'built', 600);
    expect(b14(w).get(id)?.state).toBe('built');
    expect(w.events('JobCompleted').some((e) => e['workerId'] === child && e['jobType'] === 'build')).toBe(true);
    // No skill: laying a pallet trains no `building`.
    const building = registry.table('skills').index('building');
    expect(w.game.world.entities.get(child, C.Skills)?.xp[building] ?? 0).toBe(0);
  });
});

describe('T-551 a bed wants its bedding and pillow', () => {
  function bedroom(seed: string): { w: TestWorld; bed: EntityId; dwarf: EntityId; tiles: TileIndex[] } {
    const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
    const tiles = room(w, 10, 30, 4, 3);
    const zone = w.zone('bedroom', tiles.slice(0, 4));
    const bed = w.build('bed', tiles[0] as TileIndex, 'oak');
    w.step(10);
    const dwarf = w.spawnDwarf({ at: tiles[8] as TileIndex });
    expect(w.game.world.applyCommand({ type: 'AssignRoom', zoneId: zone, dwarfId: dwarf })).toEqual({ ok: true });
    return { w, bed, dwarf, tiles };
  }

  it('haulers make a bed up: the held items are installed, the bed rests at 125 and its sleeper thinks soft', () => {
    const { w, bed, dwarf, tiles } = bedroom('t551-made-up');
    expect(b14(w).wants(bed)).toEqual([{ match: 'bedding', count: 1, held: 0, coming: 0 }, { match: 'pillow', count: 1, held: 0, coming: 0 }]);
    const bedding = stuffed(w, 'bedding', tiles[11] as TileIndex, 'wool');
    const pillow = stuffed(w, 'pillow', tiles[10] as TileIndex, 'feather');
    expect(items13(w).get(bedding)?.stuffing).toBe(registry.table('materials').index('wool'));
    w.until((v) => b14(v).held(bed).length === 2, 1200);
    expect(b14(w).held(bed).sort((a, b) => a - b)).toEqual([bedding, pillow].sort((a, b) => a - b));
    for (const it of [bedding, pillow]) {
      expect(((items13(w).get(it)?.flags ?? 0) & ItemFlag.Installed) !== 0).toBe(true);
      expect(w.game.world.entities.get(it, C.Position)).toBeUndefined();
    }
    expect(items13(w).available('bedding')).toBe(0);
    expect(items13(w).count('bedding')).toBe(1);
    expect(b14(w).restPercent(bed)).toBe(MADE_UP_REST_PERCENT);
    // Wool in one and feathers in the other: soft, not a featherbed.
    expect(b14(w).bedding(bed)).toBe('soft');
    // Saved and loaded: `Building.held` and `Item.stuffing` come back; a save from before them (no
    // `held`, no `stuffing`) loads as a bed that holds nothing.
    const loaded = roundTrip(w.game).game;
    const after = loaded.world.readers.of<BuildingsReader>('14');
    expect(after.held(bed).sort((a, b) => a - b)).toEqual([bedding, pillow].sort((a, b) => a - b));
    expect(after.restPercent(bed)).toBe(MADE_UP_REST_PERCENT);
    expect(loaded.world.entities.get(pillow, C.Item)?.stuffing).toBe(registry.table('materials').index('feather'));
    const old = roundTrip(w.game).game;
    const { held: _held, ...withoutHeld } = old.world.entities.get(bed, C.Building) as Building;
    old.world.entities.add(bed, C.Building, withoutHeld);
    const { stuffing: _stuffing, ...plainPillow } = old.world.entities.get(pillow, C.Item) as Item;
    old.world.entities.add(pillow, C.Item, plainPillow);
    const oldLoaded = roundTrip(old).game.world.readers.of<BuildingsReader>('14');
    expect(oldLoaded.held(bed)).toEqual([]);
    expect(oldLoaded.restPercent(bed)).toBe(100);
    w.setNeed(dwarf, 'rest', 89);
    w.until((v) => slept(v, dwarf).length > 0, 2000);
    expect(slept(w, dwarf)[0]).toMatchObject({ rest: MADE_UP_REST_PERCENT, bedding: 'soft', bedType: 'bed', onFloor: false });
    expect(thoughtIds(w, dwarf)).toContain('slept_in_a_soft_bed');
    // Taken out: both drop on the bed's tile, unflagged.
    expect(w.game.world.applyCommand({ type: 'ReleaseHeld', buildingId: bed })).toEqual({ ok: true });
    expect(b14(w).held(bed)).toEqual([]);
    for (const it of [bedding, pillow]) {
      expect(((items13(w).get(it)?.flags ?? 0) & ItemFlag.Installed)).toBe(0);
      expect(items13(w).tileOf(it)).toBe(tiles[0]);
    }
    expect(w.game.world.applyCommand({ type: 'ReleaseHeld', buildingId: bed })).toMatchObject({ ok: false, reason: 'precondition_failed' });
  });

  it('feathers in both make a featherbed: its thought, double worth; bedding alone rests at 125 with no thought; the bed taken apart drops what it holds', () => {
    const { w, bed, dwarf, tiles } = bedroom('t551-featherbed');
    const bedding = stuffed(w, 'bedding', tiles[11] as TileIndex, 'feather');
    const plain = w.spawnItem('bedding', 'flax_cloth', tiles[9] as TileIndex, 1, 2);
    // A feather bedding is worth twice the plain one of the same cloth and quality.
    expect(items13(w).value(bedding)).toBe(2 * items13(w).value(plain));
    w.items.destroy(plain, 'test');
    w.until((v) => b14(v).held(bed).length === 1, 1200);
    // Bedding and no pillow: made up, no bedding thought.
    expect(b14(w).restPercent(bed)).toBe(MADE_UP_REST_PERCENT);
    expect(b14(w).bedding(bed)).toBe('none');
    const pillow = stuffed(w, 'pillow', tiles[10] as TileIndex, 'feather');
    w.until((v) => b14(v).held(bed).length === 2, 1200);
    expect(b14(w).bedding(bed)).toBe('feather');
    w.setNeed(dwarf, 'rest', 89);
    w.until((v) => slept(v, dwarf).length > 0, 2000);
    expect(slept(w, dwarf)[0]).toMatchObject({ bedding: 'feather' });
    const ids = thoughtIds(w, dwarf);
    expect(ids).toContain('slept_in_a_featherbed');
    expect(ids).not.toContain('slept_in_a_soft_bed');
    // The held items count in the room's furniture.
    const zone = b14(w).zonesAt(tiles[0] as TileIndex)[0] as EntityId;
    expect(b14(w).roomScore(zone)?.parts.furniture).toBeGreaterThan((items13(w).value(b14(w).get(bed)?.itemId ?? 0)) / 10);
    expect(w.game.world.applyCommand({ type: 'DeconstructBuilding', buildingId: bed })).toEqual({ ok: true });
    w.until((v) => b14(v).get(bed) === undefined, 1200);
    for (const it of [bedding, pillow]) {
      expect(((items13(w).get(it)?.flags ?? 0) & ItemFlag.Installed)).toBe(0);
      expect(items13(w).tileOf(it)).toBeGreaterThanOrEqual(0);
    }
  });

  it('a stone bed wants nothing and rests at 75', () => {
    const w = new TestWorld({ seed: 't551-stone-bed', world: 'flat-test', embark: 'none' });
    const tiles = room(w, 10, 30, 3, 2);
    const bed = w.build('stone_bed', tiles[0] as TileIndex, 'granite');
    expect(b14(w).wants(bed)).toEqual([]);
    expect(b14(w).withWants()).toEqual([]);
    expect(b14(w).restPercent(bed)).toBe(75);
    expect(b14(w).bedding(bed)).toBe('none');
  });
});
