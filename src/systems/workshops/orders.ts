import { C, type WorkOrder } from '@core/components';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import { PRIORITY_MAX, PRIORITY_MIN } from '@core/constants';
import type { EntityId } from '@core/types';
import type { JobBoard } from '@systems/jobs';
import type { WorkshopOperator } from './operate';
import { M4_RECIPE_WORKSHOPS } from './constants';

/** `12` § Work orders; `command-catalog.md` workshop commands. */
export function applyOrderCommand(op: WorkshopOperator, cmd: Command): CommandResult {
  const id = cmd['workshopId'] as EntityId;
  const global = id === 0;
  const ws = global ? undefined : op.workshop(id);
  if (!global && ws === undefined) return reject('not_found');
  const orders = global ? op.globalOrders : (ws as NonNullable<typeof ws>).orders.slice();
  const index = cmd['index'] as number;
  const board = op.ctx.world.services.jobs as JobBoard;
  const cancelCurrent = (): void => {
    if (global) {
      const job = board.byKey(`craft:global:${index}`);
      if (job !== undefined) board.cancel(job.id, 'order_changed');
    } else if ((ws as NonNullable<typeof ws>).currentJobId !== 0) {
      board.cancel((ws as NonNullable<typeof ws>).currentJobId, 'order_changed');
      op.save(id, { ...(ws as NonNullable<typeof ws>), currentJobId: 0 });
    }
  };
  if (cmd.type === 'AddWorkOrder') {
    const raw = cmd['order'] as Record<string, unknown> | undefined;
    if (raw === undefined || typeof raw !== 'object') return reject('precondition_failed');
    const recipeId = raw['recipeId'] ?? raw['recipe'];
    const recipe = op.recipe(recipeId as string | number);
    if (recipe === undefined || !M4_RECIPE_WORKSHOPS.has(recipe.workshop) || (!global && recipe.workshop !== op.typeOf(id))) return reject('precondition_failed');
    const order = parseOrder(op, raw, recipe.id);
    if (order === null) return reject('precondition_failed');
    orders.push(order);
  } else if (cmd.type === 'EditWorkOrder') {
    if (!Number.isInteger(index) || index < 0 || index >= orders.length) return reject('invalid_index');
    const patch = cmd['patch'] as Record<string, unknown> | undefined;
    if (patch === undefined || typeof patch !== 'object') return reject('precondition_failed');
    const before = orders[index] as WorkOrder;
    const recipe = op.recipe((patch['recipeId'] ?? patch['recipe'] ?? before.recipe) as string | number);
    if (recipe === undefined || !M4_RECIPE_WORKSHOPS.has(recipe.workshop) || (!global && recipe.workshop !== op.typeOf(id))) return reject('precondition_failed');
    const order = parseOrder(op, { ...before, ...patch }, recipe.id);
    if (order === null) return reject('precondition_failed');
    cancelCurrent();
    orders[index] = order;
  } else if (cmd.type === 'RemoveWorkOrder') {
    if (!Number.isInteger(index) || index < 0 || index >= orders.length) return reject('invalid_index');
    cancelCurrent();
    orders.splice(index, 1);
  } else if (cmd.type === 'ReorderWorkOrder') {
    const from = (cmd['from'] ?? index) as number;
    const to = cmd['to'] as number;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= orders.length || to < 0 || to >= orders.length) return reject('invalid_index');
    cancelCurrent();
    const order = orders.splice(from, 1)[0] as WorkOrder;
    orders.splice(to, 0, order);
  } else return reject('not_found');
  if (global) op.globalOrders.splice(0, op.globalOrders.length, ...orders);
  else op.save(id, { ...(op.workshop(id) as NonNullable<typeof ws>), orders });
  return OK;
}

function parseOrder(op: WorkshopOperator, raw: Record<string, unknown>, recipeId: string): WorkOrder | null {
  const mode = raw['mode'] ?? 'once';
  const remaining = raw['remaining'] ?? raw['count'] ?? 1;
  const threshold = raw['threshold'] ?? 0;
  const priority = raw['priority'] ?? 5;
  if (mode !== 'once' && mode !== 'maintain') return null;
  if (!Number.isInteger(remaining) || (remaining as number) < 1 || (remaining as number) > 999) return null;
  if (!Number.isInteger(threshold) || (mode === 'maintain' && ((threshold as number) < 1 || (threshold as number) > 999))) return null;
  if (!Number.isInteger(priority) || (priority as number) < PRIORITY_MIN || (priority as number) > PRIORITY_MAX) return null;
  const filter = raw['materialFilter'] ?? null;
  if (filter !== null && typeof filter !== 'string' && typeof filter !== 'number') return null;
  return { recipe: op.recipeIndex(recipeId), remaining: remaining as number, mode, threshold: threshold as number,
    priority: priority as WorkOrder['priority'], materialFilter: filter as WorkOrder['materialFilter'] };
}

export function applyWorkerCommand(op: WorkshopOperator, cmd: Command): CommandResult {
  const id = cmd['workshopId'] as EntityId;
  const ws = op.workshop(id);
  if (ws === undefined) return reject('not_found');
  if (cmd.type === 'SuspendWorkshop') {
    if (typeof cmd['on'] !== 'boolean') return reject('precondition_failed');
    if (cmd['on'] && ws.currentJobId !== 0) (op.ctx.world.services.jobs as JobBoard).cancel(ws.currentJobId, 'workshop_suspended');
    op.save(id, { ...ws, suspended: cmd['on'], currentJobId: cmd['on'] ? 0 : ws.currentJobId });
    return OK;
  }
  if (cmd.type === 'SetWorkshopWorker') {
    const dwarf = cmd['dwarfId'] as EntityId;
    if (typeof dwarf !== 'number') return reject('precondition_failed');
    if (dwarf !== 0) {
      const entities = op.ctx.world.entities;
      if (!entities.alive(dwarf) || entities.get(dwarf, C.Creature)?.faction !== 'fortress') return reject('not_found');
      const board = op.ctx.world.services.jobs as JobBoard;
      const skills = op.ctx.registry.table<{ id: string; labor: string | null }>('skills');
      const labors = op.byWorkshop.get(op.typeOf(id))?.map((recipe) => skills.byId(recipe.skill)?.labor).filter((labor): labor is string => typeof labor === 'string') ?? [];
      if (!labors.some((labor) => board.laborEnabled(dwarf, board.laborOf(labor)))) return reject('no_labor');
    }
    if (ws.currentJobId !== 0) (op.ctx.world.services.jobs as JobBoard).cancel(ws.currentJobId, 'worker_changed');
    op.save(id, { ...ws, assignedWorker: dwarf, currentJobId: 0 });
    return OK;
  }
  return reject('not_found');
}
