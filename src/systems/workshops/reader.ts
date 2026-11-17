import { C, type WorkOrder } from '@core/components';
import type { EntityId } from '@core/types';
import { outputFilter, type WorkshopOperator, type RecipeRow } from './operate';
import { civilianProfession, militaryTitle } from './professions';
import { mealName } from './meals';

export interface WorkshopsReader {
  ordersOf(id: EntityId): readonly WorkOrder[];
  allOrders(): readonly { workshopId: EntityId; order: WorkOrder }[];
  globalOrders(): readonly WorkOrder[];
  recipe(id: string | number): RecipeRow | undefined;
  recipesFor(workshopType: string): readonly RecipeRow[];
  isRunnable(recipeId: string, workshopId: EntityId): { runnable: boolean; reason: string | null };
  professionOf(id: EntityId): string;
  militaryTitle(id: EntityId): string;
  /**
   * The stock a `maintain` order compares with its threshold, as the operator counts it (12 § Work
   * orders): its recipe's first output type, of the order's material filter, or of a drink's fixed material.
   */
  orderStock(order: WorkOrder): number;
  isMagmaPowered(id: EntityId): boolean;
  mealName(itemId: EntityId): string | null;
}

export function makeReader(op: WorkshopOperator): WorkshopsReader {
  const entities = op.ctx.world.entities;
  const registry = op.ctx.registry;
  return {
    ordersOf: (id) => op.workshop(id)?.orders.map((o) => ({ ...o })) ?? [],
    allOrders: () => [
      ...entities.with(C.Workshop).flatMap((id) => (op.workshop(id)?.orders ?? []).map((order) => ({ workshopId: id, order: { ...order } }))),
      ...op.globalOrders.map((order) => ({ workshopId: 0, order: { ...order } })),
    ],
    globalOrders: () => op.globalOrders.map((o) => ({ ...o })),
    recipe: (id) => op.recipe(id),
    recipesFor: (type) => op.recipesForType(type),
    isRunnable: (recipeId, workshopId) => {
      const recipe = op.recipe(recipeId);
      if (recipe === undefined) return { runnable: false, reason: 'not_found' };
      const order: WorkOrder = { recipe: op.recipeIndex(recipeId), remaining: 1, mode: 'once', threshold: 0, priority: 5, materialFilter: null };
      const reason = op.problem(order, workshopId);
      return { runnable: reason === null, reason };
    },
    professionOf: (id) => {
      if (entities.get(id, C.Soldier)?.onDuty) return militaryTitle(entities, registry, id);
      return civilianProfession(entities, registry, id);
    },
    militaryTitle: (id) => militaryTitle(entities, registry, id),
    orderStock: (order) => {
      const recipe = op.recipe(order.recipe);
      return recipe === undefined ? 0 : op.items.countAvailable(outputFilter(registry, recipe, order));
    },
    isMagmaPowered: (id) => op.isMagmaPowered(id),
    mealName: (id) => mealName(entities, registry, id),
  };
}
