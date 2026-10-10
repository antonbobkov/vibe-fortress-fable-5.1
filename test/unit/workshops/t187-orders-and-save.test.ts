import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import type { JobBoard } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

function orders(global = false) {
  const w = new TestWorld({ seed: 't187-orders', world: 'flat-test', embark: 'none' });
  const workshop = w.build('carpenter', w.index(12, 12, 32));
  w.spawnItem('log', 'oak', w.index(16, 12, 32), 6);
  w.step(1);
  const owner = global ? 0 : workshop;
  for (const recipeId of ['make_bed', 'make_barrel'])
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: owner,
      order: { recipeId, mode: 'once', remaining: 1 } }).ok).toBe(true);
  w.step(1);
  const board = w.game.world.services.jobs as JobBoard;
  const jobId = w.game.world.entities.get(workshop, C.Workshop)!.currentJobId;
  expect(jobId).not.toBe(0);
  const job = board.jobs.get(jobId)!;
  job.progress = 123;
  return { w, board, workshop, owner, jobId, job };
}

describe('T-187 work orders preserve unrelated and reordered running jobs', () => {
  it.each(['EditWorkOrder', 'RemoveWorkOrder'] as const)('%s of another local order keeps the job and progress', (type) => {
    const { w, board, owner, jobId } = orders();
    expect(w.game.world.applyCommand({ type, workshopId: owner, index: 1, patch: { priority: 2 } }).ok).toBe(true);
    expect(board.jobs.get(jobId)?.progress).toBe(123);
    expect(board.jobs.get(jobId)?.data['orderIndex']).toBe(0);
  });

  it.each([false, true])('reordering global=%s keeps identity and updates the running index', (global) => {
    const { w, board, owner, jobId, job } = orders(global);
    const key = job.key;
    expect(w.game.world.applyCommand({ type: 'ReorderWorkOrder', workshopId: owner, from: 0, to: 1 }).ok).toBe(true);
    expect(board.jobs.get(jobId)?.progress).toBe(123);
    expect(board.jobs.get(jobId)?.key).toBe(key);
    expect(board.jobs.get(jobId)?.data['orderIndex']).toBe(1);
  });

  it('editing the other global order after a reorder preserves the bed job', () => {
    const { w, board, jobId } = orders(true);
    expect(w.game.world.applyCommand({ type: 'ReorderWorkOrder', workshopId: 0, from: 0, to: 1 }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'EditWorkOrder', workshopId: 0, index: 0, patch: { priority: 2 } }).ok).toBe(true);
    expect(board.jobs.get(jobId)?.data['recipe']).toBe('make_bed');
    expect(board.jobs.get(jobId)?.progress).toBe(123);
  });

  it('removing a preceding global order renumbers the running order', () => {
    const { w, board, jobId } = orders(true);
    expect(w.game.world.applyCommand({ type: 'ReorderWorkOrder', workshopId: 0, from: 0, to: 1 }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'RemoveWorkOrder', workshopId: 0, index: 0 }).ok).toBe(true);
    expect(board.jobs.get(jobId)?.data['orderIndex']).toBe(0);
    expect(board.jobs.get(jobId)?.progress).toBe(123);
  });

  it.each(['EditWorkOrder', 'RemoveWorkOrder'] as const)('%s of the running local order still cancels it', (type) => {
    const { w, board, owner, jobId } = orders();
    expect(w.game.world.applyCommand({ type, workshopId: owner, index: 0, patch: { priority: 2 } }).ok).toBe(true);
    expect(board.jobs.has(jobId)).toBe(false);
  });

  it('a reordered global job survives save/load and completes its own order', () => {
    const { w } = orders(true);
    expect(w.game.world.applyCommand({ type: 'ReorderWorkOrder', workshopId: 0, from: 0, to: 1 }).ok).toBe(true);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.game.hash());
    w.replaceGame(loaded);
    w.spawnDwarf({ at: w.index(16, 12, 32), skills: { carpentry: 10 } });
    w.until((v) => v.events('ItemCrafted').some((ev) => ev['recipeId'] === 'make_bed'), 1200);
    const system = loaded.world.scheduler.byId('12') as import('@systems/workshops').WorkshopsSystem;
    expect(system.operator.globalOrders.map((o) => system.operator.recipe(o.recipe)?.id)).toEqual(['make_barrel']);
  });

  it.each(['EditWorkOrder', 'RemoveWorkOrder'] as const)('%s of the running global order cancels only its job', (type) => {
    const { w, board, jobId } = orders(true);
    expect(w.game.world.applyCommand({ type: 'ReorderWorkOrder', workshopId: 0, from: 0, to: 1 }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type, workshopId: 0, index: 1, patch: { priority: 2 } }).ok).toBe(true);
    expect(board.jobs.has(jobId)).toBe(false);
  });

  it('a local edit does not cancel the global order running in that workshop', () => {
    const { w, board, workshop, jobId } = orders(true);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: workshop,
      order: { recipeId: 'make_barrel' } }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'EditWorkOrder', workshopId: workshop,
      index: 0, patch: { priority: 2 } }).ok).toBe(true);
    expect(board.jobs.get(jobId)?.progress).toBe(123);
    expect(board.jobs.get(jobId)?.data['orderIndex']).toBe(0);
  });

  it('completing a global order renumbers another workshop job without replacing it', () => {
    const { w, board } = orders(true);
    const second = w.build('carpenter', w.index(22, 12, 32));
    w.step(1);
    const otherId = w.game.world.entities.get(second, C.Workshop)!.currentJobId;
    expect(board.jobs.get(otherId)?.data['orderIndex']).toBe(1);
    w.spawnDwarf({ at: w.index(16, 12, 32), skills: { carpentry: 10 } });
    w.until((v) => v.events('ItemCrafted').some((e) => e['recipeId'] === 'make_bed'), 1200);
    expect(board.jobs.get(otherId)?.data['orderIndex']).toBe(0);
    expect(board.jobs.get(otherId)?.data['recipe']).toBe('make_barrel');
  });

  it('a removed global serial is not reused after save/load', () => {
    const { w, job } = orders(true);
    const oldKey = job.key;
    expect(w.game.world.applyCommand({ type: 'RemoveWorkOrder', workshopId: 0, index: 0 }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'RemoveWorkOrder', workshopId: 0, index: 0 }).ok).toBe(true);
    w.replaceGame(roundTrip(w.game).game);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: 0,
      order: { recipeId: 'make_bed' } }).ok).toBe(true);
    w.step(1);
    const replacement = [...(w.game.world.services.jobs as JobBoard).jobs.values()].find((j) => j.data['globalOrder'] === true)!;
    expect(replacement.key).not.toBe(oldKey);
  });

  it('loads legacy indexed orders unchanged and gives them stable identities on use', () => {
    const { w, job } = orders(true);
    const op = (w.game.world.scheduler.byId('12') as import('@systems/workshops').WorkshopsSystem).operator;
    for (const order of op.globalOrders) delete order.serial;
    op.nextOrderSerial = 0;
    delete job.data['orderSerial'];
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.game.hash());
    w.replaceGame(loaded);
    expect(w.game.world.applyCommand({ type: 'ReorderWorkOrder', workshopId: 0, from: 0, to: 1 }).ok).toBe(true);
    const restored = (loaded.world.services.jobs as JobBoard).jobs.get(job.id)!;
    expect(restored.key).toBe(job.key);
    expect(restored.data['orderIndex']).toBe(1);
    expect(restored.progress).toBe(123);
  });

  it('a melt job saved before claim reserves its entire marked stack', () => {
    const w = new TestWorld({ seed: 't187-melt-save', world: 'flat-test', embark: 'none' });
    const smelter = w.build('smelter', w.index(12, 12, 32));
    w.step(1);
    const stack = w.spawnItem('bar', 'iron', w.index(16, 12, 32), 2);
    w.spawnItem('charcoal_bar', 'charcoal', w.index(16, 13, 32));
    expect(w.game.world.applyCommand({ type: 'MeltItem', itemId: stack, on: true }).ok).toBe(true);
    w.step(1);
    const key = `craft:auto-melt:${smelter}`;
    expect((w.game.world.services.jobs as JobBoard).byKey(key)?.inputs[0]?.wholeItem).toBe(true);
    const loaded = roundTrip(w.game).game;
    expect((loaded.world.services.jobs as JobBoard).byKey(key)?.inputs[0]?.wholeItem).toBe(true);
    w.replaceGame(loaded);
    w.spawnDwarf({ at: w.index(16, 12, 32), skills: { smelting: 10 } });
    w.until(() => ((w.game.world.services.jobs as JobBoard).byKey(key)?.inputs[0]?.reserved.length ?? 0) > 0, 200);
    expect(w.game.world.entities.get(stack, C.Item)?.count).toBe(2);
    expect((w.game.world.services.jobs as JobBoard).byKey(key)?.inputs[0]?.reserved).toEqual([stack]);
  });
});
