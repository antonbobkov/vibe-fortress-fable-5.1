import { describe, it, expect } from 'vitest';
import { C, ItemFlag } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { itemValue, type ItemsReader } from '@systems/items';
import * as K from '@systems/items/constants';
import { TestWorld } from '../../scenarios/test-world';
import { tuningConstants } from '../system-constants';

const Z = 32;

function world(seed = 'items'): TestWorld {
  return new TestWorld({ seed, world: 'flat-test' });
}

function items(w: TestWorld): ItemsReader {
  return w.readers.of<ItemsReader>('13');
}

describe('T-M2-01 items: tuning constants', () => {
  it('every numeric row of 13 § Tuning constants is in the constants file with its value', () => {
    const rows = tuningConstants('02-systems/13-items-and-storage.md');
    expect(rows.length).toBeGreaterThanOrEqual(11);
    const values = K as unknown as Record<string, number>;
    for (const row of rows) expect([row.name, values[row.name]]).toEqual([row.name, row.value]);
  });
});

describe('T-M2-01 items: value', () => {
  it('reproduces all seven value examples of items.md § Value examples', () => {
    const w = world();
    const at = w.index(10, 10, Z);
    const cases: [string, string, number, number, number][] = [
      // [type, material, quality, count, marks]
      ['bed', 'oak', 1, 1, 15], // Common oak bed: 3 × 5 × 1.0
      ['door', 'granite', 2, 1, 12], // Fine granite door: 2 × 4 × 1.5
      ['breastplate', 'steel', 5, 1, 4000], // Masterwork steel breastplate: 40 × 20 × 5.0
      ['bolt', 'copper', 1, 25, 50], // Stack of 25 copper bolts: 10 × 0.2 × 25
      ['drink', 'dimcap_ale', 1, 20, 40], // Barrel of 20 dimcap ale: 2 × 1 × 20
      ['cut_gem', 'emerald', 1, 1, 120], // Cut emerald: 40 × 3
      ['bar', 'deepsilver', 1, 1, 250], // Deepsilver bar: 250
    ];
    for (const [type, material, quality, count, marks] of cases) {
      const id = w.spawnItem(type, material, at, count, quality);
      expect([type, items(w).value(id)]).toEqual([type, marks]);
    }
  });

  it('non-quality types count 1.0 whatever their quality; truncation is to whole marks', () => {
    expect(itemValue(250, 1000, 5, false, 1)).toBe(250);
    expect(itemValue(2, 1500, 0, true, 1)).toBe(1); // 2 × 1.5 × 0.5 = 1.5 → 1
    expect(itemValue(2, 1500, 1, true, 5)).toBe(15);
  });
});

describe('T-M2-01 items: spawning and placement', () => {
  it('spawn.item creates an item entity with a Position, indexed on its tile, and ItemCreated', () => {
    const w = world();
    const t = w.index(12, 12, Z);
    const id = w.spawnItem('log', 'oak', t);
    expect(id).not.toBe(0);
    expect(w.game.world.entities.kind(id)).toBe('item');
    expect(items(w).at(t)).toEqual([id]);
    expect(items(w).get(id)).toMatchObject({ count: 1, quality: 1, containerId: 0, carriedBy: 0, flags: 0 });
    w.step(1);
    expect(w.events('ItemCreated')).toEqual([expect.objectContaining({ id, itemType: 'log', material: 'oak', count: 1 })]);
  });

  it('a count above the stack size makes several stacks on the same tile', () => {
    const w = world();
    const t = w.index(12, 12, Z);
    w.spawnItem('log', 'oak', t, 3);
    w.spawnItem('stone_block', 'granite', t, 7);
    const on = items(w).at(t).map((id) => items(w).get(id)?.count);
    expect(on).toEqual([1, 1, 1, 5, 2]);
    expect(items(w).count('log')).toBe(3);
    expect(items(w).count('stone_block')).toBe(7);
  });

  it('falling items land on the first solid-bottomed tile below', () => {
    const w = world();
    const terrain = w.game.world.services.terrain;
    // A two-deep hole: (20, 20, 32) and (20, 20, 31) opened, (20, 20, 30) a floor.
    terrain.setKind(w.index(20, 20, 32), TileKind.Open, 0);
    terrain.setKind(w.index(20, 20, 31), TileKind.Open, 0);
    terrain.setKind(w.index(20, 20, 30), TileKind.Floor, w.map.materialAt(w.index(20, 20, 30)));
    const id = w.spawnItem('raw_stone', 'granite', w.index(20, 20, 33));
    expect(items(w).tileOf(id)).toBe(w.index(20, 20, 30));
    // An item on a tile that loses its bottom falls on TilesChanged.
    const other = w.spawnItem('raw_stone', 'granite', w.index(21, 20, Z));
    terrain.setKind(w.index(21, 20, Z - 1), TileKind.Floor, w.map.materialAt(w.index(21, 20, Z - 1)));
    terrain.setKind(w.index(21, 20, Z), TileKind.Open, 0);
    expect(items(w).tileOf(other)).toBe(w.index(21, 20, Z));
    w.step(1);
    expect(items(w).tileOf(other)).toBe(w.index(21, 20, Z - 1));
  });

  it('spawn.item into a container: no Position, listed in the container, found through it', () => {
    const w = world();
    const t = w.index(14, 14, Z);
    const barrel = w.spawnItem('barrel', 'oak', t);
    const ale = w.spawnItem('drink', 'dimcap_ale', { containerId: barrel }, 20);
    expect(items(w).containerRecord(barrel)).toMatchObject({ classId: 'barrel', capacity: K.BARREL_CAPACITY, contents: [ale] });
    expect(items(w).containerOf(ale)).toBe(barrel);
    expect(w.game.world.entities.has(ale, C.Position)).toBe(false);
    expect(items(w).tileOf(ale)).toBe(t);
    expect(items(w).at(t)).toEqual([barrel]);
    expect(items(w).room(barrel)).toBe(0);
    // A full barrel refuses more; the item lands on the barrel's tile instead.
    const more = w.spawnItem('drink', 'ale', { containerId: barrel }, 1);
    expect(items(w).containerOf(more)).toBe(0);
    expect(items(w).tileOf(more)).toBe(t);
  });

  it('a bin counts items, a barrel units; destroying a container leaves its contents on its tile', () => {
    const w = world();
    const t = w.index(15, 15, Z);
    const bin = w.spawnItem('bin', 'oak', t);
    const a = w.spawnItem('bolt', 'copper', { containerId: bin }, 25);
    w.spawnItem('ring', 'granite', { containerId: bin });
    expect(items(w).room(bin)).toBe(K.BIN_CAPACITY - 2);
    w.items.destroy(bin, 'test');
    expect(items(w).tileOf(a)).toBe(t);
    expect(items(w).at(t)).toHaveLength(2);
  });
});

describe('T-M2-01 items: stacks and the item API', () => {
  it('split and merge conserve units and value', () => {
    const w = world();
    const t = w.index(16, 16, Z);
    const a = w.spawnItem('bolt', 'copper', t, 40);
    const valueBefore = items(w).wealth();
    const b = w.items.split(a, 15);
    expect(items(w).get(a)?.count).toBe(25);
    expect(items(w).get(b)?.count).toBe(15);
    expect(items(w).tileOf(b)).toBe(t);
    expect(items(w).count('bolt')).toBe(40);
    expect(items(w).wealth()).toBe(valueBefore);
    expect(w.items.merge(a, b)).toBe(true);
    expect(w.game.world.entities.alive(b)).toBe(false);
    expect(items(w).get(a)?.count).toBe(40);
    expect(items(w).count('bolt')).toBe(40);
    expect(items(w).wealth()).toBe(valueBefore);
    // Not identical (another material) or over the stack size: no merge.
    const c = w.spawnItem('bolt', 'iron', t, 5);
    expect(w.items.merge(a, c)).toBe(false);
    const d = w.spawnItem('bolt', 'copper', t, 20);
    expect(w.items.merge(a, d)).toBe(false);
    expect(w.items.split(a, 0)).toBe(0);
    expect(w.items.split(a, 40)).toBe(0);
  });

  it('carry, drop, put in, take out move the item between the ground, hands and containers', () => {
    const w = world();
    const dwarf = w.spawnDwarf({ at: w.index(30, 30, Z) });
    const t = w.index(31, 30, Z);
    const log = w.spawnItem('log', 'oak', t);
    w.items.attachToCarrier(log, dwarf);
    expect(items(w).at(t)).toEqual([]);
    expect(items(w).get(log)?.carriedBy).toBe(dwarf);
    expect(items(w).tileOf(log)).toBe(w.index(30, 30, Z));
    w.items.dropAt(log, w.index(32, 30, Z));
    expect(items(w).at(w.index(32, 30, Z))).toEqual([log]);
    expect(items(w).get(log)?.carriedBy).toBe(0);
    const bag = w.spawnItem('bag', 'flax_cloth', t);
    const seeds = w.spawnItem('seed', 'barley', t, 10);
    expect(w.items.putIn(seeds, bag)).toBe(true);
    expect(items(w).at(t)).toEqual([bag]);
    w.items.takeOut(seeds);
    expect(items(w).at(t).sort()).toEqual([bag, seeds].sort());
    w.items.consume(seeds, 4);
    expect(items(w).get(seeds)?.count).toBe(6);
    w.items.consume(seeds, 6);
    expect(w.game.world.entities.alive(seeds)).toBe(false);
    w.step(1);
    expect(w.events('ItemDestroyed')).toEqual([expect.objectContaining({ id: seeds, itemType: 'seed', reason: 'consumed' })]);
  });

  it('flags, owner and reservation change availability, not the total', () => {
    const w = world();
    const t = w.index(17, 17, Z);
    const logs: EntityId[] = [];
    for (let k = 0; k < 4; k += 1) logs.push(w.spawnItem('log', 'pine', t));
    expect(items(w).stock('log')).toMatchObject({ total: 4, available: 4 });
    w.items.setFlag(logs[0] as EntityId, ItemFlag.Forbidden, true);
    w.items.reserve(logs[1] as EntityId, 7);
    w.items.setOwner(logs[2] as EntityId, 99);
    expect(items(w).stock('log')).toMatchObject({ total: 4, available: 1 });
    expect(items(w).get(logs[1] as EntityId)).toMatchObject({ reservedBy: 7 });
    w.items.release(logs[1] as EntityId);
    w.items.setOwner(logs[2] as EntityId, 0);
    expect(items(w).stock('log')).toMatchObject({ total: 4, available: 3 });
  });
});

describe('T-M2-01 items: counts, wealth and their events', () => {
  it('StocksChanged is batched per items tick for the changed types; wealth tracks item values', () => {
    const w = world();
    const t = w.index(18, 18, Z);
    const wealth0 = items(w).wealth();
    for (let k = 0; k < 10; k += 1) w.spawnItem('table', 'granite', t);
    w.spawnItem('log', 'oak', t);
    expect(items(w).wealth() - wealth0).toBe(80 + 3);
    w.step(12);
    const stocks = w.events('StocksChanged');
    expect(stocks).toHaveLength(1);
    const types = w.game.registry.table('items');
    expect(stocks[0]?.['types']).toEqual([types.index('log'), types.index('table')].sort((a, b) => a - b));
    expect(w.game.world.fortress.wealthCached).toBe(items(w).wealth());
    // Below WEALTH_EVENT_STEP there is no WealthChanged; past it there is one.
    expect(w.events('WealthChanged')).toHaveLength(0);
    w.spawnItem('breastplate', 'steel', t, 1, 5);
    w.step(10);
    expect(w.events('WealthChanged')).toEqual([expect.objectContaining({ wealth: items(w).wealth() })]);
  });

  it('the incremental counts equal a recount after a mixed stream', () => {
    const w = world();
    const t = w.index(19, 19, Z);
    const a = w.spawnItem('bolt', 'copper', t, 50);
    const b = w.items.split(a, 20);
    w.items.setFlag(b, ItemFlag.Forbidden, true);
    w.spawnItem('ore', 'hematite', t, 3);
    const game = w.game.world.services.items;
    expect(game).not.toBeNull();
    const system = w.game.world.scheduler.byId('13') as unknown as { core: { recount(): { rows: [number, number, number][]; wealth: number } } };
    const recount = system.core.recount();
    for (const [type, total, available] of recount.rows) {
      expect([type, items(w).count(type), items(w).available(type)]).toEqual([type, total, available]);
    }
    expect(items(w).wealth()).toBe(recount.wealth);
  });
});

describe('T-M2-01 items: flag commands', () => {
  it('ForbidItem, ClaimItem, DumpItem and MeltItem by id, tiles and type', () => {
    const w = world();
    const t = w.index(22, 22, Z);
    const log = w.spawnItem('log', 'oak', t);
    const bar = w.spawnItem('bar', 'iron', w.index(23, 22, Z));
    const apply = (cmd: Record<string, unknown>): unknown => w.game.world.applyCommand(cmd as never);
    expect(apply({ type: 'ForbidItem', itemId: log, on: true })).toEqual({ ok: true });
    expect(items(w).get(log)?.flags).toBe(ItemFlag.Forbidden);
    expect(apply({ type: 'ClaimItem', itemId: log })).toEqual({ ok: true });
    expect(items(w).get(log)?.flags).toBe(0);
    expect(apply({ type: 'DumpItem', tiles: [t], on: true })).toEqual({ ok: true });
    expect(items(w).get(log)?.flags).toBe(ItemFlag.Dump);
    expect(apply({ type: 'MeltItem', itemId: log, on: true })).toEqual({ ok: false, reason: 'not_metal' });
    expect(apply({ type: 'MeltItem', typeId: 'bar', on: true })).toEqual({ ok: true });
    expect(items(w).get(bar)?.flags).toBe(ItemFlag.Melt);
    expect(apply({ type: 'ForbidItem', itemId: 424242, on: true })).toEqual({ ok: false, reason: 'not_found' });
    expect(apply({ type: 'ForbidItem', tiles: [w.index(40, 40, Z)], on: true })).toEqual({ ok: false, reason: 'not_found' });
    expect(apply({ type: 'ForbidItem', on: true })).toEqual({ ok: false, reason: 'precondition_failed' });
  });

  it('forbidding a rectangle forbids what lies in its containers too (D-068)', () => {
    const w = world();
    const t = w.index(24, 24, Z);
    const bin = w.spawnItem('bin', 'oak', t);
    const ring = w.spawnItem('ring', 'granite', { containerId: bin });
    expect(w.game.world.applyCommand({ type: 'ForbidItem', tiles: [t], on: true })).toEqual({ ok: true });
    expect(items(w).get(ring)?.flags).toBe(ItemFlag.Forbidden);
  });
});
