import { describe, expect, it } from 'vitest';
import type { TickContext } from '@core/system';
import type { Job, JobBoard } from '@systems/jobs';
import type { ItemsReader } from '@systems/items';
import type { WorkshopsReader, WorkshopsSystem } from '@systems/workshops';
import { TestWorld } from '../../scenarios/test-world';

const BAR_COSTS: Record<string, number> = {
  forge_anvil: 5, forge_arrows: 1, forge_barrel: 2, forge_battle_axe: 2, forge_bin: 2,
  forge_bolts: 1, forge_breastplate: 4, forge_bucket: 1, forge_buckler: 1, forge_cabinet: 2,
  forge_cage: 2, forge_chain: 1, forge_chair: 1, forge_chest: 2, forge_coffin: 3,
  forge_crafts: 1, forge_crossbow: 1, forge_dagger: 1, forge_door: 2, forge_floodgate: 2,
  forge_gauntlets: 1, forge_great_axe: 3, forge_greaves: 2, forge_hatch: 1, forge_helm: 1,
  forge_mace: 2, forge_mail_shirt: 3, forge_maul: 3, forge_metal_block: 1,
  forge_metal_boots: 1, forge_mug: 1, forge_pick: 2, forge_pike: 2, forge_shield: 2,
  forge_short_sword: 2, forge_spear: 1, forge_spikes: 1, forge_statue: 4, forge_table: 2,
  forge_warhammer: 2,
};

describe('T-M5-03 forge recipes, anvil, material filter and quality', () => {
  it('requires an anvil and three stone blocks for a forge build job', () => {
    const w = new TestWorld({ seed: 'm5-forge-build', world: 'flat-test', embark: 'none' });
    const result = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'forge', origin: w.index(15, 15, 32),
      orientation: 0 });
    expect(result).toEqual({ ok: true });
    w.step(1);
    const jobs = (w.game.world.services.jobs as JobBoard).jobs;
    const job = Array.from(jobs.values()).find((entry) => entry.key.startsWith('build:'));
    expect(job).toBeDefined();
    expect(job?.inputs.map((input) => ({ type: input.filter.types?.[0], count: input.count }))).toEqual([
      { type: w.game.registry.table('items').index('anvil'), count: 1 },
      { type: w.game.registry.table('items').index('stone_block'), count: 3 },
    ]);
  });

  it('restricts steel orders to steel bars, keeps wooden handles eligible, and limits anvils to iron or steel', () => {
    const w = new TestWorld({ seed: 'm5-forge-filter', world: 'flat-test', embark: 'none' });
    const forge = w.build('forge', w.index(15, 15, 32));
    w.step(1);
    const system = w.game.world.scheduler.byId('12') as WorkshopsSystem;
    const reader = w.readers.of<WorkshopsReader>('12');
    const at = w.index(19, 17, 32);
    w.spawnItem('bar', 'iron', at, 2);
    w.spawnItem('log', 'oak', at);
    w.spawnItem('charcoal_bar', 'charcoal', at);
    const order = { recipe: system.operator.recipeIndex('forge_spear'), remaining: 1, mode: 'once' as const,
      threshold: 0, priority: 5 as const, materialFilter: 'steel' };
    const spear = reader.recipe('forge_spear')!;
    expect(system.operator.inputFilter(spear, spear.inputs[0]!, order)?.materialId).toBe(w.game.registry.table('materials').index('steel'));
    expect(system.operator.inputFilter(spear, spear.inputs[1]!, order)?.materialId).toBeUndefined();
    expect(system.operator.problem(order, forge)).toBe('waiting for bar');
    w.spawnItem('bar', 'steel', at);
    expect(system.operator.problem(order, forge)).toBeNull();
    const anvil = reader.recipe('forge_anvil')!;
    const allowed = system.operator.inputFilter(anvil, anvil.inputs[0]!, { ...order, materialFilter: null });
    expect(allowed?.materialIds?.map((id) => w.game.registry.table('materials').idOf(id))).toEqual(['iron', 'steel']);
  });

  it('executes all 40 recipes at the authored bar costs and gives weapons and armor crafted quality', () => {
    const w = new TestWorld({ seed: 'm5-forge-all', world: 'flat-test', embark: 'none' });
    const at = w.index(15, 15, 32);
    const forge = w.build('forge', at);
    const worker = w.spawnDwarf({ at: w.index(18, 17, 32), skills: { weaponsmithing: 20, armorsmithing: 20, metalcrafting: 20 } });
    w.step(1);
    const system = w.game.world.scheduler.byId('12') as WorkshopsSystem;
    const recipes = w.readers.of<WorkshopsReader>('12').recipesFor('forge');
    expect(recipes).toHaveLength(40);
    expect(Object.keys(BAR_COSTS)).toHaveLength(40);
    const items = w.readers.of<ItemsReader>('13');
    const events: { type: string; itemId?: number; recipeId?: string }[] = [];
    const ctx = { world: w.game.world, registry: w.game.registry, spawn: w.game.world.services.spawn,
      emit: (event: { type: string; itemId?: number; recipeId?: string }) => events.push(event) } as unknown as TickContext;
    for (const recipe of recipes) {
      expect(recipe.inputs.find((input) => input.match === 'bar')?.count, recipe.id).toBe(BAR_COSTS[recipe.id]);
      expect(recipe.fuel, recipe.id).toBe(true);
      expect(recipe.quality, recipe.id).toBe(true);
      const inputs = recipe.inputs.map((input) => {
        const item = w.spawnItem(input.match, input.match === 'bar' ? 'steel' : 'oak', at, input.count);
        return { filter: {}, count: input.count, reserved: [item], delivered: [item] };
      });
      const fuel = w.spawnItem('charcoal_bar', 'charcoal', at);
      inputs.push({ filter: {}, count: 1, reserved: [fuel], delivered: [fuel] });
      system.operator.producer().onComplete?.({ id: 0, workerId: worker, target: { kind: 'building', ref: forge },
        inputs, data: { recipe: recipe.id, orderIndex: 0, globalOrder: false } } as unknown as Job, ctx);
      for (const input of inputs) for (const id of input.delivered) expect(items.get(id), recipe.id).toBeUndefined();
      const event = events.find((e) => e.type === 'ItemCrafted' && e.recipeId === recipe.id);
      const output = items.get(event?.itemId ?? 0);
      const expected = recipe.outputs[0]!;
      const itemRow = w.game.registry.table<{ id: string; tags?: readonly string[] }>('items').byIndex(output?.type ?? 0);
      expect(itemRow?.id === expected.item || itemRow?.tags?.includes(expected.item) === true, recipe.id).toBe(true);
      expect(output?.material, recipe.id).toBe(w.game.registry.table('materials').index('steel'));
      expect(output?.count, recipe.id).toBe(expected.count);
      expect(output?.quality, recipe.id).toBeGreaterThanOrEqual(4);
      expect(output?.crafterId, recipe.id).toBe(worker);
    }
  });
});
