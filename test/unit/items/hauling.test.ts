import { describe, it, expect } from 'vitest';
import { C, ItemFlag } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import type { ItemsReader, ItemsSystem } from '@systems/items';
import { HAUL_JOBS_PER_TICK } from '@systems/items/constants';
import { TestWorld } from '../../scenarios/test-world';
import { rect } from '../../scenarios/m1-helpers';

const Z = 32;

function items(w: TestWorld): ItemsReader {
  return w.readers.of<ItemsReader>('13');
}

function sys(w: TestWorld): ItemsSystem {
  return w.game.world.scheduler.byId('13') as unknown as ItemsSystem;
}

function apply(w: TestWorld, cmd: Record<string, unknown>): { ok: boolean } {
  return w.game.world.applyCommand(cmd as never) as { ok: boolean };
}

function haulJobs(w: TestWorld): number {
  return w.events('JobCreated').filter((e) => e['jobType'] === 'haul_to_stockpile').length;
}

describe('T-M2-04 the wants-hauling set', () => {
  it('enters and leaves for every listed cause', () => {
    const w = new TestWorld({ seed: 'wants', world: 'flat-test' });
    const h = sys(w).hauling;
    const t = w.index(40, 40, Z);
    // Created on the ground: wants hauling; no stockpile accepts it: noHome at the items tick.
    const log = w.spawnItem('log', 'oak', t);
    expect(h.wants).toEqual([log]);
    w.step(2);
    expect(h.wants).toEqual([]);
    expect(h.noHome).toEqual([log]);
    // A stockpile is created and its filter comes to include it: back in the set.
    const sp = w.zone('stockpile', rect(w, 10, 10, Z, 2, 2));
    expect(apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'wood' }).ok).toBe(true);
    expect(h.wants).toEqual([log]);
    expect(h.noHome).toEqual([]);
    // Forbidden: out; claimed: in.
    w.items.setFlag(log, ItemFlag.Forbidden, true);
    expect(h.wants).toEqual([]);
    w.items.setFlag(log, ItemFlag.Forbidden, false);
    expect(h.wants).toEqual([log]);
    // Picked up for a job: out; dropped: in.
    const carrier = w.spawnDwarf({ at: w.index(41, 40, Z) });
    w.items.attachToCarrier(log, carrier);
    expect(h.wants).toEqual([]);
    w.items.dropAt(log, t);
    expect(h.wants).toEqual([log]);
    // Reserved for a job: out; released: in.
    w.items.reserve(log, 5);
    expect(h.wants).toEqual([]);
    w.items.release(log);
    expect(h.wants).toEqual([log]);
    // Put in an accepting stockpile slot: out.
    w.items.dropAt(log, w.index(10, 10, Z));
    expect(h.wants).toEqual([]);
    // Its stockpile is removed: in again.
    expect(apply(w, { type: 'RemoveZone', zoneId: sp }).ok).toBe(true);
    w.step(1);
    expect(h.wants).toEqual([log]);
    // Inside a container: the container stands for it.
    const bin = w.spawnItem('bin', 'oak', t);
    const ring = w.spawnItem('ring', 'granite', t);
    expect(h.wants).toContain(ring);
    w.items.putIn(ring, bin);
    expect(h.wants).not.toContain(ring);
    // Destroyed: out.
    w.items.destroy(log, 'test');
    expect(h.wants).not.toContain(log);
    expect(items(w).wantsHaulingCount()).toBe(h.wants.length);
  });

  it('HAUL_JOBS_PER_TICK caps the haul jobs one items tick creates', () => {
    const w = new TestWorld({ seed: 'cap', world: 'flat-test' });
    const sp = w.zone('stockpile', rect(w, 10, 10, Z, 8, 5));
    apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'stone' });
    for (let k = 0; k < 30; k += 1) w.spawnItem('raw_stone', 'granite', w.index(40 + (k % 10), 40 + Math.floor(k / 10), Z));
    w.step(2); // tick 1 is an items tick
    expect(haulJobs(w)).toBe(HAUL_JOBS_PER_TICK);
    w.step(10);
    expect(haulJobs(w)).toBe(30);
    // Each job holds its own slot.
    expect(items(w).freeSlots(sp)).toBe(40 - 30);
  });
});

describe('T-M2-04 haul jobs', () => {
  it('delivers to the slot, merges an identical stack, and releases the slot', () => {
    const w = new TestWorld({ seed: 'merge', world: 'flat-test', embark: 'default' });
    const tiles = rect(w, 50, 20, Z, 1, 1);
    const sp = w.zone('stockpile', tiles);
    apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'stone' });
    const kept = w.spawnItem('stone_block', 'granite', tiles[0] as number, 2);
    const loose = w.spawnItem('stone_block', 'granite', w.index(46, 16, Z), 3);
    w.until(() => !w.game.world.entities.alive(loose), 1500);
    expect(items(w).get(kept)?.count).toBe(5);
    expect(items(w).at(tiles[0] as number)).toEqual([kept]);
    w.step(20);
    expect(sys(w).stockpiles.reservations.size).toBe(0);
    expect(w.events('JobCancelled')).toHaveLength(0);
  });

  it('a wanted barrel is hauled in first; then loose drink goes into it', () => {
    const w = new TestWorld({ seed: 'barrel', world: 'flat-test', embark: 'default' });
    const sp = w.zone('stockpile', rect(w, 50, 20, Z, 2, 2));
    apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'drink' });
    apply(w, { type: 'SetStockpileContainers', zoneId: sp, wants: { barrel: 1 } });
    const barrel = w.spawnItem('barrel', 'oak', w.index(44, 14, Z));
    const ale = w.spawnItem('drink', 'ale', w.index(46, 14, Z), 5);
    w.until(() => items(w).stockpileAt(items(w).tileOf(barrel)) === sp && items(w).containerOf(ale) === barrel, 2500);
    expect(items(w).get(barrel)?.carriedBy).toBe(0);
    w.step(30);
    // The barrel stays: it is wanted there.
    expect(sys(w).hauling.wants).not.toContain(barrel);
  });

  it('a dump-flagged item is hauled to the dump zone and the flag clears; it stays there', () => {
    const w = new TestWorld({ seed: 'dump', world: 'flat-test', embark: 'default' });
    const dump = w.zone('dump', rect(w, 55, 20, Z, 2, 2));
    const stone = w.spawnItem('raw_stone', 'granite', w.index(46, 14, Z));
    expect(apply(w, { type: 'DumpItem', itemId: stone, on: true }).ok).toBe(true);
    w.until(() => (items(w).get(stone)?.flags ?? -1) === 0, 2000);
    const at = items(w).tileOf(stone);
    expect(w.readers.of<{ zoneAt(i: number): number }>('14').zoneAt(at)).toBe(dump);
    w.step(100);
    expect(items(w).tileOf(stone)).toBe(at);
    expect(sys(w).hauling.wants).not.toContain(stone);
  });

  it('an interrupted haul drops the item where the worker stands; it wants hauling again', () => {
    const w = new TestWorld({ seed: 'interrupt', world: 'flat-test', embark: 'default' });
    // Room for the wagon's five pine logs (T-M2-08) besides this one.
    const sp = w.zone('stockpile', rect(w, 60, 30, Z, 3, 3));
    apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'wood' });
    const log = w.spawnItem('log', 'oak', w.index(46, 14, Z));
    w.until(() => (items(w).get(log)?.carriedBy ?? 0) !== 0, 3000);
    const carrier = items(w).get(log)?.carriedBy as EntityId;
    w.game.world.services.jobs.interrupt(carrier, true);
    const p = w.game.world.entities.get(carrier, C.Position);
    expect(items(w).tileOf(log)).toBe(w.index(p?.x ?? 0, p?.y ?? 0, p?.z ?? 0));
    expect(items(w).get(log)?.carriedBy).toBe(0);
    // Hauled in the end.
    w.until(() => items(w).stockpileAt(items(w).tileOf(log)) === sp && items(w).get(log)?.reservedBy === 0, 3000);
  });

  it('strip_corpse moves a corpse\'s worn items to the ground', () => {
    const w = new TestWorld({ seed: 'strip', world: 'flat-test', embark: 'default' });
    const t = w.index(46, 14, Z);
    const corpse = w.spawnItem('corpse', 'granite', t);
    const helm = w.spawnItem('helm', 'iron', w.index(0, 0, 0));
    w.items.attachToCarrier(helm, corpse);
    w.game.world.entities.add(corpse, C.Corpse, { species: 1, diedTick: 0, wornItems: [helm], dwarfName: null });
    w.until(() => w.events('JobCompleted').some((e) => e['jobType'] === 'strip_corpse'), 2000);
    expect(w.game.world.entities.get(corpse, C.Corpse)?.wornItems).toEqual([]);
    expect(items(w).get(helm)?.carriedBy).toBe(0);
    expect(items(w).tileOf(helm)).toBe(t);
  });
});

describe('F-01 haul job cancellation on pickup', () => {
  it('a haul job is cancelled when another job picks its item up', () => {
    const w = new TestWorld({ seed: 'haul-pick-cancel', world: 'flat-test', embark: 'none' });
    const dwarf = w.spawnDwarf({ at: w.index(40, 40, Z), skills: { mining: 5 } });
    const labors = w.game.registry.table('labors');
    const enabled = new Uint8Array((labors.size >> 3) + 1);
    const miningIdx = labors.index('mining');
    enabled[miningIdx >> 3] = (enabled[miningIdx >> 3] as number) | (1 << (miningIdx & 7));
    w.game.world.entities.add(dwarf, C.Labors, { enabled });

    const pick = w.spawnItem('pick', 'iron', w.index(42, 40, Z));

    const stoneSp = w.zone('stockpile', rect(w, 45, 40, Z, 2, 2));
    apply(w, { type: 'SetStockpileFilter', zoneId: stoneSp, filter: 'stone' });

    const toolsSp = w.zone('stockpile', rect(w, 48, 40, Z, 2, 2));
    apply(w, { type: 'SetStockpileFilter', zoneId: toolsSp, filter: { categories: ['tool'] } });

    w.step(2);
    const jobs = w.readers.of<{ byKey(k: string): unknown }>('11');
    expect(jobs.byKey(`haul:${pick}`)).toBeDefined();

    const wall = w.index(20, 20, Z);
    w.game.world.services.terrain.setKind(wall, TileKind.Wall, w.game.registry.table('materials').index('granite'));
    w.game.world.applyCommand({ type: 'Designate', tiles: [wall], kind: 'dig' });

    w.until((x) => x.events('ToolEquipped').some((e) => e['itemId'] === pick), 2000);
    w.step(10);

    const cancelled = w.events('JobCancelled').filter((e) => e['reason'] === 'target_invalid' && e['target'] === pick);
    expect(cancelled.length).toBeGreaterThan(0);

    expect(jobs.byKey(`haul:${pick}`)).toBeUndefined();
  });
});
