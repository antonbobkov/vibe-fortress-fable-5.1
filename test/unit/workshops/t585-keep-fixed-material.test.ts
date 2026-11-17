/**
 * T-585: a keep order counts the material its recipe makes (12 § Work orders). "Keep 4 glass blocks"
 * at the kiln was stocked by any stone block, so in a fortress of sandstone blocks no glass was ever
 * made, and `fire_bricks` never ran. An output of a `fixed` material, an alloy, or the one material
 * its source input names is now counted by that material alone, whatever the order's filter.
 */
import { describe, expect, it } from 'vitest';
import { C, type WorkOrder } from '@core/components';
import type { EntityId } from '@core/types';
import { outputFilter, type RecipeRow } from '@systems/workshops/operate';
import type { WorkshopsReader } from '@systems/workshops';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

function keep(w: TestWorld, recipeId: string, materialFilter?: string): WorkOrder {
  const recipes = w.game.registry.table<RecipeRow>('recipes');
  const materials = w.game.registry.table('materials');
  return { recipe: recipes.index(recipeId), remaining: 0, mode: 'maintain', threshold: 4, priority: 5,
    materialFilter: materialFilter === undefined ? null : materials.has(materialFilter) ? materials.index(materialFilter) : materialFilter };
}

function counted(w: TestWorld, recipeId: string, materialFilter?: string): { type?: number; materialId?: number; materialClass?: string } {
  const recipe = w.game.registry.table<RecipeRow>('recipes').byId(recipeId) as RecipeRow;
  return outputFilter(w.game.registry, recipe, keep(w, recipeId, materialFilter));
}

describe('T-585 a keep order counts the material its recipe makes', () => {
  it('counts a fixed material, an alloy, or the material a source input names; otherwise the filter', () => {
    const w = new TestWorld({ seed: 't585-filters', world: 'flat-test', embark: 'none' });
    const items = w.game.registry.table('items');
    const m = (id: string): number => w.game.registry.table('materials').index(id);
    expect(counted(w, 'make_glass_block')).toEqual({ type: items.index('stone_block'), materialId: m('glass') });
    expect(counted(w, 'fire_bricks')).toEqual({ type: items.index('stone_block'), materialId: m('brick') });
    expect(counted(w, 'make_jug')).toEqual({ type: items.index('bucket'), materialId: m('earthenware') });
    expect(counted(w, 'smelt_hematite')).toEqual({ type: items.index('bar'), materialId: m('iron') });
    expect(counted(w, 'alloy_steel')).toEqual({ type: items.index('bar'), materialId: m('steel') });
    expect(counted(w, 'knap_dagger_obsidian')).toEqual({ type: items.index('dagger'), materialId: m('obsidian') });
    expect(counted(w, 'distill')).toEqual({ type: items.index('drink'), materialId: m('deepfire') });
    // The filter constrains the input, not what the recipe makes.
    expect(counted(w, 'distill', 'ale')).toEqual({ type: items.index('drink'), materialId: m('deepfire') });
    expect(counted(w, 'make_glass_block', 'sand')).toEqual({ type: items.index('stone_block'), materialId: m('glass') });
    // A material from whatever is delivered: the filter decides, and no filter counts the type.
    expect(counted(w, 'make_stone_block')).toEqual({ type: items.index('stone_block') });
    expect(counted(w, 'make_stone_block', 'granite')).toEqual({ type: items.index('stone_block'), materialId: m('granite') });
    expect(counted(w, 'make_table_bone')).toEqual({ type: items.index('table') });
    expect(counted(w, 'forge_short_sword', 'metal')).toEqual({ type: items.index('short_sword'), materialClass: 'metal' });
  });

  it('a kiln keeping glass blocks in a fortress full of stone blocks makes glass', () => {
    const w = new TestWorld({ seed: 't585-kiln', world: 'flat-test', embark: 'none' });
    const kiln = w.build('kiln', w.index(15, 15, Z), 'granite');
    w.spawnDwarf({ at: w.index(20, 18, Z), skills: { pottery: 5 } });
    w.spawnItem('stone_block', 'granite', w.index(24, 20, Z), 30);
    w.spawnItem('soil_load', 'sand', w.index(21, 18, Z), 4);
    w.spawnItem('charcoal_bar', 'charcoal', w.index(21, 19, Z), 2);
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: kiln,
      order: { recipeId: 'make_glass_block', mode: 'maintain', threshold: 2, priority: 5 } })).toEqual({ ok: true });
    const reader = w.readers.of<WorkshopsReader>('12');
    expect(reader.orderStock(reader.ordersOf(kiln)[0] as WorkOrder)).toBe(0);
    const glass = w.game.registry.table('materials').index('glass');
    const glassBlocks = (): number => w.game.world.entities.with(C.Item)
      .map((id: EntityId) => w.game.world.entities.get(id, C.Item))
      .filter((i) => i?.material === glass).reduce((n, i) => n + (i?.count ?? 0), 0);
    w.until(() => glassBlocks() >= 2, 6000);
    expect(glassBlocks()).toBe(2);
    expect(reader.orderStock(reader.ordersOf(kiln)[0] as WorkOrder)).toBe(2);
  }, 60_000);
});
