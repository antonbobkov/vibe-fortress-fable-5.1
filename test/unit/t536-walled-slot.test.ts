import { describe, expect, it } from 'vitest';
import { TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { ItemsReader, ItemsSystem } from '@systems/items';
import { TestWorld } from '../scenarios/test-world';
import { rect } from '../scenarios/m1-helpers';
import { checkInvariants } from '../scenarios/invariants';

/**
 * T-536: in `three-years-p4-6` (shift 50) a sapling on a tile of the surface stockpile grew into a
 * tree while a haul was aimed at that tile. Nobody could stand there any more and nothing cancelled
 * the haul: it waited, blocked `unreachable`, for ever (T-176 `job.unreachable-anchor-beside`).
 * 13 § Stockpiles: a stockpile tile no dwarf can stand on offers no slot, and a haul bound for a tile
 * that stops being one is cancelled with `target_invalid`; the item finds another home.
 */
const Z = 32;

function sys(w: TestWorld): ItemsSystem {
  return w.game.world.scheduler.byId('13') as unknown as ItemsSystem;
}

function items(w: TestWorld): ItemsReader {
  return w.readers.of<ItemsReader>('13');
}

type JobLike = { id: number; workTile: unknown; state: string };
function haulOf(w: TestWorld, itemId: number): JobLike | undefined {
  return w.readers.of<{ byKey(k: string): JobLike | undefined }>('11').byKey(`haul:${itemId}`);
}

function growTree(w: TestWorld, t: TileIndex): void {
  w.game.world.services.terrain.setKind(t, TileKind.Tree, w.game.registry.table('materials').index('oak'));
}

function wood(w: TestWorld, tiles: readonly TileIndex[]): number {
  const sp = w.zone('stockpile', tiles);
  expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: sp, filter: 'wood' }).ok).toBe(true);
  return sp;
}

describe('T-536 a stockpile slot that becomes a tree', () => {
  it('cancels the haul aimed at it, releases the slot, and the item goes to a tile a dwarf can stand on', () => {
    const w = new TestWorld({ seed: 't536-cancel', world: 'flat-test', embark: 'none' });
    const [first, second] = rect(w, 50, 20, Z, 2, 1) as [TileIndex, TileIndex];
    wood(w, [first, second]);
    const log = w.spawnItem('log', 'oak', w.index(40, 40, Z));
    w.step(2);
    expect(haulOf(w, log)?.workTile).toBe(first);
    expect(sys(w).stockpiles.reservations.has(`t${first}`)).toBe(true);
    growTree(w, first);
    w.step(2);
    const cancelled = w.events('JobCancelled').filter((e) => e['reason'] === 'target_invalid' && e['target'] === log);
    expect(cancelled).toHaveLength(1);
    expect(sys(w).stockpiles.reservations.has(`t${first}`)).toBe(false);
    w.step(10);
    expect(haulOf(w, log)?.workTile, 'the next haul goes to the tile a dwarf can stand on').toBe(second);
  });

  it('a tile no dwarf can stand on offers no slot: the stockpile is full', () => {
    const w = new TestWorld({ seed: 't536-full', world: 'flat-test', embark: 'none' });
    const tile = w.index(50, 20, Z);
    const sp = wood(w, [tile]);
    growTree(w, tile);
    const log = w.spawnItem('log', 'oak', w.index(40, 40, Z));
    w.step(12);
    expect(haulOf(w, log)).toBeUndefined();
    expect(sys(w).stockpiles.freeSlots(sp)).toBe(0);
    expect(sys(w).hauling.noHome).toContain(log);
    expect(w.events('StockpileFull').some((e) => e['id'] === sp)).toBe(true);
  });

  it('a chest built on the slot tile cancels the haul aimed at the tile', () => {
    const w = new TestWorld({ seed: 't536-chest', world: 'flat-test', embark: 'none' });
    const [first, second] = rect(w, 50, 20, Z, 2, 1) as [TileIndex, TileIndex];
    wood(w, [first, second]);
    const log = w.spawnItem('log', 'oak', w.index(40, 40, Z));
    w.step(2);
    expect(haulOf(w, log)?.workTile).toBe(first);
    w.build('chest', first, 'oak');
    w.step(2);
    expect(w.events('JobCancelled').some((e) => e['reason'] === 'target_invalid' && e['target'] === log)).toBe(true);
    w.step(10);
    expect(haulOf(w, log)?.workTile).not.toBe(first);
  });

  it('a dwarf on the way delivers the item elsewhere, and no haul is left blocked (T-176)', () => {
    const w = new TestWorld({ seed: 't536-walk', world: 'flat-test', embark: 'none' });
    const [first, second] = rect(w, 60, 20, Z, 2, 1) as [TileIndex, TileIndex];
    wood(w, [first, second]);
    w.spawnDwarf({ at: w.index(40, 40, Z) });
    const log = w.spawnItem('log', 'oak', w.index(41, 40, Z));
    w.until(() => (items(w).get(log)?.carriedBy ?? 0) !== 0, 2000);
    expect(haulOf(w, log)?.workTile).toBe(first);
    growTree(w, first);
    w.until(() => items(w).tileOf(log) === second && items(w).get(log)?.carriedBy === 0, 3000);
    w.step(20);
    expect(checkInvariants(w.game).map((f) => f.inv)).not.toContain('job.unreachable-anchor-beside');
  });
});
