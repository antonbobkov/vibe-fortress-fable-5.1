import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import type { TickContext } from '@core/system';
import type { Job } from '@systems/jobs';
import type { ItemsReader } from '@systems/items';
import { BARS_PER_ORE, COAL_PER_ORE, SILVER_FROM_GALENA_PERMILLE } from '@systems/workshops/constants';
import type { RecipeRow, WorkshopsReader, WorkshopsSystem } from '@systems/workshops';
import { TestWorld } from '../../scenarios/test-world';

describe('T-M5-01 wood furnace and smelter fuel and ore yields', () => {
  it('generates an exact recipe for every ore, with no workshop fuel for coal', () => {
    const w = new TestWorld({ seed: 'm5-ore-rows', world: 'flat-test', embark: 'none' });
    const ores = w.game.registry.table<{ id: string; yields: readonly { metal: string; count: number; permille?: number }[] }>('minerals');
    const recipes = w.readers.of<WorkshopsReader>('12');
    for (const ore of ores.ids()) {
      const row = ores.byId(ore)!;
      const recipe = recipes.recipe(`smelt_${ore}`)!;
      expect(recipe.inputs).toEqual([{ match: 'ore', count: 1, material: ore }]);
      expect(recipe.outputs).toEqual(row.yields.map((y) => ({
        item: y.metal === 'coal' ? 'coal_bar' : 'bar', count: y.count, material: { fixed: y.metal },
        ...(y.permille === undefined ? {} : { permille: y.permille }),
      })));
      expect(recipe.fuel).toBe(!row.yields.some((y) => y.metal === 'coal'));
      if (row.yields.length === 1 && row.yields[0]?.permille === undefined && row.yields[0]?.metal !== 'coal' && ore !== 'deepsilver_ore') {
        expect(recipe.outputs[0]?.count).toBe(BARS_PER_ORE);
      }
    }
    expect(recipes.recipe('smelt_bituminous_coal')?.outputs[0]?.count).toBe(COAL_PER_ORE);
    expect(recipes.recipe('smelt_lignite')?.outputs[0]?.count).toBe(1);
    expect(recipes.recipe('make_charcoal')?.outputs[0]?.material).toEqual({ fixed: 'charcoal' });
  });

  it('executes 1,000 smelts per ore and applies the silver chance only to the byproduct', () => {
    const w = new TestWorld({ seed: 'm5-thousand-smelts', world: 'flat-test', embark: 'none' });
    const at = w.index(15, 15, 32);
    const smelter = w.build('smelter', at);
    const worker = w.spawnDwarf({ at: w.index(18, 17, 32) });
    w.step(1);
    const system = w.game.world.scheduler.byId('12') as WorkshopsSystem;
    const ores = w.game.registry.table<{ id: string; yields: readonly { metal: string; count: number; permille?: number }[] }>('minerals');
    const items = w.readers.of<ItemsReader>('13');
    const materials = w.game.registry.table('materials');
    const made: { type: number; material: number; count: number }[] = [];
    const ctx = { world: w.game.world, registry: w.game.registry,
      spawn: { item: (type: number, material: number, _at: unknown, count: number) => {
        made.push({ type, material, count });
        return 0;
      } }, emit: () => {} } as unknown as TickContext;
    for (const ore of ores.ids()) {
      const row = ores.byId(ore)!;
      const recipe = system.operator.recipe(`smelt_${ore}`) as RecipeRow;
      const totals = new Map<string, number>();
      for (let trial = 0; trial < 1000; trial += 1) {
        made.length = 0;
        const input = w.spawnItem('ore', ore, at);
        const fuel = recipe.fuel ? w.spawnItem('charcoal_bar', 'charcoal', at) : 0;
        const delivered = [{ filter: {}, count: 1, reserved: [input], delivered: [input] }];
        if (fuel !== 0) delivered.push({ filter: {}, count: 1, reserved: [fuel], delivered: [fuel] });
        system.operator.producer().onComplete?.({ id: 0, workerId: worker, target: { kind: 'building', ref: smelter },
          inputs: delivered, data: { recipe: recipe.id, orderIndex: 0, globalOrder: false } } as unknown as Job, ctx);
        expect(items.get(input)).toBeUndefined();
        if (fuel !== 0) expect(items.get(fuel)).toBeUndefined();
        for (const out of made) {
          const metal = materials.byIndex(out.material)?.id ?? '';
          totals.set(metal, (totals.get(metal) ?? 0) + out.count);
          expect(out.type).toBe(w.game.registry.table('items').index(metal === 'coal' ? 'coal_bar' : 'bar'));
        }
      }
      for (const yieldRow of row.yields) {
        const expected = yieldRow.count * (yieldRow.permille === undefined ? 1000 : yieldRow.permille);
        const actual = totals.get(yieldRow.metal) ?? 0;
        if (yieldRow.permille === undefined) expect(actual, ore).toBe(expected);
        else expect(Math.abs(actual - expected), ore).toBeLessThanOrEqual(30);
      }
      if (ore === 'galena' || ore === 'tetrahedrite') expect(row.yields[1]?.permille).toBe(SILVER_FROM_GALENA_PERMILLE);
    }
    expect(w.game.world.entities.get(smelter, C.Workshop)).toBeDefined();
  });
});
