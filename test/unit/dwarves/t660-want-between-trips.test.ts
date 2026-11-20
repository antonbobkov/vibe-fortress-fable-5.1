import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import type { JobsSystem } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

/**
 * T-660 (10 § Behavior selection step 6, 11 § Job steps): a worker between two trips of a fetch,
 * nothing in hand, with rest at its want threshold goes to sleep holding the job, and resumes the
 * fetch when it wakes; the job is claimed once. A job at `NEED_DEFER_PRIORITY` or more urgent is
 * fetched on.
 */
function steelWithTiredWorker(seed: string, priority: number) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const smelter = w.build('smelter', w.index(15, 15, 32));
  const dwarf = w.spawnDwarf({ at: w.index(18, 18, 32), skills: { smelting: 8 } });
  w.spawnItem('bar', 'iron', w.index(26, 17, 32));
  w.spawnItem('raw_stone', 'limestone', w.index(30, 17, 32));
  w.spawnItem('charcoal_bar', 'charcoal', w.index(19, 18, 32), 2);
  w.step(1);
  const ent = w.game.world.entities;
  ent.add(dwarf, C.Needs, { ...ent.get(dwarf, C.Needs)!, hunger: 0, thirst: 0, rest: 0, comfort: 0, social: 0, joy: 0 });
  expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: smelter,
    order: { recipeId: 'alloy_steel', mode: 'once', remaining: 1, priority } })).toEqual({ ok: true });
  const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
  const job = (): ReturnType<typeof board.jobs.get> => [...board.jobs.values()].find((j) => j.target.ref === smelter);
  // On its first trip, item in hand, the worker turns tired (rest at its want mark, under the critical one).
  w.until(() => job()?.state === 'fetching' && board.workerOf(dwarf).carrying !== 0, 600);
  ent.add(dwarf, C.Needs, { ...ent.get(dwarf, C.Needs)!, rest: 65 });
  let slept = false;
  let sleptHolding = false;
  w.until(() => {
    const brain = ent.get(dwarf, C.Brain);
    if (brain?.behavior === 'need' && brain.activity === 'sleep') {
      slept = true;
      if (job()?.workerId === dwarf) sleptHolding = true;
    }
    return w.events('ItemCrafted').some((e) => e['recipeId'] === 'alloy_steel');
  }, 4000);
  expect(w.events('ItemCrafted').some((e) => e['recipeId'] === 'alloy_steel')).toBe(true);
  const claims = w.events('JobClaimed').filter((e) => e['target'] === smelter).length;
  return { slept, sleptHolding, claims, rest: ent.get(dwarf, C.Needs)!.rest };
}

describe('T-660 a want served between two trips', () => {
  it('sleeps after delivering what it carries, holding the steel job, and finishes it on waking', () => {
    const r = steelWithTiredWorker('t660-break', 5);
    expect(r.slept).toBe(true);
    expect(r.sleptHolding).toBe(true);
    expect(r.claims).toBe(1);
    expect(r.rest).toBeLessThan(60);
  });

  it('fetches on for a job at NEED_DEFER_PRIORITY', () => {
    const r = steelWithTiredWorker('t660-urgent', 2);
    // It fetches on until rest reaches its critical mark, which gives the job back (and it is claimed again).
    expect(r.sleptHolding).toBe(false);
  });
});
