import { describe, it, expect } from 'vitest';
import { ItemFlag } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import type { ItemsReader } from '@systems/items';
import { FIND_RADIUS_MAX } from '@systems/items/constants';
import { toolFilter } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

function world(seed = 'search'): TestWorld {
  const w = new TestWorld({ seed, world: 'flat-test' });
  w.step(1);
  return w;
}

function items(w: TestWorld): ItemsReader {
  return w.readers.of<ItemsReader>('13');
}

/** Wall a 3×3 ring around (x, y), so the centre has a label of its own. */
function pen(w: TestWorld, x: number, y: number): void {
  const granite = w.game.registry.table('materials').index('granite');
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx !== 0 || dy !== 0) w.game.world.services.terrain.setKind(w.index(x + dx, y + dy, Z), TileKind.Wall, granite);
    }
  }
}

describe('T-M2-02 item search', () => {
  it('finds the nearest match whose tile shares the searcher\'s connectivity label', () => {
    const w = world();
    const from = w.index(40, 40, Z);
    const walledIn = w.spawnItem('log', 'oak', w.index(42, 40, Z));
    pen(w, 42, 40);
    const far = w.spawnItem('log', 'oak', w.index(40, 50, Z));
    const nearer = w.spawnItem('log', 'oak', w.index(45, 40, Z));
    w.step(1);
    expect(items(w).findItem({ type: w.game.registry.table('items').index('log') }, from)).toBe(nearer);
    // The walled-in log is nearest but unreachable; the next radius holds the far one only.
    expect(items(w).findItems({ category: 'wood' }, 5, from)).toEqual([nearer, far]);
    expect(items(w).findItems({ category: 'wood' }, 5, from)).not.toContain(walledIn);
  });

  it('skips forbidden, reserved and owned items; excludeIds skips named ones', () => {
    const w = world();
    const from = w.index(40, 40, Z);
    const ids: EntityId[] = [];
    for (let k = 1; k <= 5; k += 1) ids.push(w.spawnItem('stone_block', 'granite', w.index(40 + k, 40, Z)));
    w.items.setFlag(ids[0] as EntityId, ItemFlag.Forbidden, true);
    w.items.reserve(ids[1] as EntityId, 3);
    w.items.setOwner(ids[2] as EntityId, 77);
    const filter = { category: 'stone/block' };
    expect(items(w).findItem(filter, from)).toBe(ids[3]);
    expect(items(w).findItem({ ...filter, excludeIds: [ids[3] as EntityId] }, from)).toBe(ids[4]);
    expect(items(w).findItem({ ...filter, excludeIds: [ids[3] as EntityId, ids[4] as EntityId] }, from)).toBe(0);
    // Without `reservable` every one matches, nearest first.
    expect(items(w).findItem(filter, from, 'walker', { reservable: false })).toBe(ids[0]);
    expect(items(w).countAvailable({ category: 'stone/block' })).toBe(2);
    expect(items(w).countAvailable({ type: w.game.registry.table('items').index('stone_block') })).toBe(2);
    expect(items(w).countMatching({ category: 'stone/block' })).toBe(5);
  });

  it('finds items inside containers, but not in a forbidden container or in hands', () => {
    const w = world();
    const from = w.index(40, 40, Z);
    const bin = w.spawnItem('bin', 'oak', w.index(43, 40, Z));
    const ring = w.spawnItem('ring', 'granite', { containerId: bin });
    expect(items(w).findItem({ tag: 'craft' }, from)).toBe(ring);
    expect(items(w).findItem({ category: 'craft/ring' }, from)).toBe(ring);
    expect(items(w).findItem({ emptyContainer: 'bin' }, from)).toBe(0);
    w.items.setFlag(bin, ItemFlag.Forbidden, true);
    expect(items(w).findItem({ category: 'craft/ring' }, from)).toBe(0);
    w.items.setFlag(bin, ItemFlag.Forbidden, false);
    const dwarf = w.spawnDwarf({ at: w.index(50, 50, Z) });
    w.items.attachToCarrier(ring, dwarf);
    expect(items(w).findItem({ category: 'craft/ring' }, from)).toBe(0);
    expect(items(w).findItem({ emptyContainer: 'bin' }, from)).toBe(bin);
  });

  it('beyond FIND_RADIUS_MAX the stock index still finds the item', () => {
    const w = world();
    const from = w.index(3, 3, Z);
    const t = w.index(90, 90, Z);
    expect(90 - 3).toBeGreaterThan(FIND_RADIUS_MAX);
    const bar = w.spawnItem('bar', 'iron', t);
    expect(items(w).findItem({ category: 'bar' }, from)).toBe(bar);
    expect(items(w).findItem({ category: 'bar', materialClass: 'stone' }, from)).toBe(0);
  });

  it('matches by material class and id, minimum quality, edible and drinkable', () => {
    const w = world();
    const from = w.index(40, 40, Z);
    const table = w.spawnItem('table', 'granite', w.index(41, 40, Z), 1, 1);
    const fine = w.spawnItem('table', 'oak', w.index(42, 40, Z), 1, 2);
    const meat = w.spawnItem('raw_meat', 'granite', w.index(43, 40, Z));
    const oak = w.game.registry.table('materials').index('oak');
    expect(items(w).findItem({ category: 'furniture', materialClass: 'wood' }, from)).toBe(fine);
    expect(items(w).findItem({ category: 'furniture', materialId: oak }, from)).toBe(fine);
    expect(items(w).findItem({ category: 'furniture', minQuality: 2 }, from)).toBe(fine);
    expect(items(w).findItem({ category: 'furniture' }, from)).toBe(table);
    expect(items(w).findItem({ edible: true }, from)).toBe(meat);
    expect(items(w).findItem({ drinkable: true }, from)).toBe(0);
  });
});

describe('T-M2-02 jobs use the real item search', () => {
  it('T-M2-08 (the D-070 shim is gone): the miner fetches a pick from the wagon and keeps it; with no pick anywhere the dig blocks `no_tool` until one exists', () => {
    const w = new TestWorld({ seed: 'search-tool', world: 'flat-test', embark: 'default' });
    const granite = w.game.registry.table('materials').index('granite');
    const terrain = w.game.world.services.terrain;
    const wagon = w.readers.of<{ wagon(): EntityId }>('14').wagon();
    const picks = items(w).inContainer(wagon).filter((id) => items(w).categoryOf(items(w).get(id)?.type ?? 0) === 'tool/pick');
    expect(picks).toHaveLength(2);
    const a = w.index(48, 12, Z);
    terrain.setKind(a, TileKind.Wall, granite);
    w.game.world.applyCommand({ type: 'Designate', tiles: [a], kind: 'dig' });
    w.until((x) => x.map.kindAt(a) === TileKind.Floor, 2000);
    const equipped = w.events('ToolEquipped');
    expect(equipped).toHaveLength(1);
    const pick = equipped[0]?.['itemId'] as EntityId;
    expect(picks).toContain(pick);
    const holder = equipped[0]?.['dwarfId'] as EntityId;
    expect(items(w).get(pick)).toMatchObject({ carriedBy: holder, reservedBy: 0, containerId: 0 });
    expect(toolFilter('pick')).toEqual({ category: 'tool/pick' });

    const bare = new TestWorld({ seed: 'search-no-tool', world: 'flat-test' });
    bare.spawnDwarf({ at: bare.index(48, 14, Z), skills: { mining: 5 } });
    const b = bare.index(48, 12, Z);
    bare.game.world.services.terrain.setKind(b, TileKind.Wall, granite);
    bare.game.world.applyCommand({ type: 'Designate', tiles: [b], kind: 'dig' });
    bare.until((x) => x.events('JobBlocked').length > 0, 200);
    expect(bare.events('JobBlocked')[0]).toMatchObject({ reason: 'no_tool', jobType: 'dig' });
    bare.spawnItem('pick', 'iron', bare.index(44, 14, Z));
    bare.until((x) => x.map.kindAt(b) === TileKind.Floor, 2000);
    expect(bare.events('JobUnblocked')).toHaveLength(1);
  });

  it('C-005: default-priority two-pick dig completes within 2,200 ticks after equipping', () => {
    const w = new TestWorld({ seed: 'two-picks', world: 'flat-test', embark: 'default' });
    const granite = w.game.registry.table('materials').index('granite');
    const tiles: number[] = [];
    for (let y = 20; y < 23; y += 1) {
      for (let x = 40; x < 44; x += 1) {
        const t = w.index(x, y, Z);
        w.game.world.services.terrain.setKind(t, TileKind.Wall, granite);
        tiles.push(t);
      }
    }
    w.game.world.applyCommand({ type: 'Designate', tiles, kind: 'dig' });
    w.until((x) => x.events('ToolEquipped').length === 2, 1000);
    const equipTick = w.tick;
    w.until((x) => tiles.every((t) => x.map.kindAt(t) === TileKind.Floor), 3000);
    expect(w.tick - equipTick).toBeLessThanOrEqual(2200);
  });

  it('D-076: while every pick is carried, a miner without one leaves dig jobs to those who carry one', () => {
    const w = new TestWorld({ seed: 'two-picks', world: 'flat-test', embark: 'default' });
    const granite = w.game.registry.table('materials').index('granite');
    const tiles: number[] = [];
    for (let y = 20; y < 23; y += 1) {
      for (let x = 40; x < 44; x += 1) {
        const t = w.index(x, y, Z);
        w.game.world.services.terrain.setKind(t, TileKind.Wall, granite);
        tiles.push(t);
      }
    }
    w.game.world.applyCommand({ type: 'Designate', tiles, kind: 'dig' });
    w.until((x) => x.events('ToolEquipped').length === 2, 1000);
    const equipTick = w.tick;
    const blockedAtEquip = w.events('JobBlocked').length;
    w.until((x) => tiles.every((t) => x.map.kindAt(t) === TileKind.Floor), 3000);
    expect(w.tick - equipTick).toBeLessThanOrEqual(2200);
    // Seven miners, two picks: once both are carried nobody blocks a dig job for want of one.
    expect(w.events('JobBlocked').filter((e) => e['reason'] === 'no_tool').length).toBeLessThanOrEqual(blockedAtEquip);
    expect(new Set(w.events('JobCompleted').filter((e) => e['jobType'] === 'dig').map((e) => e['workerId'])).size).toBe(2);
  });

  it('a job input is reserved through 13 and released with ItemReleased on cancel', () => {
    const w = new TestWorld({ seed: 'search-reserve', world: 'flat-test', embark: 'default' });
    const log = w.spawnItem('log', 'oak', w.index(45, 14, Z));
    const board = w.game.world.services.jobs as unknown as {
      create(key: string, spec: Record<string, unknown>): number;
    };
    w.step(1);
    const logType = w.game.registry.table('items').index('log');
    const jobId = board.create('test:reserve', {
      type: 'haul_to_stockpile',
      target: { kind: 'entity', ref: w.index(47, 14, Z) },
      workTile: w.index(47, 14, Z),
      inputs: [{ filter: { type: logType }, count: 1 }],
    });
    w.until((x) => x.events('ItemReserved').length > 0, 400);
    expect(items(w).get(log)).toMatchObject({ reservedBy: jobId });
    expect(items(w).get(log)?.flags).toBe(ItemFlag.Reserved);
    expect(w.game.world.applyCommand({ type: 'ForbidItem', itemId: log, on: true })).toEqual({ ok: true });
    w.step(1);
    expect(w.events('JobCancelled')).toEqual([expect.objectContaining({ jobId, reason: 'forbidden' })]);
    expect(w.events('ItemReleased')).toEqual([expect.objectContaining({ itemId: log, jobId })]);
    expect(items(w).get(log)?.flags).toBe(ItemFlag.Forbidden);
  });
});
