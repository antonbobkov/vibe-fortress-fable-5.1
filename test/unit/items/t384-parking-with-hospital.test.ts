import { afterEach, describe, expect, it, vi } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { Hauling, haulKey } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';
import { rect } from '../../scenarios/m1-helpers';

function apply(w: TestWorld, cmd: Record<string, unknown>): { ok: boolean } {
  return w.game.world.applyCommand(cmd as never) as { ok: boolean };
}

/** The wants set and the waiting items of system 13's hauling (`parked` is private to it). */
function haulingOf(w: TestWorld): { readonly wants: readonly number[]; readonly parked: Map<number, unknown> } {
  return (w.game.world.scheduler.byId('13') as unknown as { hauling: { wants: number[]; parked: Map<number, unknown> } }).hauling;
}

/**
 * A fortress with a hospital (a bed, and a chest when `chest`) and a cloth stockpile that wants one bin it does not
 * have, and one stack of cloth lying about: the cloth waits for the bin.
 */
function clothWorld(seed: string, options: { chest: boolean; supplies?: number; cloth?: number }): {
  w: TestWorld; cloth: number; hospital: number; chestItem: number; jobs: JobsReader;
} {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const bedTile = w.index(40, 40, Z), chestTile = w.index(41, 40, Z);
  const hospital = w.zone('hospital', [bedTile, chestTile]);
  w.build('bed', bedTile, 'oak');
  let chestItem = 0;
  if (options.chest) chestItem = w.game.world.entities.get(w.build('chest', chestTile, 'oak'), C.Building)!.itemId;
  if (options.supplies !== undefined) expect(apply(w, { type: 'SetHospitalSupplies', zoneId: hospital, wants: { cloth: options.supplies } }).ok).toBe(true);
  const sp = w.zone('stockpile', rect(w, 10, 10, Z, 2, 2));
  apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'cloth_and_leather' });
  apply(w, { type: 'SetStockpileContainers', zoneId: sp, wants: { bin: 1 } });
  const cloth = w.spawnItem('cloth', 'flax_cloth', w.index(20, 40, Z), 5);
  return { w, cloth, hospital, chestItem, jobs: w.readers.of<JobsReader>('11') };
}

afterEach(() => { vi.restoreAllMocks(); });

describe('T-384 an item that waits for a container is parked in a fortress with a hospital', () => {
  it('is looked at once, and not again while nothing about the stockpiles and the hospital changes', () => {
    const { w, cloth, jobs } = clothWorld('t384-quiet', { chest: false });
    w.step(30);
    expect(haulingOf(w).parked.has(cloth)).toBe(true);
    const bestFor = vi.spyOn(Hauling.prototype, 'bestFor');
    w.step(300);
    expect(bestFor).not.toHaveBeenCalled();
    expect(jobs.byKey(haulKey(cloth))).toBeUndefined();
  });

  it('is looked at again when a chest is built in the hospital, and goes into it', () => {
    const { w, cloth, jobs } = clothWorld('t384-chest-built', { chest: false });
    w.step(30);
    expect(haulingOf(w).parked.has(cloth)).toBe(true);
    const chest = w.build('chest', w.index(41, 40, Z), 'oak');
    const chestItem = w.game.world.entities.get(chest, C.Building)!.itemId;
    w.step(10);
    const job = jobs.byKey(haulKey(cloth));
    expect(job).toBeDefined();
    expect(jobs.get((job as { id: number }).id)?.data['container']).toBe(chestItem);
  });

  it('is looked at again when the hospital raises its supply limit', () => {
    const { w, cloth, hospital, jobs } = clothWorld('t384-limit', { chest: true, supplies: 0 });
    w.step(30);
    expect(haulingOf(w).parked.has(cloth)).toBe(true);
    const bestFor = vi.spyOn(Hauling.prototype, 'bestFor');
    w.step(100);
    expect(bestFor).not.toHaveBeenCalled();
    expect(apply(w, { type: 'SetHospitalSupplies', zoneId: hospital, wants: { cloth: 10 } }).ok).toBe(true);
    w.step(10);
    expect(jobs.byKey(haulKey(cloth))).toBeDefined();
  });

  it('is looked at again when the hospital chest is emptied below the supply limit', () => {
    const { w, cloth, chestItem, jobs } = clothWorld('t384-chest-emptied', { chest: true, supplies: 6 });
    const inside = w.spawnItem('cloth', 'flax_cloth', w.index(41, 40, Z), 6);
    expect(w.items.putIn(inside, chestItem)).toBe(true);
    w.step(30);
    // The hospital holds all the cloth it wants: the stack waits for a bin.
    expect(haulingOf(w).parked.has(cloth)).toBe(true);
    const bestFor = vi.spyOn(Hauling.prototype, 'bestFor');
    w.step(100);
    expect(bestFor).not.toHaveBeenCalled();
    w.items.consume(inside, 6);
    w.step(10);
    expect(jobs.byKey(haulKey(cloth))).toBeDefined();
  });

  it('is looked at again when a container is emptied by drinking, and goes into it', () => {
    const w = new TestWorld({ seed: 't384-drunk', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    w.zone('hospital', [w.index(40, 40, Z)]);
    const sp = w.zone('stockpile', rect(w, 10, 10, Z, 2, 2));
    apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'drink' });
    // A second barrel is still wanted, so the stack waits; the barrel that stands there is full.
    apply(w, { type: 'SetStockpileContainers', zoneId: sp, wants: { barrel: 2 } });
    const barrel = w.spawnItem('barrel', 'oak', w.index(10, 10, Z));
    const inside = w.spawnItem('drink', 'ale', w.index(10, 10, Z), 25);
    expect(w.items.putIn(inside, barrel)).toBe(true);
    const stack = w.spawnItem('drink', 'ale', w.index(40, 41, Z), 5);
    w.step(30);
    const jobs = w.readers.of<JobsReader>('11');
    expect(jobs.byKey(haulKey(stack))).toBeUndefined();
    expect(haulingOf(w).parked.has(stack)).toBe(true);
    const bestFor = vi.spyOn(Hauling.prototype, 'bestFor');
    w.step(100);
    expect(bestFor).not.toHaveBeenCalled();
    // Every unit is drunk: the barrel is empty and has room for the five.
    w.items.consume(inside, 25);
    w.step(10);
    expect(jobs.byKey(haulKey(stack))).toBeDefined();
    expect(w.game.world.entities.get(barrel, C.Container)?.contents).toEqual([]);
  });

  it('keeps waiting when the container it could have gone into is destroyed', () => {
    const w = new TestWorld({ seed: 't384-destroyed', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    w.zone('hospital', [w.index(40, 40, Z)]);
    const sp = w.zone('stockpile', rect(w, 10, 10, Z, 2, 2));
    apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'drink' });
    apply(w, { type: 'SetStockpileContainers', zoneId: sp, wants: { barrel: 2 } });
    const barrel = w.spawnItem('barrel', 'oak', w.index(10, 10, Z));
    const inside = w.spawnItem('drink', 'ale', w.index(10, 10, Z), 24);
    expect(w.items.putIn(inside, barrel)).toBe(true);
    const stack = w.spawnItem('drink', 'ale', w.index(40, 41, Z), 5);
    w.step(30);
    const jobs = w.readers.of<JobsReader>('11');
    expect(haulingOf(w).parked.has(stack)).toBe(true);
    // The barrel goes; the ale in it lies on the stockpile tile, and the stack still waits for a barrel.
    w.items.destroy(barrel, 'test');
    w.step(30);
    expect(w.game.world.entities.has(barrel, C.Item)).toBe(false);
    expect(jobs.byKey(haulKey(stack))).toBeUndefined();
    expect(haulingOf(w).wants).toContain(stack);
    expect(haulingOf(w).parked.has(stack)).toBe(true);
    // The stack is not looked at again while nothing changes, and a new barrel takes it.
    const bestFor = vi.spyOn(Hauling.prototype, 'bestFor');
    w.step(100);
    expect(bestFor).not.toHaveBeenCalled();
    const next = w.spawnItem('barrel', 'oak', w.index(11, 10, Z));
    w.step(10);
    expect(jobs.byKey(haulKey(stack))).toBeDefined();
    expect(w.game.world.entities.has(next, C.Item)).toBe(true);
  });

  it('forgets a waiting item that leaves the wants set', () => {
    const { w, cloth } = clothWorld('t384-prune', { chest: false });
    w.step(30);
    const hauling = haulingOf(w);
    expect(hauling.parked.has(cloth)).toBe(true);
    // Forbidden, it no longer wants hauling.
    expect(apply(w, { type: 'ForbidItem', itemId: cloth, on: true }).ok).toBe(true);
    w.step(5);
    expect(hauling.wants).not.toContain(cloth);
    expect(hauling.parked.has(cloth)).toBe(false);
    // Let go, it waits again; destroyed, nothing of it is kept.
    expect(apply(w, { type: 'ForbidItem', itemId: cloth, on: false }).ok).toBe(true);
    w.step(30);
    expect(hauling.parked.has(cloth)).toBe(true);
    w.items.destroy(cloth, 'test');
    w.step(5);
    expect(hauling.parked.has(cloth)).toBe(false);
    expect(hauling.parked.size).toBe(0);
  });
});
