/**
 * T-604: the three-year script answers the Thane's whim from the first day, before its Making Do strand
 * starts (the year-one whims were missed on nearly every seed): while a whim of fine meals stands, the
 * kitchen's fine meals go first and it keeps enough of them; while a whim of spirits stands, one batch
 * goes ahead of the still's brew. Nothing else of the strand is placed or ordered before its day.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import type { TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { setupThreeYearsFortress, threeYearsWorld } from '../scenarios/three_years_fortress';
import { checkMakingDo, makingDo, MAKING_DO_FROM_DAY } from '../scenarios/three_years_making_do';
import { command } from '../scenarios/script-commands';

describe('T-604 the three-year script answers the Thane in its first year', () => {
  it('fine meals first and a batch of spirits ahead of the brew while the whim stands, and nothing of the strand', () => {
    const w = threeYearsWorld('three-years-p0-1', 0);
    const state = setupThreeYearsFortress(w);
    const wagon = w.game.arrival!.wagon;
    const dwarves = w.game.world.scheduler.byId('10') as unknown as { whim: { id: string; setTick: number } | null };
    const recipes = w.game.registry.table('recipes');
    const orders = (id: number): { recipe: number; mode: string; threshold?: number }[] => w.game.world.entities.get(id, C.Workshop)?.orders ?? [];
    const b14 = w.readers.of<BuildingsReader>('14');
    const site = (type: string): TileIndex => {
      for (let r = 4; r < 30; r += 1) {
        for (let dy = -r; dy <= r; dy += 4) {
          for (let dx = -r; dx <= r; dx += 4) {
            const origin = w.index(wagon.x + dx, wagon.y + dy, wagon.z);
            if (b14.ghost(type, origin, 0).reason === null) return origin;
          }
        }
      }
      throw new Error(`no site for ${type}`);
    };
    const still = w.build('still', site('still'), 'oak');
    const kitchen = w.build('kitchen', site('kitchen'), 'oak');
    state.placedIds['still'] = still;
    state.placedIds['kitchen'] = kitchen;
    w.step(1);
    // The script's own orders, as it gives them when the two are built.
    command(w, { type: 'AddWorkOrder', workshopId: still, order: { recipeId: 'brew', mode: 'maintain', threshold: 80, priority: 4 } });
    command(w, { type: 'AddWorkOrder', workshopId: kitchen, order: { recipeId: 'cook_easy_meal', mode: 'maintain', threshold: 20, priority: 5 } });
    command(w, { type: 'AddWorkOrder', workshopId: kitchen, order: { recipeId: 'cook_fine_meal', mode: 'maintain', threshold: 10, priority: 5 } });
    const day = 60;
    expect(day).toBeLessThan(MAKING_DO_FROM_DAY);

    dwarves.whim = { id: 'whim_fine_meal', setTick: w.tick };
    checkMakingDo(w, state, day);
    expect(orders(kitchen)[0]).toMatchObject({ recipe: recipes.index('cook_fine_meal'), threshold: 25 });

    dwarves.whim = { id: 'whim_spirits', setTick: w.tick };
    checkMakingDo(w, state, day);
    expect(orders(kitchen).map((o) => [o.recipe, o.threshold])).toEqual([[recipes.index('cook_easy_meal'), 20], [recipes.index('cook_fine_meal'), 10]]);
    expect(orders(still).map((o) => [o.recipe, o.mode])).toEqual([[recipes.index('distill'), 'once'], [recipes.index('brew'), 'maintain']]);
    checkMakingDo(w, state, day);
    expect(orders(still).length).toBe(2);

    dwarves.whim = null;
    checkMakingDo(w, state, day);
    expect(orders(still).map((o) => o.recipe)).toEqual([recipes.index('brew')]);

    // The strand itself waits for its day.
    expect(makingDo(state)).toBe(false);
    for (const type of ['kiln', 'loom', 'clothier']) expect(state.placedIds[type], type).toBeUndefined();
    expect(b14.zonesOfType('compost')).toEqual([]);
  }, 120_000);
});
