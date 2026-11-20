import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import type { JobsSystem } from '@systems/jobs';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

/**
 * T-660 (11 § Job steps, interruptions): a critical need that comes while a worker carries an input
 * to a workshop lets it deliver that input first; the job is interrupted once it is put down, and the
 * worker goes to the need. The smith's steel was interrupted mid-carry at half its interruptions, the
 * item dropped where he stood and fetched again.
 */
describe('T-660 an input in hand is delivered before a critical need', () => {
  it('carries the flux to the smelter, then gives the job back and goes to bed', () => {
    const w = new TestWorld({ seed: 't660-deliver', world: 'flat-test', embark: 'none' });
    const smelter = w.build('smelter', w.index(15, 15, 32));
    const dwarf = w.spawnDwarf({ at: w.index(18, 18, 32), skills: { smelting: 8 } });
    w.spawnItem('bar', 'iron', w.index(19, 17, 32));
    const flux = w.spawnItem('raw_stone', 'limestone', w.index(34, 17, 32));
    w.spawnItem('charcoal_bar', 'charcoal', w.index(19, 18, 32), 2);
    w.step(1);
    const ent = w.game.world.entities;
    ent.add(dwarf, C.Needs, { ...ent.get(dwarf, C.Needs)!, hunger: 0, thirst: 0, rest: 0, comfort: 0, social: 0, joy: 0 });
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: smelter,
      order: { recipeId: 'alloy_steel', mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
    const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
    const job = (): ReturnType<typeof board.jobs.get> => [...board.jobs.values()].find((j) => j.target.ref === smelter);
    // The flux in hand, rest turns critical (it crosses its mark on the next rise).
    w.until(() => board.workerOf(dwarf).carrying === flux, 1200);
    ent.add(dwarf, C.Needs, { ...ent.get(dwarf, C.Needs)!, rest: 89.99 });
    w.until(() => w.events('NeedCritical').some((e) => e['id'] === dwarf), 50);
    expect(job()?.workerId).toBe(dwarf);
    w.until(() => job()?.workerId !== dwarf, 600);
    const items = w.readers.of<ItemsReader>('13');
    // Put down at the smelter's work tile, still the job's, not where the need found him.
    expect(job()?.inputs.some((input) => input.delivered.includes(flux))).toBe(true);
    expect(items.tileOf(flux)).toBe(typeof job()?.workTile === 'number' ? job()?.workTile : -2);
    expect(job()?.state).toBe('open');
    w.step(5);
    expect(ent.get(dwarf, C.Brain)?.behavior).toBe('need');
  });
});
