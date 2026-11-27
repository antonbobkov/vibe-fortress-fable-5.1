import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { jobXp } from '@systems/dwarves/rules/skills';
import { TestWorld } from '../../scenarios/test-world';

interface RecipeRowLike { id: string; xp: number; outputs: readonly { item: string; count: number }[] }

describe('T-812 a stone craft trains the crafter as three crafts do', () => {
  it('craft_stone gives 24 experience a job, 8 for each of its three crafts', () => {
    const w = new TestWorld({ seed: 't812-xp-row', world: 'flat-test', embark: 'none' });
    const row = w.game.registry.table<RecipeRowLike>('recipes').byId('craft_stone') as RecipeRowLike;
    expect(row.outputs[0]?.count).toBe(3);
    expect(row.xp).toBe(24);
  });

  it('one stone craft job raises the crafter by the recipe experience, after Wits', () => {
    const w = new TestWorld({ seed: 't812-xp-job', world: 'flat-test', embark: 'none' });
    const shop = w.build('craftdwarf', w.index(12, 12, 32));
    const crafter = w.spawnDwarf({ at: w.index(16, 14, 32), skills: { crafting: 0 } });
    w.spawnItem('raw_stone', 'granite', w.index(18, 14, 32));
    w.step(1);
    const crafting = w.game.registry.table('skills').index('crafting');
    const before = w.game.world.entities.get(crafter, C.Skills)?.xp[crafting] ?? 0;
    expect(w.game.world.applyCommand({ type: 'SetWorkshopWorker', workshopId: shop, dwarfId: crafter })).toEqual({ ok: true });
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: shop,
      order: { recipeId: 'craft_stone', remaining: 1, mode: 'once' } })).toEqual({ ok: true });
    w.until(() => w.events('ItemCrafted').length >= 1, 20000);
    const wit = w.game.world.entities.get(crafter, C.Attributes)?.wit ?? 0;
    const after = w.game.world.entities.get(crafter, C.Skills)?.xp[crafting] ?? 0;
    expect(after - before).toBe(jobXp(24, wit));
    // A crafter of average Wits (50) gains 24 a stone: about 204 stones from level 5 to 13.
    expect(jobXp(24, 50)).toBe(24);
  });
});
