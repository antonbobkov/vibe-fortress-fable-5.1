import { afterEach, describe, expect, it, vi } from 'vitest';
import { C } from '@core/components';
import { Hauling, haulKey, type ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';
import { rect } from '../../scenarios/m1-helpers';

const Z = 32;

function items(w: TestWorld): ItemsReader {
  return w.readers.of<ItemsReader>('13');
}

function apply(w: TestWorld, cmd: Record<string, unknown>): { ok: boolean } {
  return w.game.world.applyCommand(cmd as never) as { ok: boolean };
}

/** A drink stockpile that wants `barrels` barrels, and `count` loose units of ale lying about as single stacks of `units`. */
function waitingAle(seed: string, count: number, units: number, barrels: number): { w: TestWorld; sp: number; ale: number[] } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const sp = w.zone('stockpile', rect(w, 10, 10, Z, 2, 2));
  apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'drink' });
  apply(w, { type: 'SetStockpileContainers', zoneId: sp, wants: { barrel: barrels } });
  const ale: number[] = [];
  for (let k = 0; k < count; k += 1) ale.push(w.spawnItem('drink', 'ale', w.index(40 + (k % 20), 40 + Math.floor(k / 20), Z), units));
  return { w, sp, ale };
}

afterEach(() => { vi.restoreAllMocks(); });

describe('T-344 an item that waits for a container is not looked at again until a container could take it', () => {
  it('is looked at once, and not again while nothing about the stockpiles changes', () => {
    const { w, ale } = waitingAle('t344-quiet', 300, 1, 1);
    const bestFor = vi.spyOn(Hauling.prototype, 'bestFor');
    w.step(30);
    expect(bestFor.mock.calls.length).toBeGreaterThanOrEqual(ale.length);
    expect(w.game.world.scheduler.byId('13')).toBeDefined();
    bestFor.mockClear();
    w.step(300);
    expect(bestFor).not.toHaveBeenCalled();
    // The items still want hauling and wait.
    const hauling = (w.game.world.scheduler.byId('13') as unknown as { hauling: Hauling }).hauling;
    expect(hauling.wants).toHaveLength(ale.length);
    expect(hauling.noHome).toEqual([]);
  });

  it('is looked at again when a container stands on the stockpile, and is hauled into it', () => {
    const { w, sp, ale } = waitingAle('t344-barrel', 40, 1, 1);
    w.step(30);
    const bestFor = vi.spyOn(Hauling.prototype, 'bestFor');
    w.step(100);
    expect(bestFor).not.toHaveBeenCalled();
    const barrel = w.spawnItem('barrel', 'oak', w.index(10, 10, Z));
    expect(items(w).stockpileAt(items(w).tileOf(barrel))).toBe(sp);
    w.step(10);
    expect(bestFor.mock.calls.length).toBeGreaterThanOrEqual(1);
    const jobs = w.readers.of<JobsReader>('11');
    expect(ale.filter((id) => jobs.byKey(haulKey(id)) !== undefined).length).toBeGreaterThan(0);
  });

  it('keeps an item whose stack is larger than any room, and takes it again when a barrel has room for it', () => {
    const w = new TestWorld({ seed: 't344-room', world: 'flat-test', embark: 'none' });
    const sp = w.zone('stockpile', rect(w, 10, 10, Z, 2, 2));
    apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'drink' });
    // A second barrel is still wanted, so the item waits; the one that stands there has room for 2 of its 20.
    apply(w, { type: 'SetStockpileContainers', zoneId: sp, wants: { barrel: 2 } });
    const barrel = w.spawnItem('barrel', 'oak', w.index(10, 10, Z));
    const inside = w.spawnItem('drink', 'ale', w.index(10, 10, Z), 18);
    expect(w.game.world.services.items?.putIn(inside, barrel)).toBe(true);
    const stack = w.spawnItem('drink', 'ale', w.index(40, 40, Z), 5);
    w.step(30);
    const jobs = w.readers.of<JobsReader>('11');
    expect(jobs.byKey(haulKey(stack))).toBeUndefined();
    const bestFor = vi.spyOn(Hauling.prototype, 'bestFor');
    w.step(100);
    expect(bestFor).not.toHaveBeenCalled();
    // Three units are drunk: the barrel has room for the five.
    w.game.world.services.items?.consume(inside, 3);
    w.step(10);
    expect(bestFor).toHaveBeenCalled();
    expect(jobs.byKey(haulKey(stack))).toBeDefined();
    expect(w.game.world.entities.get(barrel, C.Container)?.contents).toEqual([inside]);
  });

  it('forgets what it was waiting for when the stockpile stops accepting it', () => {
    const { w, sp, ale } = waitingAle('t344-filter', 10, 1, 1);
    w.step(30);
    const hauling = (w.game.world.scheduler.byId('13') as unknown as { hauling: Hauling }).hauling;
    expect(hauling.wants).toHaveLength(ale.length);
    apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'wood' });
    w.step(30);
    expect(hauling.wants).toEqual([]);
    expect(hauling.noHome).toHaveLength(ale.length);
  });
});
