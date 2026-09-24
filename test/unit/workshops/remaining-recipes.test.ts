import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import type { TickContext } from '@core/system';
import type { Job } from '@systems/jobs';
import { resolveOutputMaterial, type RecipeRow, type WorkshopsReader, type WorkshopsSystem } from '@systems/workshops';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

const CRAFT_SHOPS = ['tannery', 'loom', 'clothier', 'leatherworks', 'bowyer'] as const;

function sourceMaterial(type: string, recipe: RecipeRow): string {
  if (type === 'raw_hide') return 'cow_hide';
  if (type === 'leather_piece') return 'leather';
  if (type === 'fiber') return 'flax_fiber';
  if (type === 'thread') return 'flax_thread';
  if (type === 'cloth') return recipe.id === 'make_cloak' ? 'wool_cloth' : 'flax_cloth';
  if (type === 'log') return recipe.id === 'make_bow' ? 'yew' : 'oak';
  return 'leather';
}

/** One world per workshop exercises every authored recipe; no world per row. */
function executeShop(workshopType: string): { world: TestWorld; products: Map<string, number[]> } {
  const w = new TestWorld({ seed: `m4-rest-${workshopType}`, world: 'flat-test', embark: 'none' });
  const at = w.index(15, 15, 32);
  const building = w.build(workshopType, at);
  const maker = w.spawnDwarf({ at: w.index(18, 16, 32) });
  w.step(1);
  const system = w.game.world.scheduler.byId('12') as WorkshopsSystem;
  const recipes = w.readers.of<WorkshopsReader>('12').recipesFor(workshopType);
  const items = w.readers.of<ItemsReader>('13');
  const itemTable = w.game.registry.table<{ id: string; tags?: readonly string[] }>('items');
  const materials = w.game.registry.table('materials');
  const products = new Map<string, number[]>();
  const ctx = { world: w.game.world, registry: w.game.registry, spawn: w.game.world.services.spawn,
    emit: (event: Parameters<typeof w.game.world.emit>[0]) => w.game.world.emit(event) } as unknown as TickContext;

  for (const recipe of recipes) {
    const inputMaterials: number[] = [];
    const inputs = recipe.inputs.map((input) => {
      const type = input.match;
      const material = input.material && input.material !== 'any' ? input.material : sourceMaterial(type, recipe);
      inputMaterials.push(materials.index(material));
      const delivered: number[] = [];
      for (let n = 0; n < input.count; n += 1) delivered.push(w.spawnItem(type, material, at));
      return { filter: {}, count: input.count, reserved: delivered.slice(), delivered };
    });
    const before = new Set(w.game.world.entities.with(C.Item));
    const job = { id: 0, workerId: maker, target: { kind: 'building', ref: building }, inputs,
      data: { recipe: recipe.id, orderIndex: 0, globalOrder: false } } as unknown as Job;
    system.operator.producer().onComplete?.(job, ctx);
    const made = w.game.world.entities.with(C.Item).filter((id) => !before.has(id));
    expect(made.length, recipe.id).toBe(recipe.outputs.length);
    for (let k = 0; k < recipe.outputs.length; k += 1) {
      const out = recipe.outputs[k]!;
      const rec = items.get(made[k]!)!;
      const type = itemTable.byIndex(rec.type)!;
      expect(type.id === out.item || type.tags?.includes(out.item) === true, recipe.id).toBe(true);
      expect(rec.count, recipe.id).toBe(out.count);
      expect(rec.material, recipe.id).toBe(resolveOutputMaterial(w.game.registry, out, inputMaterials));
      expect(rec.crafterId, recipe.id).toBe(maker);
      if (!recipe.quality) expect(rec.quality, recipe.id).toBe(1);
    }
    for (const input of inputs) for (const id of input.delivered) expect(items.get(id), recipe.id).toBeUndefined();
    products.set(recipe.id, made);
  }
  return { world: w, products };
}

describe('T-M4-10 remaining non-metal workshops', () => {
  for (const workshop of CRAFT_SHOPS) {
    it(`executes every ${workshop} recipe with exact inputs, outputs and materials`, () => {
      const { world, products } = executeShop(workshop);
      const rows = world.game.registry.table<RecipeRow>('recipes').where(`workshop:${workshop}`, (r) => r.workshop === workshop);
      expect(products.size).toBe(rows.length);
    });
  }

  it('builds the butcher and kennel as workshops with no recipe rows', () => {
    const w = new TestWorld({ seed: 'm4-job-workshops', world: 'flat-test', embark: 'none' });
    const butcher = w.build('butcher', w.index(12, 12, 32));
    const kennel = w.build('kennel', w.index(22, 12, 32));
    w.step(1);
    const reader = w.readers.of<WorkshopsReader>('12');
    expect(w.game.world.entities.get(butcher, C.Workshop)).toBeDefined();
    expect(w.game.world.entities.get(kennel, C.Workshop)).toBeDefined();
    expect(reader.recipesFor('butcher')).toHaveLength(0);
    expect(reader.recipesFor('kennel')).toHaveLength(0);
  });

  it('D-128: exposes smelting only when T-M5-01 lands, keeping later workshops and recipes inactive', () => {
    const w = new TestWorld({ seed: 'm4-m5-recipe-seam', world: 'flat-test', embark: 'none' });
    const reader = w.readers.of<WorkshopsReader>('12');
    expect(reader.recipesFor('wood_furnace').map((r) => r.id)).toEqual(['make_charcoal']);
    expect(reader.recipesFor('smelter')).toHaveLength(16);
    for (const type of ['forge', 'mechanic', 'jeweler', 'magma_smelter', 'magma_forge']) {
      expect(reader.recipesFor(type), type).toHaveLength(0);
    }
    expect(reader.recipe('make_charcoal')).toBeDefined();
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: 0,
      order: { recipeId: 'make_charcoal', remaining: 1, mode: 'once' } })).toEqual({ ok: true });
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: 0,
      order: { recipeId: 'alloy_steel', remaining: 1, mode: 'once' } })).toEqual({ ok: false, reason: 'precondition_failed' });
  });

  it('tans a cow hide into leather, makes four bandages, and keeps yew bow power metadata', () => {
    const tanned = executeShop('tannery');
    const tanId = tanned.products.get('tan_hide')![0]!;
    expect(tanned.world.readers.of<ItemsReader>('13').get(tanId)?.material).toBe(tanned.world.game.registry.table('materials').index('leather'));
    const clothier = executeShop('clothier');
    const bandage = clothier.products.get('make_bandages')![0]!;
    expect(clothier.world.readers.of<ItemsReader>('13').get(bandage)?.count).toBe(4);
    const bowyer = executeShop('bowyer');
    const bow = bowyer.products.get('make_bow')![0]!;
    expect(bowyer.world.readers.of<ItemsReader>('13').get(bow)?.material).toBe(bowyer.world.game.registry.table('materials').index('yew'));
    const bowRow = bowyer.world.game.registry.table<{ id: string; launcher?: { yewPower?: number } }>('weapons').byId('bow');
    expect(bowRow?.launcher?.yewPower).toBe(1100);
  });

  it('spins flax and wool to matching thread, weaves matching cloth, and waits for two threads of one material', () => {
    const loom = executeShop('loom');
    const materials = loom.world.game.registry.table('materials');
    const items = loom.world.readers.of<ItemsReader>('13');
    expect(items.get(loom.products.get('spin_thread')![0]!)?.material).toBe(materials.index('flax_thread'));
    expect(items.get(loom.products.get('weave_cloth')![0]!)?.material).toBe(materials.index('flax_cloth'));

    const w = new TestWorld({ seed: 'm4-wool-thread', world: 'flat-test', embark: 'none' });
    const building = w.build('loom', w.index(12, 12, 32));
    w.step(1);
    const system = w.game.world.scheduler.byId('12') as WorkshopsSystem;
    const recipe = w.game.registry.table<RecipeRow>('recipes').byId('spin_thread')!;
    const order = { recipe: w.game.registry.table('recipes').index('spin_thread'), remaining: 1, mode: 'once' as const,
      threshold: 0, priority: 5 as const, materialFilter: null };
    w.spawnItem('wool_raw', 'wool', w.index(15, 14, 32));
    expect(system.operator.inputFilter(recipe, recipe.inputs[0]!, order)?.types).toContain(w.game.registry.table('items').index('wool_raw'));
    const before = new Set(w.game.world.entities.with(C.Item));
    const woolInput = w.game.world.entities.with(C.Item).find((id) => {
      const item = w.readers.of<ItemsReader>('13').get(id);
      return item?.type === w.game.registry.table('items').index('wool_raw');
    })!;
    const worker = w.spawnDwarf({ at: w.index(15, 16, 32) });
    const ctx = { world: w.game.world, registry: w.game.registry, spawn: w.game.world.services.spawn,
      emit: (event: Parameters<typeof w.game.world.emit>[0]) => w.game.world.emit(event) } as unknown as TickContext;
    system.operator.producer().onComplete?.({ id: 0, workerId: worker, target: { kind: 'building', ref: building },
      inputs: [{ filter: {}, count: 1, reserved: [woolInput], delivered: [woolInput] }],
      data: { recipe: 'spin_thread', orderIndex: 0, globalOrder: false } } as unknown as Job, ctx);
    const woolThread = w.game.world.entities.with(C.Item).find((id) => !before.has(id) &&
      w.readers.of<ItemsReader>('13').get(id)?.type === w.game.registry.table('items').index('thread'))!;
    expect(w.readers.of<ItemsReader>('13').get(woolThread)?.material).toBe(w.game.registry.table('materials').index('wool_thread'));
    w.game.world.services.items?.destroy(woolThread, 'fixture_reset');
    const thread = w.readers.of<WorkshopsReader>('12');
    w.spawnItem('thread', 'flax_thread', w.index(15, 14, 32));
    w.spawnItem('thread', 'wool_thread', w.index(15, 15, 32));
    expect(thread.isRunnable('weave_cloth', building).runnable).toBe(false);
    w.spawnItem('thread', 'flax_thread', w.index(16, 14, 32));
    expect(thread.isRunnable('weave_cloth', building)).toEqual({ runnable: true, reason: null });
    expect(system.operator.inputFilter(w.game.registry.table<RecipeRow>('recipes').byId('weave_cloth')!,
      w.game.registry.table<RecipeRow>('recipes').byId('weave_cloth')!.inputs[0]!, order)?.materialId).toBe(materials.index('flax_thread'));
  });

  it('rejects non-brewable plants and non-flour crops despite their broad item type', () => {
    const w = new TestWorld({ seed: 'm4-process-filters', world: 'flat-test', embark: 'none' });
    const still = w.build('still', w.index(12, 12, 32));
    const farmers = w.build('farmers_workshop', w.index(22, 12, 32));
    w.step(1);
    const reader = w.readers.of<WorkshopsReader>('12');
    w.spawnItem('plant_food', 'turnip', w.index(15, 14, 32), 4);
    w.spawnItem('barrel', 'oak', w.index(15, 15, 32));
    w.spawnItem('bag', 'flax_cloth', w.index(25, 14, 32));
    expect(reader.isRunnable('brew', still).runnable).toBe(false);
    expect(reader.isRunnable('mill_flour', farmers).runnable).toBe(false);
    w.spawnItem('plant_food', 'dimcap', w.index(16, 14, 32), 4);
    w.spawnItem('plant_food', 'barley', w.index(26, 14, 32), 2);
    expect(reader.isRunnable('brew', still).runnable).toBe(true);
    expect(reader.isRunnable('mill_flour', farmers).runnable).toBe(true);
  });
});
