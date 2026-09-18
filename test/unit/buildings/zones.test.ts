import { describe, it, expect } from 'vitest';
import { C, ItemFlag } from '@core/components';
import { FluidType, Map3D, TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import * as K from '@systems/buildings/constants';
import { HAUL_PRIORITY, HAUL_PRIORITY_FOOD } from '@systems/jobs/constants';
import { TestWorld } from '../../scenarios/test-world';
import { rect } from '../../scenarios/m1-helpers';
import { tuningConstants } from '../system-constants';

const Z = 32;

function world(seed = 'zones'): TestWorld {
  const w = new TestWorld({ seed, world: 'flat-test' });
  w.step(1);
  return w;
}

function bld(w: TestWorld): BuildingsReader {
  return w.readers.of<BuildingsReader>('14');
}

function items(w: TestWorld): ItemsReader {
  return w.readers.of<ItemsReader>('13');
}

function apply(w: TestWorld, cmd: Record<string, unknown>): unknown {
  return w.game.world.applyCommand(cmd as never);
}

describe('T-M2-03 buildings: tuning constants', () => {
  it('every numeric row of 14 § Tuning constants is in the constants file with its value', () => {
    const rows = tuningConstants('02-systems/14-buildings-and-rooms.md');
    expect(rows.length).toBeGreaterThanOrEqual(9);
    const values = K as unknown as Record<string, number>;
    for (const row of rows) expect([row.name, values[row.name]]).toEqual([row.name, row.value]);
  });
});

describe('T-M2-03 zones', () => {
  it('CreateZone makes a zone entity with sorted tiles, zoneAt and ZoneChanged; resize, setting, remove', () => {
    const w = world();
    const tiles = rect(w, 10, 10, Z, 3, 2);
    const id = w.zone('bedroom', [...tiles].reverse());
    expect(bld(w).zone(id)).toMatchObject({ type: 'bedroom', tiles });
    for (const t of tiles) expect(bld(w).zoneAt(t)).toBe(id);
    expect(bld(w).zonesOfType('bedroom')).toEqual([id]);
    expect(apply(w, { type: 'SetZoneSetting', zoneId: id, key: 'owner', value: 5 })).toEqual({ ok: true });
    expect(bld(w).zoneSetting(id, 'owner')).toBe(5);
    expect(apply(w, { type: 'SetZoneSetting', zoneId: id, key: 'squad', value: 1 })).toEqual({ ok: false, reason: 'bad_setting' });
    const smaller = rect(w, 10, 10, Z, 2, 2);
    expect(apply(w, { type: 'ResizeZone', zoneId: id, tiles: smaller })).toEqual({ ok: true });
    expect(bld(w).zoneAt(w.index(12, 10, Z))).toBe(0);
    expect(apply(w, { type: 'RemoveZone', zoneId: id })).toEqual({ ok: true });
    expect(bld(w).zoneAt(w.index(10, 10, Z))).toBe(0);
    expect(w.game.world.entities.alive(id)).toBe(false);
    expect(apply(w, { type: 'RemoveZone', zoneId: id })).toEqual({ ok: false, reason: 'not_found' });
    w.step(1);
    expect(w.events('ZoneChanged').map((e) => e['change'])).toEqual(['created', 'settings', 'resized', 'removed']);
    expect(w.events('ZoneChanged')[0]).toMatchObject({ zoneId: id, zoneType: 'bedroom' });
  });

  it('zones of different types do not overlap, except a meeting area over a hearth or dining hall', () => {
    const w = world();
    const hall = w.zone('dining_hall', rect(w, 20, 20, Z, 4, 4));
    expect(apply(w, { type: 'CreateZone', zoneType: 'stockpile', tiles: rect(w, 23, 23, Z, 2, 2) })).toEqual({ ok: false, reason: 'overlap' });
    expect(apply(w, { type: 'CreateZone', zoneType: 'dining_hall', tiles: rect(w, 23, 23, Z, 2, 2) })).toEqual({ ok: false, reason: 'overlap' });
    const meet = w.zone('meeting_area', rect(w, 22, 22, Z, 3, 3));
    expect(bld(w).zoneAt(w.index(22, 22, Z))).toBe(hall);
    expect(bld(w).zoneAt(w.index(24, 24, Z))).toBe(meet);
    expect(bld(w).zonesAt(w.index(22, 22, Z))).toEqual([hall, meet].sort((a, b) => a - b));
    expect(apply(w, { type: 'CreateZone', zoneType: 'meeting_area', tiles: [w.index(24, 24, Z)] })).toEqual({ ok: false, reason: 'overlap' });
    // Removing the hall hands its tiles under the meeting area back to it.
    expect(apply(w, { type: 'RemoveZone', zoneId: hall })).toEqual({ ok: true });
    expect(bld(w).zoneAt(w.index(22, 22, Z))).toBe(meet);
    expect(bld(w).zoneAt(w.index(20, 20, Z))).toBe(0);
  });

  it('tiles must be walkable; farm plots need soil, mud or cave loam; fishing needs deep water beside', () => {
    const w = world();
    const granite = w.game.registry.table('materials').index('granite');
    const terrain = w.game.world.services.terrain;
    // flat-test's surface floor is loam (soil): farmable. A granite floor is not.
    expect(bld(w).zoneTileQualifies('farm_plot', w.index(30, 30, Z))).toBe(true);
    terrain.setKind(w.index(31, 30, Z), TileKind.Floor, granite);
    expect(bld(w).zoneTileQualifies('farm_plot', w.index(31, 30, Z))).toBe(false);
    expect(apply(w, { type: 'CreateZone', zoneType: 'farm_plot', tiles: [w.index(30, 30, Z), w.index(31, 30, Z)] })).toEqual({
      ok: false,
      reason: 'bad_zone_tiles',
    });
    terrain.setKind(w.index(32, 30, Z), TileKind.Wall, granite);
    w.step(1);
    expect(apply(w, { type: 'CreateZone', zoneType: 'pasture', tiles: [w.index(32, 30, Z)] })).toEqual({ ok: false, reason: 'bad_zone_tiles' });
    const shore = w.index(40, 40, Z);
    expect(bld(w).zoneTileQualifies('fishing', shore)).toBe(false);
    w.map.fluid[w.index(41, 40, Z)] = Map3D.packFluid(4, FluidType.Water, false, false);
    expect(bld(w).zoneTileQualifies('fishing', shore)).toBe(true);
    // A diagonal neighbour does not count; shallow water does not either.
    w.map.fluid[w.index(41, 40, Z)] = 0;
    w.map.fluid[w.index(41, 41, Z)] = Map3D.packFluid(7, FluidType.Water, false, false);
    w.map.fluid[w.index(40, 41, Z)] = Map3D.packFluid(3, FluidType.Water, false, false);
    expect(bld(w).zoneTileQualifies('fishing', shore)).toBe(false);
    expect(apply(w, { type: 'CreateZone', zoneType: 'nowhere', tiles: [shore] })).toEqual({ ok: false, reason: 'not_found' });
    expect(apply(w, { type: 'CreateZone', zoneType: 'dump', tiles: [-5] })).toEqual({ ok: false, reason: 'out_of_bounds' });
  });
});

describe('T-M2-03 stockpiles', () => {
  it('a stockpile zone gets 13\'s component with an empty filter; presets and priorities', () => {
    const w = world();
    const sp = w.zone('stockpile', rect(w, 10, 30, Z, 5, 4));
    expect(items(w).stockpile(sp)).toMatchObject({
      filter: { categories: [], materialClasses: 'any', minQuality: 0, maxQuality: 5, allowRot: false },
      containersWanted: { barrel: 0, bag: 0, bin: 0 },
      priority: HAUL_PRIORITY,
    });
    expect(items(w).stockpileAt(w.index(12, 31, Z))).toBe(sp);
    expect(apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'food' })).toEqual({ ok: true });
    expect(items(w).stockpile(sp)?.priority).toBe(HAUL_PRIORITY_FOOD);
    expect(apply(w, { type: 'SetStockpilePriority', zoneId: sp, priority: 2 })).toEqual({ ok: true });
    expect(apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'stone' })).toEqual({ ok: true });
    expect(items(w).stockpile(sp)?.priority).toBe(2);
    expect(apply(w, { type: 'SetStockpilePriority', zoneId: sp, priority: 10 })).toEqual({ ok: false, reason: 'out_of_range' });
    expect(apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: { categories: ['food/nothing'] } })).toEqual({ ok: false, reason: 'bad_category' });
    expect(apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'no_such_preset' })).toEqual({ ok: false, reason: 'bad_category' });
    expect(apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: { categories: ['wood'], minQuality: 4, maxQuality: 2 } })).toEqual({
      ok: false,
      reason: 'out_of_range',
    });
    expect(apply(w, { type: 'SetStockpileContainers', zoneId: sp, wants: { barrel: 2 } })).toEqual({ ok: true });
    expect(apply(w, { type: 'SetStockpileContainers', zoneId: sp, wants: { crate: 2 } })).toEqual({ ok: false, reason: 'bad_setting' });
    const bedroom = w.zone('bedroom', [w.index(50, 50, Z)]);
    expect(apply(w, { type: 'SetStockpileFilter', zoneId: bedroom, filter: 'food' })).toEqual({ ok: false, reason: 'not_found' });
    expect(apply(w, { type: 'SetZoneSetting', zoneId: sp, key: 'filter', value: 'food' })).toEqual({ ok: false, reason: 'bad_setting' });
  });

  it('accepts: category subtree, material class, quality range, rot, forbidden, links', () => {
    const w = world();
    const sp = w.zone('stockpile', rect(w, 10, 30, Z, 3, 3));
    const other = w.zone('stockpile', rect(w, 20, 30, Z, 3, 3));
    apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: { categories: ['furniture', 'stone/block'], materialClasses: ['stone'], minQuality: 1, maxQuality: 3 } });
    const t = w.index(40, 40, Z);
    const table = w.spawnItem('table', 'granite', t, 1, 2);
    const oakTable = w.spawnItem('table', 'oak', t, 1, 2);
    const poor = w.spawnItem('table', 'granite', t, 1, 0);
    const master = w.spawnItem('table', 'granite', t, 1, 5);
    const block = w.spawnItem('stone_block', 'granite', t, 1, 1);
    const raw = w.spawnItem('raw_stone', 'granite', t);
    const cases: [EntityId, boolean][] = [
      [table, true],
      [oakTable, false], // material class
      [poor, false], // below the range
      [master, false], // above the range
      [block, true], // subtree `stone/block`
      [raw, false], // `stone/raw` not selected
    ];
    for (const [id, want] of cases) expect([id, items(w).stockpileAccepts(sp, id)]).toEqual([id, want]);
    // Forbidden: refused.
    w.items.setFlag(table, ItemFlag.Forbidden, true);
    expect(items(w).stockpileAccepts(sp, table)).toBe(false);
    w.items.setFlag(table, ItemFlag.Forbidden, false);
    // A type bearing no quality ignores the range (D-071): bars in an ore-and-bars pile of quality ≥ 2.
    apply(w, { type: 'SetStockpileFilter', zoneId: other, filter: { preset: 'ore_and_bars', minQuality: 2 } });
    expect(items(w).stockpileAccepts(other, w.spawnItem('bar', 'iron', t))).toBe(true);
    // Rot: a rotting item needs allowRot.
    const meat = w.spawnItem('raw_meat', 'granite', t);
    apply(w, { type: 'SetStockpileFilter', zoneId: other, filter: 'food' });
    expect(items(w).stockpileAccepts(other, meat)).toBe(true);
    const rec = w.game.world.entities.get(meat, C.Item);
    w.game.world.entities.add(meat, C.Item, { ...(rec as NonNullable<typeof rec>), rotStage: 2 });
    expect(items(w).stockpileAccepts(other, meat)).toBe(false);
    apply(w, { type: 'SetStockpileFilter', zoneId: other, filter: { preset: 'food', allowRot: true } });
    expect(items(w).stockpileAccepts(other, meat)).toBe(true);
    // Links: only items already in a linked stockpile.
    expect(apply(w, { type: 'LinkStockpile', zoneId: sp, sourceZoneId: other, on: true })).toEqual({ ok: true });
    expect(items(w).stockpileAccepts(sp, table)).toBe(false);
    w.items.dropAt(table, w.index(21, 31, Z));
    expect(items(w).stockpileAccepts(sp, table)).toBe(true);
    expect(apply(w, { type: 'LinkStockpile', zoneId: sp, sourceZoneId: other, on: false })).toEqual({ ok: true });
    expect(items(w).stockpile(sp)?.linkedSources).toEqual([]);
    expect(apply(w, { type: 'LinkStockpile', zoneId: sp, sourceZoneId: sp, on: true })).toEqual({ ok: false, reason: 'not_found' });
  });

  it('findSlot fills empty tiles in (y, x) order, then merges into an identical stack; reservations hold tiles', () => {
    const w = world();
    const tiles = rect(w, 10, 30, Z, 3, 2);
    const sp = w.zone('stockpile', tiles);
    apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'stone' });
    const src = w.index(40, 40, Z);
    const blocks = w.spawnItem('stone_block', 'granite', src, 2);
    const slot = items(w).findSlot(sp, blocks) as { tile: TileIndex; key: string };
    expect(slot.tile).toBe(tiles[0]);
    // Fill every tile but the last with raw stone; the reservation keeps a tile out of the answer.
    const store = (w.game.world.scheduler.byId('13') as unknown as { stockpiles: { reserve(s: unknown, j: number): void } }).stockpiles;
    for (let k = 0; k < tiles.length - 1; k += 1) w.spawnItem('raw_stone', 'granite', tiles[k] as TileIndex);
    expect((items(w).findSlot(sp, blocks) as { tile: TileIndex }).tile).toBe(tiles[tiles.length - 1]);
    store.reserve(items(w).findSlot(sp, blocks), 99);
    expect(items(w).freeSlots(sp)).toBe(0);
    expect(items(w).findSlot(sp, blocks)).toBeNull();
    // An identical stack with room is a merge slot.
    const pileBlocks = w.spawnItem('stone_block', 'granite', w.index(60, 60, Z), 1);
    w.items.destroy(items(w).at(tiles[0] as TileIndex)[0] as EntityId, 'test');
    w.items.dropAt(pileBlocks, tiles[0] as TileIndex);
    expect(items(w).findSlot(sp, blocks)).toMatchObject({ tile: tiles[0], merge: pileBlocks });
  });

  it('container slots: a barrel of ale takes a tile; loose drink needs a barrel; barrels wanted are asked for first', () => {
    const w = world();
    const sp = w.zone('stockpile', rect(w, 10, 30, Z, 3, 3));
    apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'drink' });
    const t = w.index(40, 40, Z);
    const barrel = w.spawnItem('barrel', 'oak', t);
    w.spawnItem('drink', 'dimcap_ale', { containerId: barrel }, 20);
    expect(items(w).stockpileAccepts(sp, barrel)).toBe(true);
    expect(items(w).findSlot(sp, barrel)).toMatchObject({ container: 0, merge: 0 });
    const loose = w.spawnItem('drink', 'ale', w.index(41, 40, Z), 5);
    expect(items(w).findSlot(sp, loose)).toBeNull();
    apply(w, { type: 'SetStockpileContainers', zoneId: sp, wants: { barrel: 1 } });
    expect(items(w).findSlot(sp, loose)).toEqual({ needContainer: 'barrel' });
    const empty = w.spawnItem('barrel', 'pine', w.index(11, 30, Z));
    const slot = items(w).findSlot(sp, loose);
    expect(slot).toMatchObject({ container: empty, tile: w.index(11, 30, Z) });
    // A drink stockpile does not take the empty barrel for its own sake (not under `drink`).
    expect(items(w).stockpileAccepts(sp, w.spawnItem('barrel', 'oak', t))).toBe(false);
    expect(items(w).itemCategory(loose)).toBe('drink/ale');
  });
});
