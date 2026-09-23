import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import type { TickContext } from '@core/system';
import type { Job } from '@systems/jobs';
import { resolveMaterial, type RecipeRow, type WorkshopsSystem, type WorkshopsReader } from '@systems/workshops';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

const WORKSHOPS = ['carpenter', 'mason', 'craftdwarf', 'kitchen', 'still', 'farmers_workshop'] as const;

function inputMaterial(type: string, recipe: RecipeRow): string {
  if (type === 'log') return 'oak';
  if (type === 'raw_stone') return 'granite';
  if (type === 'bar') return 'copper';
  if (type === 'bone_pile' || type === 'skull') return 'bone';
  if (type === 'shell_piece') return 'shell';
  if (type === 'milk') return 'milk';
  if (type === 'fat') return 'tallow';
  if (type === 'plant_food' && recipe.id === 'brew') return 'dimcap';
  if (type === 'plant_food' && recipe.id === 'mill_flour') return 'barley';
  return 'turnip';
}

function fixtureInputType(match: string): string { return match === 'ingredient' ? 'plant_food' : match; }

/** A single world per workshop runs all its authored recipes; no full map is built per row. */
function exercise(workshopType: string): { count: number; outputs: { recipe: string; ids: number[]; container: number }[]; world: TestWorld } {
  const w = new TestWorld({ seed: `m4-recipes-${workshopType}`, world: 'flat-test', embark: 'none' });
  const at = w.index(15, 15, 32);
  const workshop = w.build(workshopType, at);
  const dwarf = w.spawnDwarf({ at: w.index(18, 16, 32) });
  w.step(1);
  const system = w.game.world.scheduler.byId('12') as WorkshopsSystem;
  const recipes = w.readers.of<WorkshopsReader>('12').recipesFor(workshopType);
  const itemTable = w.game.registry.table<{ id: string; tags?: readonly string[]; stack: number }>('items');
  const matTable = w.game.registry.table('materials');
  const items = w.readers.of<ItemsReader>('13');
  const outputs: { recipe: string; ids: number[]; container: number }[] = [];
  const ctx = { world: w.game.world, registry: w.game.registry, spawn: w.game.world.services.spawn,
    emit: (event: Parameters<typeof w.game.world.emit>[0]) => w.game.world.emit(event) } as unknown as TickContext;

  for (const recipe of recipes) {
    const inputMaterials: number[] = [];
    const inputs = recipe.inputs.map((input) => {
      const type = fixtureInputType(input.match);
      const material = input.material && input.material !== 'any' ? input.material : inputMaterial(type, recipe);
      inputMaterials.push(matTable.index(material));
      const delivered: number[] = [];
      for (let n = 0; n < input.count; n += 1) delivered.push(w.spawnItem(type, material, at));
      return { filter: {}, count: input.count, reserved: delivered.slice(), delivered };
    });
    const container = recipe.container ? w.spawnItem(recipe.container, 'oak', at) : 0;
    if (container !== 0) inputs.push({ filter: {}, count: 1, reserved: [container], delivered: [container] });
    const before = new Set(w.game.world.entities.with(C.Item));
    const job = { id: 0, workerId: dwarf, target: { kind: 'building', ref: workshop },
      inputs, data: { recipe: recipe.id, orderIndex: 0, globalOrder: false } } as unknown as Job;
    system.operator.producer().onComplete?.(job, ctx);
    const made = w.game.world.entities.with(C.Item).filter((id) => !before.has(id));
    expect(made.length, recipe.id).toBe(recipe.outputs.length);
    for (let k = 0; k < recipe.outputs.length; k += 1) {
      const out = recipe.outputs[k]!;
      const id = made[k]!;
      const rec = items.get(id)!;
      const type = itemTable.byIndex(rec.type)!;
      expect(type.id === out.item || type.tags?.includes(out.item) === true, recipe.id).toBe(true);
      expect(rec.count, recipe.id).toBe(out.count);
      expect(rec.material, recipe.id).toBe(resolveMaterial(w.game.registry, out.material, inputMaterials));
      expect(rec.containerId, recipe.id).toBe(container);
      if (!recipe.quality) expect(rec.quality, recipe.id).toBe(1);
      else expect(rec.quality, recipe.id).toBeGreaterThanOrEqual(0);
      expect(rec.crafterId, recipe.id).toBe(dwarf);
    }
    for (let k = 0; k < recipe.inputs.length; k += 1) for (const id of inputs[k]!.delivered) expect(items.get(id), recipe.id).toBeUndefined();
    outputs.push({ recipe: recipe.id, ids: made, container });
  }
  return { count: recipes.length, outputs, world: w };
}

describe('T-M4-09 first workshop recipes', () => {
  for (const workshop of WORKSHOPS) {
    it(`executes every ${workshop} recipe with its documented inputs and outputs`, () => {
      const result = exercise(workshop);
      expect(result.count).toBe(result.world.game.registry.table<RecipeRow>('recipes').where(`workshop:${workshop}`, (r) => r.workshop === workshop).length);
    });
  }

  it('brewing fills an empty barrel with twenty species drink units; flour fills a bag', () => {
    const still = exercise('still');
    const brew = still.outputs;
    const drinks = still.world.readers.of<ItemsReader>('13');
    const world = exercise('farmers_workshop');
    const items = world.world.readers.of<ItemsReader>('13');
    const flour = world.outputs.find((o) => o.recipe === 'mill_flour')!;
    expect(items.get(flour.ids[0]!)?.count).toBe(3);
    expect(items.inContainer(flour.container)).toContain(flour.ids[0]);
    const ale = brew.find((o) => o.recipe === 'brew')!;
    expect(ale.ids).toHaveLength(1);
    expect(drinks.get(ale.ids[0]!)?.count).toBe(20);
    expect(drinks.get(ale.ids[0]!)?.material).toBe(still.world.game.registry.table('materials').index('dimcap_ale'));
    expect(drinks.inContainer(ale.container)).toContain(ale.ids[0]);
  });

  it('names meals from their first ingredient and a dish word in the correct tier', () => {
    const result = exercise('kitchen');
    const reader = result.world.readers.of<WorkshopsReader>('12');
    const dishes = result.world.game.registry.derived<{ dishes: Record<string, string[]> }>('names').dishes;
    for (const tier of ['easy', 'fine', 'lavish']) {
      const made = result.outputs.find((o) => o.recipe === `cook_${tier}_meal`)!;
      const name = reader.mealName(made.ids[0]!);
      expect(name?.startsWith('turnip ')).toBe(true);
      expect(dishes[tier]?.some((word) => name?.endsWith(` ${word}`))).toBe(true);
    }
  });
});
