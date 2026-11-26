/**
 * 12 § Work orders, Coffins for a tomb: while a tomb is short of coffins that stock cannot give (14's
 * `tombShortfalls`), one standing coffin order for it stands at the nearest workshop that makes
 * coffins without fuel, marked for the tomb (`forZoneId`). Looked at each day.
 */
import { C, type WorkOrder } from '@core/components';
import { PRIORITY_DEFAULT } from '@core/constants';
import type { EntityId } from '@core/types';
import type { BuildingsReader } from '@systems/buildings/reader';
import { applyOrderCommand } from './orders';
import type { RecipeRow, WorkshopOperator } from './operate';

/** The recipes that make the item a coffin building is placed from, burning no fuel, in table order. */
function coffinRecipes(op: WorkshopOperator, buildings: BuildingsReader): RecipeRow[] {
  const match = buildings.types().find((row) => row.tags.includes('coffin'))?.inputs[0]?.match;
  if (match === undefined) return [];
  const items = op.ctx.registry.table('items');
  const types = new Set(buildings.inputTypes(match));
  const out: RecipeRow[] = [];
  for (const type of [...op.byWorkshop.keys()].sort()) {
    for (const recipe of op.byWorkshop.get(type) ?? []) {
      if (!recipe.fuel && recipe.outputs.some((o) => items.has(o.item) && types.has(items.index(o.item)))) out.push(recipe);
    }
  }
  return out.sort((a, b) => op.recipeIndex(a.id) - op.recipeIndex(b.id));
}

/** The inputs of a recipe the stock cannot fill for one craft. */
function inputsLacking(op: WorkshopOperator, recipe: RecipeRow, order: WorkOrder): number {
  let lack = 0;
  for (const input of recipe.inputs) {
    const filter = op.inputFilter(recipe, input, order);
    if (filter === null || op.items.countAvailable(filter) < input.count) lack += 1;
  }
  return lack;
}

export function keepTombOrders(op: WorkshopOperator): void {
  const readers = op.ctx.readers;
  if (!readers.has('14') || !readers.has('13')) return;
  const buildings = readers.of<BuildingsReader>('14');
  const short = new Map(buildings.tombShortfalls().map((s) => [s.zoneId, s.short] as const));
  const entities = op.ctx.world.entities;
  const workshops = entities.with(C.Workshop);
  const kept = new Set<EntityId>();
  // The orders standing for a tomb: kept at its shortfall, or taken back when it is short of none.
  for (const id of workshops) {
    for (let i = (op.workshop(id)?.orders.length ?? 0) - 1; i >= 0; i -= 1) {
      const ws = op.workshop(id);
      const order = ws?.orders[i];
      if (ws === undefined || order?.forZoneId === undefined) continue;
      const need = short.get(order.forZoneId) ?? 0;
      if (need <= 0 || kept.has(order.forZoneId)) {
        applyOrderCommand(op, { type: 'RemoveWorkOrder', workshopId: id, index: i });
        continue;
      }
      kept.add(order.forZoneId);
      if (order.mode === 'once' && order.remaining !== need) {
        const orders = ws.orders.slice();
        orders[i] = { ...order, remaining: need };
        op.save(id, { ...ws, orders });
      }
    }
  }
  if ([...short.keys()].every((zoneId) => kept.has(zoneId))) return;
  const recipes = coffinRecipes(op, buildings);
  if (recipes.length === 0) return;
  const map = op.ctx.world.map;
  for (const [zoneId, need] of short) {
    if (kept.has(zoneId)) continue;
    const at = buildings.zone(zoneId)?.tiles[0];
    if (at === undefined) continue;
    // The nearest workshop whose coffin order could start now; else the order whose inputs the stock
    // comes nearest to giving (the fewest times short), the nearest first.
    let best: { id: EntityId; order: WorkOrder; runnable: boolean; lack: number; distance: number } | null = null;
    for (const id of workshops) {
      const ws = op.workshop(id);
      const b = entities.get(id, C.Building);
      if (ws === undefined || b === undefined || b.state !== 'built' || ws.suspended) continue;
      const type = op.typeOf(id);
      const distance = Math.abs(map.xOf(b.origin) - map.xOf(at)) + Math.abs(map.yOf(b.origin) - map.yOf(at)) + Math.abs(map.zOf(b.origin) - map.zOf(at));
      for (const recipe of recipes) {
        if (recipe.workshop !== type) continue;
        const order: WorkOrder = { recipe: op.recipeIndex(recipe.id) as WorkOrder['recipe'], remaining: need, mode: 'once', threshold: 0,
          priority: PRIORITY_DEFAULT as WorkOrder['priority'], materialFilter: null, forZoneId: zoneId };
        const runnable = op.problem(order, id) === null;
        const lack = runnable ? 0 : inputsLacking(op, recipe, order);
        if (best === null || (runnable && !best.runnable) || (runnable === best.runnable && (lack < best.lack ||
          (lack === best.lack && (distance < best.distance || (distance === best.distance && id < best.id)))))) {
          best = { id, order, runnable, lack, distance };
        }
        if (runnable) break;
      }
    }
    if (best === null) continue;
    const ws = op.workshop(best.id);
    if (ws === undefined) continue;
    op.save(best.id, { ...ws, orders: [...ws.orders, best.order] });
  }
}
