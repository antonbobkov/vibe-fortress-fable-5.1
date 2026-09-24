import { describe, expect, it } from 'vitest';
import { C, ItemFlag } from '@core/components';
import type { TickContext } from '@core/system';
import type { Job, JobBoard } from '@systems/jobs';
import type { ItemsReader } from '@systems/items';
import type { MoraleReader } from '@systems/morale';
import type { WorkshopsReader, WorkshopsSystem } from '@systems/workshops';
import { TestWorld } from '../../scenarios/test-world';

describe('T-M5-06 melting marked metal items', () => {
  it('requires the Melt flag, consumes a two-bar iron axe and fuel, and returns one iron bar', () => {
    const w = new TestWorld({ seed: 'm5-melt-axe', world: 'flat-test', embark: 'none' });
    const at = w.index(16, 16, 32);
    const smelter = w.build('smelter', at);
    const worker = w.spawnDwarf({ at: w.index(20, 16, 32), skills: { smelting: 20 } });
    w.step(1);
    const op = (w.game.world.scheduler.byId('12') as WorkshopsSystem).operator;
    const recipe = w.readers.of<WorkshopsReader>('12').recipe('melt_metal_item')!;
    const order = { recipe: op.recipeIndex(recipe.id), remaining: 1, mode: 'once' as const,
      threshold: 0, priority: 5 as const, materialFilter: null };
    const axe = w.spawnItem('axe', 'iron', w.index(20, 17, 32));
    const fuel = w.spawnItem('charcoal_bar', 'charcoal', w.index(20, 18, 32));
    expect(op.inputFilter(recipe, recipe.inputs[0]!, order)?.requiredFlags).toBe(ItemFlag.Melt);
    expect(op.problem(order, smelter)).toBe('waiting for any');
    expect(w.game.world.applyCommand({ type: 'MeltItem', itemId: axe, on: true })).toEqual({ ok: true });
    expect(op.problem(order, smelter)).toBeNull();
    const before = new Set(w.game.world.entities.with(C.Item));
    const ctx = { world: w.game.world, registry: w.game.registry, spawn: w.game.world.services.spawn,
      emit: (event: Parameters<typeof w.game.world.emit>[0]) => w.game.world.emit(event) } as unknown as TickContext;
    op.producer().onComplete?.({ id: 0, workerId: worker, target: { kind: 'building', ref: smelter },
      inputs: [{ filter: {}, count: 1, reserved: [axe], delivered: [axe] },
        { filter: {}, count: 1, reserved: [fuel], delivered: [fuel] }],
      data: { recipe: recipe.id, orderIndex: -1, globalOrder: false } } as unknown as Job, ctx);
    const items = w.readers.of<ItemsReader>('13');
    expect(items.get(axe)).toBeUndefined();
    expect(items.get(fuel)).toBeUndefined();
    const bars = w.game.world.entities.with(C.Item).filter((id) => !before.has(id));
    expect(bars).toHaveLength(1);
    expect(w.game.registry.table('items').idOf(items.get(bars[0]!)!.type)).toBe('bar');
    expect(w.game.registry.table('materials').idOf(items.get(bars[0]!)!.material)).toBe('iron');
    expect(items.get(bars[0]!)?.count).toBe(1);
    w.step(1);
    expect(w.events('ItemDestroyed').some((event) => event['id'] === axe && event['reason'] === 'melted')).toBe(true);
  });

  it('the default autoMeltMarked order creates a craft job and its toggle stops new jobs', () => {
    const w = new TestWorld({ seed: 'm5-auto-melt', world: 'flat-test', embark: 'none' });
    const smelter = w.build('smelter', w.index(16, 16, 32));
    w.step(1);
    const axe = w.spawnItem('axe', 'iron', w.index(20, 17, 32));
    w.spawnItem('charcoal_bar', 'charcoal', w.index(20, 18, 32));
    expect(w.game.world.applyCommand({ type: 'MeltItem', itemId: axe, on: true })).toEqual({ ok: true });
    expect(w.game.world.applyCommand({ type: 'SetStandingOrder', name: 'autoMeltMarked', on: false })).toEqual({ ok: true });
    w.step(1);
    const board = w.game.world.services.jobs as JobBoard;
    expect(board.byKey(`craft:auto-melt:${smelter}`)).toBeUndefined();
    expect(w.game.world.applyCommand({ type: 'SetStandingOrder', name: 'autoMeltMarked', on: true })).toEqual({ ok: true });
    w.step(1);
    const job = board.byKey(`craft:auto-melt:${smelter}`);
    expect(job).toBeDefined();
    expect(job?.inputs[0]?.filter.itemId).toBe(axe);
    expect(job?.inputs[0]?.filter.requiredFlags).toBe(ItemFlag.Melt);
  });

  it('executes an explicit smelter order before the automatic melt order', () => {
    const w = new TestWorld({ seed: 'm5-melt-order', world: 'flat-test', embark: 'none' });
    const smelter = w.build('smelter', w.index(16, 16, 32));
    w.step(1);
    const axe = w.spawnItem('axe', 'iron', w.index(20, 17, 32));
    w.spawnItem('ore', 'hematite', w.index(20, 18, 32));
    w.spawnItem('charcoal_bar', 'charcoal', w.index(20, 19, 32), 2);
    expect(w.game.world.applyCommand({ type: 'MeltItem', itemId: axe, on: true })).toEqual({ ok: true });
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: smelter,
      order: { recipeId: 'smelt_hematite', remaining: 1, mode: 'once' } })).toEqual({ ok: true });
    w.step(1);
    const board = w.game.world.services.jobs as JobBoard;
    expect(board.byKey(`craft:${smelter}:0`)?.data['recipe']).toBe('smelt_hematite');
    expect(board.byKey(`craft:auto-melt:${smelter}`)).toBeUndefined();
  });

  it('uses the one-bar fallback for a whole marked stack of metal bars', () => {
    const w = new TestWorld({ seed: 'm5-melt-stack', world: 'flat-test', embark: 'none' });
    const smelter = w.build('smelter', w.index(16, 16, 32));
    const worker = w.spawnDwarf({ at: w.index(20, 16, 32), skills: { smelting: 20 } });
    w.step(1);
    const bars = w.spawnItem('bar', 'iron', w.index(20, 17, 32), 5);
    const fuel = w.spawnItem('charcoal_bar', 'charcoal', w.index(20, 18, 32));
    expect(w.game.world.applyCommand({ type: 'MeltItem', itemId: bars, on: true })).toEqual({ ok: true });
    const before = new Set(w.game.world.entities.with(C.Item));
    const ctx = { world: w.game.world, registry: w.game.registry, spawn: w.game.world.services.spawn,
      emit: (event: Parameters<typeof w.game.world.emit>[0]) => w.game.world.emit(event) } as unknown as TickContext;
    (w.game.world.scheduler.byId('12') as WorkshopsSystem).operator.producer().onComplete?.({
      id: 0, workerId: worker, target: { kind: 'building', ref: smelter },
      inputs: [{ filter: {}, count: 1, reserved: [bars], delivered: [bars] },
        { filter: {}, count: 1, reserved: [fuel], delivered: [fuel] }],
      data: { recipe: 'melt_metal_item', orderIndex: -1, globalOrder: false },
    } as unknown as Job, ctx);
    expect(w.readers.of<ItemsReader>('13').get(bars)).toBeUndefined();
    const made = w.game.world.entities.with(C.Item).filter((id) => !before.has(id));
    expect(made).toHaveLength(1);
    expect(w.readers.of<ItemsReader>('13').get(made[0]!)?.count).toBe(3);
  });

  it('finishes an automatic melt through the job board', () => {
    const w = new TestWorld({ seed: 'm5-melt-job', world: 'flat-test', embark: 'none' });
    w.build('smelter', w.index(16, 16, 32));
    w.spawnDwarf({ at: w.index(20, 16, 32), skills: { smelting: 20 } });
    w.step(1);
    const axe = w.spawnItem('axe', 'iron', w.index(20, 17, 32));
    w.spawnItem('charcoal_bar', 'charcoal', w.index(20, 18, 32));
    expect(w.game.world.applyCommand({ type: 'MeltItem', itemId: axe, on: true })).toEqual({ ok: true });
    const items = w.readers.of<ItemsReader>('13');
    for (let tick = 0; tick < 800 && items.count('bar') === 0; tick += 1) w.step(1);
    expect(items.count('bar')).toBe(1);
    expect(items.get(axe)).toBeUndefined();
  });

  it('melting a masterwork emits ItemDestroyed with its crafter and gives masterwork_lost', () => {
    const w = new TestWorld({ seed: 'm5-masterwork-melt', world: 'flat-test', embark: 'none' });
    const at = w.index(16, 16, 32);
    const smelter = w.build('smelter', at);
    const crafter = w.spawnDwarf({ at: w.index(20, 16, 32), skills: { smelting: 20 } });
    w.step(1);
    const axe = w.spawnItem('axe', 'iron', w.index(20, 17, 32), 1, 5);
    w.game.world.services.items?.setCrafter?.(axe, crafter);
    const fuel = w.spawnItem('charcoal_bar', 'charcoal', w.index(20, 18, 32));
    expect(w.game.world.applyCommand({ type: 'MeltItem', itemId: axe, on: true })).toEqual({ ok: true });
    const op = (w.game.world.scheduler.byId('12') as WorkshopsSystem).operator;
    const ctx = { world: w.game.world, registry: w.game.registry, spawn: w.game.world.services.spawn,
      emit: (event: Parameters<typeof w.game.world.emit>[0]) => w.game.world.emit(event) } as unknown as TickContext;
    op.producer().onComplete?.({ id: 0, workerId: crafter, target: { kind: 'building', ref: smelter },
      inputs: [{ filter: {}, count: 1, reserved: [axe], delivered: [axe] },
        { filter: {}, count: 1, reserved: [fuel], delivered: [fuel] }],
      data: { recipe: 'melt_metal_item', orderIndex: -1, globalOrder: false } } as unknown as Job, ctx);
    w.step(1);
    expect(w.events('ItemDestroyed').some((event) => event['id'] === axe && event['quality'] === 5 &&
      event['crafterId'] === crafter)).toBe(true);
    expect(w.readers.of<MoraleReader>('15').thoughts(crafter).some((thought) => thought.id === 'masterwork_lost')).toBe(true);
  });
});
