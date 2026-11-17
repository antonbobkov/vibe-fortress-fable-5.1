/**
 * T-570: the three-year script plays two habits of a player. A workshop's or a building's job that
 * has stood open for RAISE_AFTER_DAYS is raised a step, and again after as many more days, never past
 * KIT_FIRST (with its labor's priority). Between caravans, raw stone the mason's orders want is taken
 * back from the depot: the stones lying there and the hauls of stone not yet taken up.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, ItemFlag } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { CombatReader, SquadWithId } from '@systems/combat';
import type { JobsReader } from '@systems/jobs';
import { KIT_FIRST, RAISE_AFTER_DAYS, ROUTINE, raiseWaitingWork, takeBackStone, type EconomyState } from '../scenarios/three_years_economy';
import type { FortressState } from '../scenarios/three_years_fortress';
import { TestWorld } from '../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

function fortress(): FortressState {
  return { economy: { phases: new Set<string>(), specialists: {} } as unknown as EconomyState } as unknown as FortressState;
}

/** A workshop with one order, whose only worker stands in a squad on duty: its job stays open. */
function waitingShop(seed: string, shop: string, recipeId: string, labor: string, input: [string, string, number]): { w: TestWorld; job: () => { id: number; priority: number } | undefined } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const ws = w.build(shop, w.index(20, 20, Z), 'granite');
  const dwarf = w.spawnDwarf({ at: w.index(14, 14, Z) });
  w.setLabor(dwarf, labor);
  w.spawnItem(input[0], input[1], w.index(24, 20, Z), input[2]);
  expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Gate Guard' }).ok).toBe(true);
  const squad = w.readers.of<CombatReader>('16').squads()[0] as SquadWithId;
  expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members: [dwarf] }).ok).toBe(true);
  expect(w.game.world.applyCommand({ type: 'SetSquadMode', squadId: squad.id, mode: 'active' }).ok).toBe(true);
  w.step(1);
  expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: ws, order: { recipeId, mode: 'once', remaining: 1, priority: ROUTINE } }).ok).toBe(true);
  w.step(2);
  const jobs = w.readers.of<JobsReader>('11');
  return { w, job: () => jobs.list('open').find((j) => jobs.typeOf(j.id) === 'craft') };
}

describe('T-570 a job that waits is raised', () => {
  it('a step after RAISE_AFTER_DAYS, another after as many more, and no further than KIT_FIRST', () => {
    const { w, job } = waitingShop('t570-raise', 'carpenter', 'make_barrel', 'carpentry', ['log', 'oak', 4]);
    const state = fortress();
    const first = job();
    expect(first?.priority).toBe(ROUTINE);
    raiseWaitingWork(w, state);
    w.step(RAISE_AFTER_DAYS * TICKS_PER_DAY - 10);
    raiseWaitingWork(w, state);
    expect(job()?.priority, 'not before RAISE_AFTER_DAYS').toBe(ROUTINE);
    w.step(10);
    raiseWaitingWork(w, state);
    expect(job()?.id).toBe(first!.id);
    expect(job()?.priority).toBe(ROUTINE - 1);
    w.step(RAISE_AFTER_DAYS * TICKS_PER_DAY);
    raiseWaitingWork(w, state);
    expect(job()?.priority).toBe(KIT_FIRST);
    w.step(RAISE_AFTER_DAYS * TICKS_PER_DAY);
    raiseWaitingWork(w, state);
    expect(job()?.priority, 'never past KIT_FIRST').toBe(KIT_FIRST);
  });

  it('a job whose labor is a step ahead already (the food work) goes one step, to KIT_FIRST with its labor', () => {
    const { w, job } = waitingShop('t570-raise-step', 'carpenter', 'make_barrel', 'carpentry', ['log', 'oak', 4]);
    expect(w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'carpentry', priority: ROUTINE - 1 }).ok).toBe(true);
    const state = fortress();
    raiseWaitingWork(w, state);
    for (let k = 0; k < 3; k += 1) {
      w.step(RAISE_AFTER_DAYS * TICKS_PER_DAY);
      raiseWaitingWork(w, state);
    }
    expect(job()?.priority).toBe(ROUTINE - 1);
  });

  it('a job no longer open is forgotten', () => {
    const { w, job } = waitingShop('t570-forget', 'carpenter', 'make_barrel', 'carpentry', ['log', 'oak', 4]);
    const state = fortress();
    raiseWaitingWork(w, state);
    const first = job()!.id;
    expect([...state.economy.waiting!.keys()]).toEqual([first]);
    expect(w.game.world.applyCommand({ type: 'CancelJob', jobId: first }).ok).toBe(true);
    w.step(1);
    raiseWaitingWork(w, state);
    expect(state.economy.waiting!.has(first)).toBe(false);
  });
});

describe('T-570 stone the mason wants comes back from the depot', () => {
  function depotWithStone(seed: string, hauler: boolean): { w: TestWorld; depot: number; stones: number[] } {
    const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const depot = w.build('trade_depot', w.index(30, 20, Z), 'granite');
    if (hauler) w.setLabor(w.spawnDwarf({ at: w.index(24, 20, Z) }), 'hauling');
    const stones = [0, 1, 2, 3, 4].map((k) => w.spawnItem('raw_stone', 'granite', w.index(22 + k, 24, Z)));
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'MoveToDepot', depotId: depot, itemIds: stones }).ok).toBe(true);
    return { w, depot, stones };
  }
  const atDepot = (w: TestWorld, id: number): boolean => ((w.game.world.entities.get(id, C.Item)?.flags ?? 0) & ItemFlag.AtDepot) !== 0;

  it('the stones lying at the depot, as many as are short', () => {
    const { w, depot, stones } = depotWithStone('t570-depot-lying', true);
    w.until((v) => stones.every((id) => atDepot(v, id)), 4 * TICKS_PER_DAY);
    expect(stones.every((id) => atDepot(w, id))).toBe(true);
    takeBackStone(w, depot, 2);
    expect(stones.filter((id) => !atDepot(w, id))).toHaveLength(2);
  });

  it('the hauls of stone nobody has taken up', () => {
    const { w, depot, stones } = depotWithStone('t570-depot-hauls', false);
    w.step(2);
    const jobs = w.readers.of<JobsReader>('11');
    const hauls = (): number => jobs.list().filter((j) => j.key.startsWith('depot:')).length;
    expect(hauls()).toBe(stones.length);
    takeBackStone(w, depot, 3);
    w.step(1);
    expect(hauls()).toBe(stones.length - 3);
  });
});
