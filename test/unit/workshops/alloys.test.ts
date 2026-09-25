import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import type { TickContext } from '@core/system';
import type { Job } from '@systems/jobs';
import type { ItemsReader } from '@systems/items';
import { recipeInputFilter, type RecipeRow, type WorkshopsReader, type WorkshopsSystem } from '@systems/workshops';
import { TestWorld } from '../../scenarios/test-world';

describe('T-M5-02 alloys and steel', () => {
  it('matches flux-tagged stone and either fuel bar while reserving two fuel for ordinary steel', () => {
    const w = new TestWorld({ seed: 'm5-flux', world: 'flat-test', embark: 'none' });
    const smelter = w.build('smelter', w.index(15, 15, 32));
    w.step(1);
    const registry = w.game.registry;
    const recipe = w.readers.of<WorkshopsReader>('12').recipe('alloy_steel')!;
    const order = { recipe: registry.table('recipes').index('alloy_steel'), remaining: 1, mode: 'once' as const,
      threshold: 0, priority: 5 as const, materialFilter: null };
    const flux = recipeInputFilter(registry, recipe.inputs[1]!, order);
    expect(flux.type).toBe(registry.table('items').index('raw_stone'));
    expect(flux.materialIds?.map((id) => registry.table('materials').idOf(id)).sort()).toEqual(['chalk', 'dolomite', 'limestone', 'marble']);
    const carbon = recipeInputFilter(registry, recipe.inputs[2]!, order);
    expect(carbon).toEqual({ tag: 'fuel' });
    const at = w.index(19, 17, 32);
    w.spawnItem('bar', 'iron', at);
    w.spawnItem('raw_stone', 'granite', at);
    w.spawnItem('coal_bar', 'coal', at);
    const reader = w.readers.of<WorkshopsReader>('12');
    expect(reader.isRunnable('alloy_steel', smelter).runnable).toBe(false);
    w.spawnItem('raw_stone', 'limestone', at);
    expect(reader.isRunnable('alloy_steel', smelter)).toEqual({ runnable: false, reason: 'missing_input' });
    w.spawnItem('charcoal_bar', 'charcoal', at);
    expect(reader.isRunnable('alloy_steel', smelter)).toEqual({ runnable: true, reason: null });
  });

  it('executes all five alloy rows and consumes the steel reaction fuel plus workshop fuel', () => {
    const w = new TestWorld({ seed: 'm5-alloy-outputs', world: 'flat-test', embark: 'none' });
    const at = w.index(15, 15, 32);
    const smelter = w.build('smelter', at);
    const worker = w.spawnDwarf({ at: w.index(18, 17, 32) });
    w.step(1);
    const system = w.game.world.scheduler.byId('12') as WorkshopsSystem;
    const items = w.readers.of<ItemsReader>('13');
    const rows = w.readers.of<WorkshopsReader>('12').recipesFor('smelter').filter((r) => r.id.startsWith('alloy_'));
    expect(rows).toHaveLength(5);
    const events: { type: string; itemId?: number; recipeId?: string }[] = [];
    const ctx = { world: w.game.world, registry: w.game.registry, spawn: w.game.world.services.spawn,
      emit: (event: { type: string; itemId?: number; recipeId?: string }) => events.push(event) } as unknown as TickContext;
    for (const recipe of rows) {
      const inputs = recipe.inputs.map((input) => {
        const type = input.match === 'raw_stone' ? 'raw_stone' : input.match === 'coal_bar|charcoal_bar' ? 'charcoal_bar' : 'bar';
        const material = input.material === 'flux' ? 'limestone' : input.material === 'fuel' ? 'charcoal' : input.material!;
        const item = w.spawnItem(type, material, at, input.count);
        return { filter: {}, count: input.count, reserved: [item], delivered: [item] };
      });
      const workshopFuel = w.spawnItem('coal_bar', 'coal', at);
      inputs.push({ filter: {}, count: 1, reserved: [workshopFuel], delivered: [workshopFuel] });
      system.operator.producer().onComplete?.({ id: 0, workerId: worker, target: { kind: 'building', ref: smelter },
        inputs, data: { recipe: recipe.id, orderIndex: 0, globalOrder: false } } as unknown as Job, ctx);
      for (const input of inputs) for (const id of input.delivered) expect(items.get(id), recipe.id).toBeUndefined();
      const crafted = events.find((event) => event.type === 'ItemCrafted' && event.recipeId === recipe.id);
      const output = items.get(crafted?.itemId ?? 0);
      expect(output?.count, recipe.id).toBe(recipe.outputs[0]?.count);
      expect(output?.material, recipe.id).toBe(w.game.registry.table('materials').index(recipe.id.slice('alloy_'.length)));
      expect(output?.type, recipe.id).toBe(w.game.registry.table('items').index('bar'));
    }
    expect(w.game.world.entities.get(smelter, C.Workshop)).toBeDefined();
  });

  it('uses only the steel reaction fuel when the smelter has magma power', () => {
    const w = new TestWorld({ seed: 'm5-steel-magma-fuel', world: 'flat-test', embark: 'none' });
    const at = w.index(15, 15, 32);
    w.setFluid(w.map.below(at), 7, 'magma', true);
    const smelter = w.build('magma_smelter', at, 'granite');
    const worker = w.spawnDwarf({ at: w.index(18, 17, 32) });
    w.step(1);
    const system = w.game.world.scheduler.byId('12') as WorkshopsSystem;
    expect(system.operator.isMagmaPowered(smelter)).toBe(true);
    const recipe = system.operator.recipe('alloy_steel') as RecipeRow;
    const iron = w.spawnItem('bar', 'iron', at);
    const flux = w.spawnItem('raw_stone', 'limestone', at);
    const carbon = w.spawnItem('charcoal_bar', 'charcoal', at);
    const inputIds = [iron, flux, carbon];
    const inputs = inputIds.map((id) => ({ filter: {}, count: 1, reserved: [id], delivered: [id] }));
    const ctx = { world: w.game.world, registry: w.game.registry, spawn: w.game.world.services.spawn,
      emit: () => {} } as unknown as TickContext;
    system.operator.producer().onComplete?.({ id: 0, workerId: worker, target: { kind: 'building', ref: smelter },
      inputs, data: { recipe: recipe.id, orderIndex: 0, globalOrder: false } } as unknown as Job, ctx);
    const items = w.readers.of<ItemsReader>('13');
    for (const id of inputIds) expect(items.get(id)).toBeUndefined();
    expect(items.countMatching({ type: w.game.registry.table('items').index('bar'),
      materialId: w.game.registry.table('materials').index('steel') })).toBe(1);
  });
});
