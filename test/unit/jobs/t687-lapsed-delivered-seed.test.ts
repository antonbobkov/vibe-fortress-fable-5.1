/**
 * T-687: a planting job kept a seed it no longer held. The sweep's invariant `job.delivered-item-missing`
 * found an open `plant` job (`three-years-p4-4`, shift 200, tick 321,600) listing as delivered a seed
 * stack that was gone. Its worker had brought the seed to the plot and been interrupted; the
 * reservation lapsed after `RESERVE_KEEP_TICKS` (11 § Job steps: only build and workshop inputs keep
 * theirs), but the seed stayed in the job's `delivered`. A hauler then carried the free seed to a
 * stockpile and merged it into a stack there, which ends the item with no `ItemDestroyed`, so nothing
 * pruned it. A job that stays delivers only what it still holds: a released input leaves `delivered`.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import type { ItemsReader } from '@systems/items';
import type { JobsSystem } from '@systems/jobs';
import { RESERVE_KEEP_TICKS } from '@systems/jobs/constants';
import { checkInvariants } from '../../scenarios/invariants';
import { TestWorld } from '../../scenarios/test-world';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

function quiet(w: TestWorld, id: EntityId): void {
  for (const need of NEEDS) w.setNeed(id, need, 0);
}

describe('T-687 a lapsed delivered input leaves the job', () => {
  it('a planting job interrupted at the plot lets its seed go when the reservation lapses; the seed merged into a stack leaves no stale id, and the job plants with another', () => {
    const w = new TestWorld({ seed: 't687-plant-seed', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const world = w.game.world;
    const tile = w.index(30, 20, Z);
    const zoneId = w.zone('farm_plot', [tile]);
    expect(world.applyCommand({ type: 'SetPlotCrop', zoneId, season: world.calendar.season, speciesId: 'barley' }).ok).toBe(true);
    w.spawnItem('seed', 'barley', w.index(40, 20, Z), 1);
    const dwarf = w.spawnDwarf({ at: w.index(24, 20, Z) });
    quiet(w, dwarf);
    const board = (world.scheduler.byId('11') as JobsSystem).board;
    const items = w.readers.of<ItemsReader>('13');
    const key = `plant:${tile}`;
    const job = () => board.jobs.get(board.byKey(key)?.id ?? -1);

    // The dwarf brings the seed to the plot and starts planting.
    for (let t = 0; t < TICKS_PER_DAY && !(job()?.state === 'working' && job()!.inputs[0]!.delivered.length > 0); t += 1) {
      quiet(w, dwarf);
      w.step(1);
    }
    const planting = job()!;
    expect(planting.state).toBe('working');
    const seed = planting.inputs[0]!.delivered[0]!;
    expect(items.get(seed)?.reservedBy).toBe(planting.id);

    // Interrupted, and nobody takes it again before the reservation lapses.
    expect(world.applyCommand({ type: 'SetLabor', dwarfId: dwarf, labor: 'farming', on: false }).ok).toBe(true);
    board.interrupt(dwarf, true);
    expect(planting.state).toBe('open');
    expect(planting.inputs[0]!.delivered, 'held through the timeout').toEqual([seed]);
    for (let t = 0; t <= RESERVE_KEEP_TICKS + 10; t += 10) {
      quiet(w, dwarf);
      w.step(10);
    }
    expect(planting.state).toBe('open');
    expect(items.get(seed)?.reservedBy ?? 0, 'the lapse released the seed').toBe(0);
    expect(planting.inputs[0]!.delivered, 'and the job no longer counts it').toEqual([]);
    expect(planting.inputs[0]!.reserved).toEqual([]);

    // A hauler's delivery merges the free seed into a stack (13 hauling's `merge`): no `ItemDestroyed`.
    const stack = w.spawnItem('seed', 'barley', items.tileOf(seed), 2);
    expect(world.services.items!.merge(stack, seed)).toBe(true);
    expect(world.entities.alive(seed)).toBe(false);
    expect(checkInvariants(w.game).filter((f) => f.inv.startsWith('job.'))).toEqual([]);

    // Taken again, the job fetches from the stack and plants.
    expect(world.applyCommand({ type: 'SetLabor', dwarfId: dwarf, labor: 'farming', on: true }).ok).toBe(true);
    for (let t = 0; t < TICKS_PER_DAY && board.byKey(key) !== undefined; t += 10) {
      quiet(w, dwarf);
      w.step(10);
    }
    expect(board.byKey(key), 'planted').toBeUndefined();
    expect(w.plants.cropAtTile.has(tile)).toBe(true);
    expect(items.get(stack)?.count).toBe(2);
  });
});
