/** `ui-screens/panels.md` §§ Orders and `12` § Player-facing behavior. */
import { C, type WorkOrder, type Workshop } from '@core/components';
import type { Command } from '@core/commands';
import type { EntityId } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { KeyPress } from '@platform/input';
import type { WorkshopsReader } from '@systems/workshops';
import type { JobsReader } from '@systems/jobs';
import { STANDING_ORDERS } from '@systems/jobs/constants';
import type { Surface } from '../surface';
import { label, list, separator, type ListState } from '../widgets';
import type { PanelContext } from './context';
import { dwarvesOf } from './units';

interface OrderEntry { workshopId: EntityId; index: number; order: WorkOrder }

export class OrdersPanel {
  readonly list: ListState = { selected: 0, scroll: 0 };
  readonly recipes: ListState = { selected: 0, scroll: 0 };
  adding = false;
  editing = false;
  readonly materials: ListState = { selected: 0, scroll: 0 };
  materialOpen = false;
  workshopId: EntityId = 0;

  reader(ctx: PanelContext): WorkshopsReader | null { return ctx.readers.has('12') ? ctx.readers.of<WorkshopsReader>('12') : null; }
  entries(ctx: PanelContext): OrderEntry[] {
    const reader = this.reader(ctx);
    if (reader === null) return [];
    const indices = new Map<EntityId, number>();
    return reader.allOrders().filter(({ workshopId }) => this.workshopId === 0 || workshopId === this.workshopId).map(({ workshopId, order }) => {
      const index = indices.get(workshopId) ?? 0;
      indices.set(workshopId, index + 1);
      return { workshopId, index, order };
    });
  }
  selected(ctx: PanelContext): OrderEntry | undefined { return this.entries(ctx)[this.list.selected]; }
  recipesFor(ctx: PanelContext): { id: string; name: string; workshop: string }[] {
    const reader = this.reader(ctx);
    if (reader === null) return [];
    const type = this.workshopId === 0 ? '' : ctx.readers.of<import('@systems/buildings').BuildingsReader>('14').get(this.workshopId)?.typeId ?? '';
    const ids = type === '' ? ctx.registry.table<{ id: string }>('recipes').ids() : reader.recipesFor(type).map((r) => r.id);
    return ids.map((id) => reader.recipe(id)).filter((r): r is NonNullable<typeof r> => r !== undefined && reader.recipesFor(r.workshop).some((allowed) => allowed.id === r.id));
  }
  move(delta: number, ctx: PanelContext): void {
    const state = this.adding ? this.recipes : this.list;
    const count = this.adding ? this.recipesFor(ctx).length : this.entries(ctx).length;
    state.selected = Math.max(0, Math.min(Math.max(0, count - 1), state.selected + delta));
  }
  add(ctx: PanelContext): Command | null {
    const recipe = this.recipesFor(ctx)[this.recipes.selected];
    if (recipe === undefined) return null;
    this.adding = false;
    return { type: 'AddWorkOrder', workshopId: this.workshopId, order: { recipeId: recipe.id, mode: 'once', remaining: 1, threshold: 0, priority: 5, materialFilter: null } };
  }
  remove(ctx: PanelContext): Command | null {
    const entry = this.selected(ctx);
    return entry === undefined ? null : { type: 'RemoveWorkOrder', workshopId: entry.workshopId, index: entry.index };
  }
  reorder(ctx: PanelContext, delta: number): Command | null {
    const entry = this.selected(ctx);
    if (entry === undefined) return null;
    const count = entry.workshopId === 0 ? this.reader(ctx)?.globalOrders().length ?? 0 : this.reader(ctx)?.ordersOf(entry.workshopId).length ?? 0;
    const to = entry.index + delta;
    if (to < 0 || to >= count) return null;
    this.list.selected += delta;
    return { type: 'ReorderWorkOrder', workshopId: entry.workshopId, from: entry.index, to };
  }
  patch(ctx: PanelContext, patch: Record<string, unknown>): Command | null {
    const entry = this.selected(ctx);
    return entry === undefined ? null : { type: 'EditWorkOrder', workshopId: entry.workshopId, index: entry.index, patch };
  }
  nextWorker(ctx: PanelContext, id: EntityId): Command | null {
    const ws = ctx.readers.entities.get(id, C.Workshop);
    const building = ctx.readers.of<import('@systems/buildings').BuildingsReader>('14').get(id);
    const reader = this.reader(ctx);
    if (ws === undefined || building === undefined || reader === null) return null;
    const jobs = ctx.readers.of<JobsReader>('11');
    const skills = ctx.registry.table<{ id: string; labor: string | null }>('skills');
    const labors = reader.recipesFor(building.typeId).map((recipe) => skills.byId(recipe.skill)?.labor).filter((labor): labor is string => typeof labor === 'string');
    const candidates = [0, ...dwarvesOf(ctx).filter((dwarf) => labors.some((labor) => jobs.laborEnabled(dwarf, labor)))];
    const at = candidates.indexOf(ws.assignedWorker);
    return { type: 'SetWorkshopWorker', workshopId: id, dwarfId: candidates[(at + 1) % candidates.length] ?? 0 };
  }
  materialOptions(ctx: PanelContext): { id: string; name: string }[] {
    const entry = this.selected(ctx);
    if (entry === undefined) return [];
    const recipe = this.reader(ctx)?.recipe(entry.order.recipe);
    if (recipe === undefined) return [];
    const brew = recipe.outputs.some((output) => 'plantDrink' in output.material);
    if (brew) return [{ id: '', name: 'any' }, ...ctx.registry.table<{ id: string; name: string; brew?: string }>('plants').rows.filter((plant) => plant.brew !== undefined).map((plant) => ({ id: plant.id, name: plant.name }))];
    const itemTypes = ctx.registry.table<{ id: string; materials: string[] | 'any' }>('items');
    const classes = new Set<string>();
    for (const input of recipe.inputs) {
      if (input.material === 'fuel' || input.material === 'flux') continue;
      const item = itemTypes.byId(input.match);
      if (item !== undefined && item.materials !== 'any') for (const materialClass of item.materials) classes.add(materialClass);
      else if (ctx.registry.table<{ id: string; class: string }>('materials').rows.some((m) => m.class === input.match)) classes.add(input.match);
    }
    if (classes.size === 0) for (const output of recipe.outputs) {
      const item = itemTypes.byId(output.item);
      if (item !== undefined && item.materials !== 'any') for (const materialClass of item.materials) classes.add(materialClass);
    }
    const materials = ctx.registry.table<{ id: string; name: string; class: string }>('materials').rows;
    return [{ id: '', name: 'any' }, ...Array.from(classes).sort().map((id) => ({ id, name: `${id} (class)` })), ...materials.filter((m) => classes.has(m.class)).map((m) => ({ id: m.id, name: m.name }))];
  }
  openMaterials(ctx: PanelContext): void {
    const options = this.materialOptions(ctx);
    if (options.length === 0) return;
    const current = this.selected(ctx)?.order.materialFilter;
    this.materials.selected = Math.max(0, options.findIndex((option) => option.id === (current ?? '')));
    this.materialOpen = true;
  }
  materialKey(ctx: PanelContext, key: KeyPress): Command | 'handled' | null {
    if (!this.materialOpen) return null;
    const options = this.materialOptions(ctx);
    if (key.key === 'Escape' || key.key === 'Esc') { this.materialOpen = false; return 'handled'; }
    if (key.key === 'ArrowUp' || key.key === '↑') { this.materials.selected = Math.max(0, this.materials.selected - 1); return 'handled'; }
    if (key.key === 'ArrowDown' || key.key === '↓') { this.materials.selected = Math.min(options.length - 1, this.materials.selected + 1); return 'handled'; }
    if (key.key !== 'Enter') return 'handled';
    const option = options[this.materials.selected];
    this.materialOpen = false;
    return option === undefined ? 'handled' : this.patch(ctx, { materialFilter: option.id === '' ? null : option.id });
  }
}

export function drawOrdersPanel(s: Surface, rect: Rect, panel: OrdersPanel, ctx: PanelContext): void {
  const reader = panel.reader(ctx);
  if (reader === null) return;
  const width = rect.cols - 2;
  const col = rect.col + 1;
  if (panel.adding) {
    label(s, col, rect.row, `New ${panel.workshopId === 0 ? 'global' : 'workshop'} order`, { fg: s.theme.key, width });
    const recipes = panel.recipesFor(ctx);
    list(s, { col, row: rect.row + 1, cols: width, rows: Math.max(1, rect.rows - 3) }, recipes.map((r) => `${r.name} (${r.workshop})`), panel.recipes, (i) => { panel.recipes.selected = i; const cmd = panel.add(ctx); if (cmd !== null) ctx.submit(cmd); });
    label(s, col, rect.row + rect.rows - 1, '[Enter] add  [Esc] back', { width });
    return;
  }
  if (panel.materialOpen) {
    label(s, col, rect.row, 'Material filter [▼]', { fg: s.theme.key, width });
    const options = panel.materialOptions(ctx);
    list(s, { col, row: rect.row + 1, cols: width, rows: Math.max(1, rect.rows - 3) }, options.map((option) => option.name), panel.materials, (i) => {
      panel.materials.selected = i;
      const option = options[i];
      panel.materialOpen = false;
      if (option !== undefined) { const cmd = panel.patch(ctx, { materialFilter: option.id === '' ? null : option.id }); if (cmd !== null) ctx.submit(cmd); }
    });
    label(s, col, rect.row + rect.rows - 1, '[Enter] choose  [Esc] back', { width });
    return;
  }
  label(s, col, rect.row, '[+] new global order', { fg: s.theme.key, width });
  s.hit({ col, row: rect.row, cols: width, rows: 1 }, () => { panel.workshopId = 0; panel.adding = true; panel.recipes.selected = 0; });
  const entries = panel.entries(ctx);
  const lines = entries.map((e) => {
    const recipe = reader.recipe(e.order.recipe);
    const place = e.workshopId === 0 ? 'Global' : `${ctx.readers.of<import('@systems/buildings').BuildingsReader>('14').get(e.workshopId)?.typeId ?? 'Workshop'} #${e.workshopId}`;
    const qty = e.order.mode === 'maintain' ? `keep ≥ ${e.order.threshold}` : `×${e.order.remaining}`;
    return `${place} ${recipe?.name ?? '?'} ${qty} pri ${e.order.priority}`;
  });
  const height = Math.max(1, rect.rows - 9);
  list(s, { col, row: rect.row + 1, cols: width, rows: height }, lines, panel.list, (i) => { panel.list.selected = i; });
  let row = rect.row + 1 + height;
  separator(s, col, row, width); row += 1;
  label(s, col, row, '[Enter] edit [x] remove [↑↓] reorder', { width }); row += 1;
  const entry = panel.selected(ctx);
  if (entry !== undefined) {
    label(s, col, row, `[m] ${entry.order.mode}  threshold ${entry.order.threshold}`, { fg: panel.editing ? s.theme.value : s.theme.text, width }); row += 1;
    label(s, col, row, `[+/-] ${panel.editing ? 'threshold' : 'count'}  [p] priority`, { width }); row += 1;
    label(s, col, row, `[f] Material: ${entry.order.materialFilter ?? 'any'} ▼`, { width });
    s.hit({ col, row, cols: width, rows: 1 }, () => panel.openMaterials(ctx)); row += 1;
  }
  separator(s, col, row, width, 'Standing orders'); row += 1;
  const standing = ctx.readers.has('11') ? ctx.readers.of<import('@systems/jobs').JobsReader>('11') : null;
  for (const name of STANDING_ORDERS) {
    if (row >= rect.row + rect.rows) break;
    label(s, col, row, `[${standing?.standingOrder(name) ? '■' : '□'}] ${name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^auto /, '')}`, { width });
    s.hit({ col, row, cols: width, rows: 1 }, () => ctx.submit({ type: 'SetStandingOrder', name, on: !standing?.standingOrder(name) }));
    row += 1;
  }
}

export function drawWorkshopPanel(s: Surface, rect: Rect, id: EntityId, panel: OrdersPanel, ctx: PanelContext): void {
  const reader = panel.reader(ctx);
  const building = ctx.readers.of<import('@systems/buildings').BuildingsReader>('14').get(id);
  const workshop = ctx.readers.entities.get(id, C.Workshop) as Workshop | undefined;
  if (reader === null || building === undefined || workshop === undefined) return;
  const col = rect.col + 1; const width = rect.cols - 2;
  label(s, col, rect.row, `${building.typeId} #${id}`, { fg: s.theme.key, width });
  label(s, col, rect.row + 1, `Worker: ${workshop.assignedWorker === 0 ? 'any' : ctx.readers.entities.get(workshop.assignedWorker, C.Creature)?.name ?? '?'}`, { width });
  label(s, col, rect.row + 2, `[s] ${workshop.suspended ? 'resume' : 'suspend'}  ${reader.isMagmaPowered(id) ? 'magma powered' : ''}`, { width });
  separator(s, col, rect.row + 3, width, 'Recipes');
  const recipes = reader.recipesFor(building.typeId);
  for (let k = 0; k < recipes.length && k < rect.rows - 14; k += 1) {
    const recipe = recipes[k] as typeof recipes[number];
    const can = reader.isRunnable(recipe.id, id).runnable;
    label(s, col, rect.row + 4 + k, `${can ? '●' : '○'} ${recipe.name}`, { fg: can ? s.theme.good : s.theme.dim, width });
  }
  const orderRows = reader.ordersOf(id);
  separator(s, col, rect.row + rect.rows - 8, width, `Orders (${orderRows.length})`);
  for (let k = 0; k < Math.min(3, orderRows.length); k += 1) {
    const order = orderRows[k] as WorkOrder;
    const recipe = reader.recipe(order.recipe);
    const amount = order.mode === 'maintain' ? `keep ${order.threshold}` : `×${order.remaining}`;
    label(s, col, rect.row + rect.rows - 7 + k, `${recipe?.name ?? '?'} ${amount} ${order.materialFilter ?? 'any'} p${order.priority}`, { width });
  }
  label(s, col, rect.row + rect.rows - 4, '[o] orders  [f] material filter', { width });
  label(s, col, rect.row + rect.rows - 3, `[+] new order  [w] worker`, { width });
  label(s, col, rect.row + rect.rows - 2, workshop.lastBlockedReason ?? '', { fg: s.theme.dim, width });
}
