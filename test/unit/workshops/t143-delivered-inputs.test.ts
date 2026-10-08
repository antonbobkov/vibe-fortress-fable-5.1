import { describe, expect, it } from 'vitest';
import { ItemFlag } from '@core/components';
import { roundTrip } from '@app/game-save';
import type { JobsSystem, JobsReader } from '@systems/jobs';
import type { ItemsReader, ItemsSystem } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

describe('T-143 delivered workshop inputs stay reserved while the order stands', () => {
  it('keeps haulers away after interruption and save/load, and releases the input when its order is removed', () => {
    const w = new TestWorld({ seed: 't143-delivered-craft', world: 'flat-test', embark: 'none' });
    const shop = w.build('craftdwarf', w.index(12, 12, 32));
    const dwarf = w.spawnDwarf({ at: w.index(16, 16, 32) });
    const stone = w.spawnItem('raw_stone', 'granite', w.index(18, 16, 32));
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: shop,
      order: { recipeId: 'craft_stone', remaining: 1, mode: 'once' } })).toEqual({ ok: true });
    const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
    const jobAt = () => [...board.jobs.values()].find((job) => job.target.ref === shop);
    w.until(() => jobAt()?.inputs[0]?.delivered.includes(stone) === true, 3000);
    const job = jobAt()!;
    board.interrupt(dwarf, true);
    w.setLabor(dwarf, 'crafts', false);
    const sp = w.zone('stockpile', [w.index(30, 30, 32), w.index(31, 30, 32)]);
    expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: sp, filter: 'stone' })).toEqual({ ok: true });
    w.step(2000);
    const items = w.readers.of<ItemsReader>('13');
    const jobs = w.readers.of<JobsReader>('11');
    expect(items.get(stone)?.reservedBy).toBe(job.id);
    expect(items.get(stone)!.flags & ItemFlag.Reserved).not.toBe(0);
    expect(jobs.byKey(`haul:${stone}`)).toBeUndefined();
    expect((w.game.world.scheduler.byId('13') as ItemsSystem).hauling.wants).not.toContain(stone);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());
    w.step(100);
    loaded.step(100);
    expect(loaded.hash()).toBe(w.hash());
    expect(w.game.world.applyCommand({ type: 'RemoveWorkOrder', workshopId: shop, index: 0 })).toEqual({ ok: true });
    w.step(1);
    expect(items.get(stone)?.reservedBy).toBe(0);
    expect(items.get(stone)!.flags & ItemFlag.Reserved).toBe(0);
    expect(jobAt()).toBeUndefined();
  });
});
