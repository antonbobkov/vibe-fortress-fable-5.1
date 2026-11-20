import { describe, expect, it } from 'vitest';
import type { ItemsReader } from '@systems/items';
import type { JobsSystem } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

/**
 * T-655 (11 § Assignment step 4): a unit input is reserved from the fewest stacks, and of the stacks
 * that make it up in that many trips, the nearest. A far stack of five was fetched for one bar of fuel
 * while one lay beside the furnace. T-659: the nearest stacks instead, more trips, when they walk less
 * in all.
 */
function brewClaim(seed: string, stacks: { x: number; count: number }[], dwarfX = 11): { reserved: { x: number; count: number }[]; trips: number } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const still = w.build('still', w.index(12, 12, 32));
  w.spawnDwarf({ at: w.index(dwarfX, 15, 32) });
  for (const s of stacks) w.spawnItem('plant_food', 'dimcap', w.index(s.x, 16, 32), s.count);
  w.spawnItem('barrel', 'oak', w.index(11, 18, 32));
  w.step(1);
  expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: still, order: { recipeId: 'brew', remaining: 1, mode: 'once' } })).toEqual({ ok: true });
  const items = w.readers.of<ItemsReader>('13');
  const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
  const job = (): ReturnType<typeof board.jobs.get> => [...board.jobs.values()].find((j) => j.target.ref === still);
  w.until(() => (job()?.inputs[0]?.reserved.length ?? 0) > 0, 600);
  const reserved = job()!.inputs[0]!.reserved.map((id) => ({ x: w.map.xOf(items.tileOf(id)), count: items.get(id)?.count ?? 0 }));
  return { reserved: reserved.sort((a, b) => a.x - b.x), trips: reserved.length };
}

describe('T-655 the nearest stacks of the fewest', () => {
  it('takes four of the stack beside the workshop over a larger stack across the map', () => {
    const r = brewClaim('t655-near-stack', [{ x: 40, count: 6 }, { x: 14, count: 4 }]);
    expect(r.reserved).toEqual([{ x: 14, count: 4 }]);
  });

  it('splits the nearest stack that holds enough, not the largest', () => {
    const r = brewClaim('t655-near-split', [{ x: 44, count: 9 }, { x: 15, count: 5 }]);
    expect(r.reserved).toEqual([{ x: 15, count: 4 }]);
  });

  it('goes twice to two near stacks of two rather than once to a far stack of four (T-659: less walking)', () => {
    const r = brewClaim('t655-fewest', [{ x: 13, count: 2 }, { x: 15, count: 2 }, { x: 40, count: 4 }]);
    expect(r.reserved).toEqual([{ x: 13, count: 2 }, { x: 15, count: 2 }]);
  });

  it('still goes once to a stack of four when the nearest stacks would walk farther in all', () => {
    // The nearest make-up is the 2 beside the still and two of the four: two trips, more walking than the one to the four.
    const r = brewClaim('t659-fewest-nearer', [{ x: 13, count: 2 }, { x: 20, count: 4 }, { x: 44, count: 2 }]);
    expect(r.reserved).toEqual([{ x: 20, count: 4 }]);
  });

  it('makes up two trips from the nearest stacks, not the two largest', () => {
    // No stack holds four, so two trips: the 3 beside the workshop and one of the 2 next to it, not the 3 far off.
    const r = brewClaim('t655-two-trips', [{ x: 13, count: 3 }, { x: 16, count: 2 }, { x: 30, count: 3 }, { x: 44, count: 2 }]);
    expect(r.reserved).toEqual([{ x: 13, count: 3 }, { x: 16, count: 1 }]);
  });

  it('looks for the inputs from the workshop, not from where its worker claims the job', () => {
    // The worker stands beside a stack across the map; the one beside the still is the one it fetches.
    const r = brewClaim('t655-from-shop', [{ x: 42, count: 4 }, { x: 15, count: 4 }], 41);
    expect(r.reserved).toEqual([{ x: 15, count: 4 }]);
  });
});
