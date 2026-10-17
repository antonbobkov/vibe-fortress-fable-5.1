/**
 * `ui-screens/panels.md` §§ Orders, Add order, Workshop and `12` § Player-facing behavior.
 *
 * Work orders have a quantity (`docs/archive/ui-fixes/README.md` D-U5): adding an order opens the
 * picker (type-ahead filter, recipes grouped by output category with the recent ones first,
 * quantity, `once N` / `keep ≥ N`, material, and for a global order the workshop); in the list
 * `+`/`-` change the selected order's count, `[S-n]` adds, `[r]` repeats, and every order shows
 * its status. The recent recipes and the finished orders are presentation state: never saved.
 */
import { C, type WorkOrder, type Workshop } from '@core/components';
import type { Command } from '@core/commands';
import { PRIORITY_DEFAULT, PRIORITY_MAX, PRIORITY_MIN } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { EntityId } from '@core/types';
import { workshopHasWork } from '@core/workshop-use';
import type { Rect } from '@render/cellbuffer';
import type { Rgb } from '@render/palette';
import type { KeyPress } from '@platform/input';
import type { BuildingsReader } from '@systems/buildings';
import type { RecipeRow, WorkshopsReader } from '@systems/workshops';
import type { JobsReader } from '@systems/jobs';
import { STANDING_ORDERS } from '@systems/jobs/constants';
import {
  ORDER_COUNT_BIG_STEP, ORDER_COUNT_MAX, ORDER_COUNT_MIN, ORDER_FINISHED_MAX, ORDER_KEEP_DEFAULT, ORDER_RECENT_MAX,
} from '../constants';
import { buildingName, capitalize, waitingFor, workshopBlockText, wrapText } from '../messages';
import type { Surface } from '../surface';
import { label, list, numberField, separator, textField, type ListState } from '../widgets';
import { accel, confirmThen, type PanelContext } from './context';
import { dwarvesOf } from './units';

export interface OrderEntry { workshopId: EntityId; index: number; order: WorkOrder }

/** A finished `once` order, kept as a `done` row so `[r]` can order it again. */
export interface FinishedOrder { workshopId: EntityId; recipeId: string; count: number; materialFilter: WorkOrder['materialFilter'] }

export type OrderRow = { readonly kind: 'live'; readonly entry: OrderEntry } | { readonly kind: 'done'; readonly done: FinishedOrder };

/** What an order is doing now: `short` for its list row, `long` for the selected order's lines. */
export interface OrderStatus {
  readonly kind: 'in_progress' | 'queued' | 'done' | 'stocked' | 'waiting' | 'fuel' | 'no_workshop' | 'suspended' | 'no_magma' | 'no_worker' | 'other';
  readonly short: string;
  readonly long: string;
}

export type PickerField = 'recipe' | 'quantity' | 'mode' | 'material' | 'where';

/** What the picker opens on (`[o] order N` of the build tool presets the item and the count, D-U6). */
export interface PickerPreset {
  /** The workshop the order is for; 0 or absent: a global order, with the workshop chosen in the picker. */
  readonly workshopId?: EntityId;
  readonly recipeId?: string;
  /** Select the first recipe that makes this item type. */
  readonly itemId?: string;
  readonly quantity?: number;
}

/** The "Add order" picker's state (`ui-screens/panels.md` § Add order). */
export class OrderPicker {
  open = false;
  /** The type-ahead filter: lower-case letters. */
  filter = '';
  /** `selected` counts recipes only; `scroll` counts drawn rows. */
  readonly list: ListState = { selected: 0, scroll: 0 };
  quantity = ORDER_COUNT_MIN;
  /** Digits are continuing the number just typed. */
  typing = false;
  /** The player typed a filter, moved the highlight or clicked a recipe, or the picker opened on a recipe: `Enter` may add it. */
  chosen = false;
  /** Rows of the recipe list as last drawn: what `PageUp` and `PageDown` move by. */
  height = 10;
  mode: WorkOrder['mode'] = 'once';
  /** The material filter's option id; `''` is any. */
  material = '';
  /** 0: any workshop of the recipe's type (a global order). */
  workshopId: EntityId = 0;
  /** Opened from a workshop: its recipes only, and the order is that workshop's. */
  fixed = false;
  field: PickerField = 'recipe';
}

type PickerRow = { readonly heading: string } | { readonly recipe: RecipeRow };

function clampCount(n: number): number {
  return Math.max(ORDER_COUNT_MIN, Math.min(ORDER_COUNT_MAX, n));
}

/** `+`/`=` and `-`/`_` as a count step, ±10 with `Shift` (D-U5); 0 for any other key. */
export function countStep(press: KeyPress): number {
  const up = press.key === '+' || press.key === '=';
  const down = press.key === '-' || press.key === '_';
  if (!up && !down) return 0;
  const size = press.shift || press.key === '_' ? ORDER_COUNT_BIG_STEP : 1;
  return up ? size : -size;
}

export class OrdersPanel {
  readonly list: ListState = { selected: 0, scroll: 0 };
  readonly picker = new OrderPicker();
  private readonly workshopLists = new Map<EntityId, ListState>();

  workshopList(id: EntityId): ListState {
    let state = this.workshopLists.get(id);
    if (state === undefined) { state = { selected: 0, scroll: 0 }; this.workshopLists.set(id, state); }
    return state;
  }
  readonly materials: ListState = { selected: 0, scroll: 0 };
  materialOpen = false;
  /** The workshop whose orders the list shows; 0: every order in the fortress. */
  workshopId: EntityId = 0;
  /** Recipe ids ordered through the picker, newest first. */
  recent: string[] = [];
  /** Finished once orders, newest first. */
  finished: FinishedOrder[] = [];
  /** What was asked for per workshop and recipe, oldest first, so a finished order repeats with its count. */
  private readonly placed = new Map<string, { count: number; materialFilter: WorkOrder['materialFilter'] }[]>();

  /** Remember an order this panel placed. */
  private ask(workshopId: EntityId, recipeId: string, count: number, materialFilter: WorkOrder['materialFilter']): void {
    const key = `${workshopId}:${recipeId}`;
    this.placed.set(key, [...(this.placed.get(key) ?? []), { count, materialFilter }]);
  }
  /** The count the newest order of a workshop and recipe was placed with, or 0. */
  private asked(workshopId: EntityId, recipeId: string): number {
    return this.placed.get(`${workshopId}:${recipeId}`)?.at(-1)?.count ?? 0;
  }

  /** The picker is open (the Esc chain closes it first). */
  get adding(): boolean { return this.picker.open; }

  reader(ctx: PanelContext): WorkshopsReader | null { return ctx.readers.has('12') ? ctx.readers.of<WorkshopsReader>('12') : null; }
  private buildings(ctx: PanelContext): BuildingsReader | null { return ctx.readers.has('14') ? ctx.readers.of<BuildingsReader>('14') : null; }

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

  /** The list's rows: the live orders, then the finished ones. */
  rows(ctx: PanelContext): OrderRow[] {
    const done = this.finished.filter((f) => this.workshopId === 0 || f.workshopId === this.workshopId);
    return [...this.entries(ctx).map((entry): OrderRow => ({ kind: 'live', entry })), ...done.map((d): OrderRow => ({ kind: 'done', done: d }))];
  }
  selectedRow(ctx: PanelContext): OrderRow | undefined { return this.rows(ctx)[this.list.selected]; }

  /** The live orders that have no job and why, as the Orders panel shows them (the Jobs panel's "Orders waiting"). */
  waiting(ctx: PanelContext): { readonly index: number; readonly text: string }[] {
    const out: { index: number; text: string }[] = [];
    this.rows(ctx).forEach((row, index) => {
      if (row.kind !== 'live') return;
      const kind = this.status(ctx, row).kind;
      if (kind === 'in_progress' || kind === 'queued' || kind === 'stocked' || kind === 'done') return;
      out.push({ index, text: this.rowText(ctx, row) });
    });
    return out;
  }
  /** The selected live order. */
  selected(ctx: PanelContext): OrderEntry | undefined {
    const row = this.selectedRow(ctx);
    return row?.kind === 'live' ? row.entry : undefined;
  }

  move(delta: number, ctx: PanelContext): void {
    if (this.picker.open) {
      const count = this.pickerRecipes(ctx).length;
      this.picker.list.selected = Math.max(0, Math.min(Math.max(0, count - 1), this.picker.list.selected + delta));
      if (delta !== 0) this.picker.chosen = true;
      this.syncWhere(ctx);
      return;
    }
    this.list.selected = Math.max(0, Math.min(Math.max(0, this.rows(ctx).length - 1), this.list.selected + delta));
  }

  // ---------- the picker ----------

  /** The built workshops of a type, by id. */
  workshopsOfType(ctx: PanelContext, type: string): EntityId[] {
    const b = this.buildings(ctx);
    if (b === null) return [];
    return (ctx.readers.entities.with(C.Workshop) as EntityId[]).filter((id) => b.get(id)?.typeId === type).sort((x, y) => x - y);
  }

  /** The recipes the picker offers: the workshop's own, or every recipe some workshop type runs. */
  private candidates(ctx: PanelContext): RecipeRow[] {
    const reader = this.reader(ctx);
    if (reader === null) return [];
    if (this.picker.fixed) {
      const type = this.buildings(ctx)?.get(this.picker.workshopId)?.typeId ?? '';
      return reader.recipesFor(type).slice();
    }
    return ctx.registry.table<{ id: string }>('recipes').ids().map((id) => reader.recipe(id))
      .filter((r): r is RecipeRow => r !== undefined && reader.recipesFor(r.workshop).some((allowed) => allowed.id === r.id));
  }

  /** A recipe's group: the top category of what it makes ("Furniture", "Food"). */
  private categoryOf(ctx: PanelContext, recipe: RecipeRow): string {
    const item = recipe.outputs[0]?.item;
    const category = item === undefined ? undefined : ctx.registry.table<{ id: string; category?: string }>('items').byId(item)?.category;
    const top = category?.split('/')[0];
    return top === undefined || top === '' ? ctx.strings.get('ui.orders.picker.other') : capitalize(top.replace(/_/g, ' '));
  }

  /** The picker's rows: "Recent" first, then one group per output category, the filter applied. */
  pickerRows(ctx: PanelContext): PickerRow[] {
    const needle = this.picker.filter;
    const matches = this.candidates(ctx).filter((r) => needle === '' || r.name.toLowerCase().replace(/[^a-z]/g, '').includes(needle));
    // Within a filter's matches: what a built workshop can make now, then what lacks an input, then what has no workshop.
    const all = needle === '' ? matches : matches.map((r, k) => ({ r, k, rank: this.rank(ctx, r) })).sort((a, b) => a.rank - b.rank || a.k - b.k).map((x) => x.r);
    return this.groupRecipes(ctx, all, this.recent);
  }

  /** Shared category headings and ordering for the picker and finished workshop. */
  groupRecipes(ctx: PanelContext, all: readonly RecipeRow[], recentIds: readonly string[] = []): PickerRow[] {
    const out: PickerRow[] = [];
    const recent = recentIds.map((id) => all.find((r) => r.id === id)).filter((r): r is RecipeRow => r !== undefined);
    if (recent.length > 0) {
      out.push({ heading: ctx.strings.get('ui.orders.picker.recent') });
      for (const recipe of recent) out.push({ recipe });
    }
    const groups = new Map<string, RecipeRow[]>();
    for (const recipe of all) {
      const category = this.categoryOf(ctx, recipe);
      const rows = groups.get(category) ?? [];
      rows.push(recipe);
      groups.set(category, rows);
    }
    for (const category of Array.from(groups.keys()).sort()) {
      out.push({ heading: category });
      for (const recipe of groups.get(category) as RecipeRow[]) out.push({ recipe });
    }
    return out;
  }
  pickerRecipes(ctx: PanelContext): RecipeRow[] {
    return this.pickerRows(ctx).flatMap((row) => ('recipe' in row ? [row.recipe] : []));
  }
  pickerRecipe(ctx: PanelContext): RecipeRow | undefined { return this.pickerRecipes(ctx)[this.picker.list.selected]; }

  /** 0: a built workshop can make it now; 1: its workshop exists but lacks an input; 2: no such workshop is built. */
  rank(ctx: PanelContext, recipe: RecipeRow): number {
    // The order must not depend on the workshop chosen in the picker, or choosing one would move the recipe.
    const reader = this.reader(ctx);
    const where = this.picker.fixed ? [this.picker.workshopId] : this.workshopsOfType(ctx, recipe.workshop);
    if (reader !== null && where.some((id) => reader.isRunnable(recipe.id, id).runnable)) return 0;
    return where.length > 0 ? 1 : 2;
  }

  /** Whether some workshop the order could go to can run the recipe now. */
  makeable(ctx: PanelContext, recipe: RecipeRow): boolean {
    const reader = this.reader(ctx);
    if (reader === null) return false;
    const where = this.picker.workshopId !== 0 ? [this.picker.workshopId] : this.workshopsOfType(ctx, recipe.workshop);
    return where.some((id) => reader.isRunnable(recipe.id, id).runnable);
  }

  /** Where the picked recipe's order can go: any workshop of its type (0), or one of them. */
  whereOptions(ctx: PanelContext): EntityId[] {
    if (this.picker.fixed) return [this.picker.workshopId];
    const recipe = this.pickerRecipe(ctx);
    return recipe === undefined ? [0] : [0, ...this.workshopsOfType(ctx, recipe.workshop)];
  }
  /** A workshop of another type cannot take the picked recipe: back to "any". */
  private syncWhere(ctx: PanelContext): void {
    if (!this.picker.fixed && !this.whereOptions(ctx).includes(this.picker.workshopId)) this.picker.workshopId = 0;
    const recipe = this.pickerRecipe(ctx);
    if (recipe === undefined || !this.materialOptions(ctx, recipe).some((option) => option.id === this.picker.material)) this.picker.material = '';
  }
  whereName(ctx: PanelContext, workshopId: EntityId, recipe: RecipeRow | undefined): string {
    if (workshopId !== 0) return buildingName(ctx, workshopId);
    const type = recipe === undefined ? undefined : ctx.registry.table<{ id: string; name: string }>('buildings').byId(recipe.workshop)?.name;
    return type === undefined ? ctx.strings.get('ui.orders.group.global') : ctx.strings.get('ui.orders.picker.any_workshop', { workshop: type });
  }

  /** Open the picker for a workshop's order, or (workshop 0) a global one. */
  openPicker(ctx: PanelContext, preset: PickerPreset = {}): void {
    const p = this.picker;
    p.open = true;
    p.filter = '';
    p.list.selected = 0;
    p.list.scroll = 0;
    p.quantity = clampCount(preset.quantity ?? ORDER_COUNT_MIN);
    p.typing = false;
    p.chosen = preset.recipeId !== undefined || preset.itemId !== undefined;
    p.mode = 'once';
    p.material = '';
    p.workshopId = preset.workshopId ?? 0;
    p.fixed = p.workshopId !== 0;
    p.field = 'recipe';
    this.materialOpen = false;
    const recipes = this.pickerRecipes(ctx);
    // A preset recipe is selected in its own group, past the "Recent" copies.
    const from = this.recent.filter((id) => recipes.some((r) => r.id === id)).length;
    const wanted = (r: RecipeRow): boolean => (preset.recipeId !== undefined ? r.id === preset.recipeId : preset.itemId !== undefined && r.outputs.some((o) => o.item === preset.itemId));
    const at = recipes.findIndex((r, k) => k >= from && wanted(r));
    if (at >= 0) p.list.selected = at;
  }

  private pickerFields(): PickerField[] {
    return this.picker.fixed ? ['recipe', 'quantity', 'mode', 'material'] : ['recipe', 'quantity', 'mode', 'material', 'where'];
  }

  /** Change the focused field (`←`/`→`, or a click on it). */
  pickerAdjust(ctx: PanelContext, field: PickerField, delta: number): void {
    const p = this.picker;
    p.typing = false;
    if (field === 'quantity') p.quantity = clampCount(p.quantity + delta);
    else if (field === 'mode') p.mode = p.mode === 'once' ? 'maintain' : 'once';
    else if (field === 'material') {
      const recipe = this.pickerRecipe(ctx);
      const options = recipe === undefined ? [] : this.materialOptions(ctx, recipe);
      if (options.length === 0) return;
      const at = Math.max(0, options.findIndex((option) => option.id === p.material));
      p.material = (options[(at + delta + options.length) % options.length] as { id: string }).id;
    } else if (field === 'where') {
      const options = this.whereOptions(ctx);
      const at = Math.max(0, options.indexOf(p.workshopId));
      p.workshopId = options[(at + delta + options.length) % options.length] ?? 0;
    }
  }

  /** The picker's keys. Returns false for a key it leaves to the screen (`Space`, `F5`…). */
  pickerKey(ctx: PanelContext, press: KeyPress): boolean {
    if (press.ctrl || press.alt || press.meta) return false;
    const p = this.picker;
    const k = press.key;
    const digit = /^[0-9]$/.test(k);
    const typing = p.typing;
    p.typing = false;
    if (k === 'Esc' || k === 'Escape') { p.open = false; return true; }
    if (k === 'Enter') { this.pickerAdd(ctx); return true; }
    if (k === 'Tab') {
      const fields = this.pickerFields();
      const at = fields.indexOf(p.field);
      p.field = fields[(at + (press.shift ? -1 : 1) + fields.length) % fields.length] as PickerField;
      return true;
    }
    if (k === 'ArrowUp' || k === '↑' || k === 'ArrowDown' || k === '↓') { this.move(k === 'ArrowUp' || k === '↑' ? -1 : 1, ctx); return true; }
    if (k === 'PageUp' || k === 'PageDown') { this.move(k === 'PageUp' ? -Math.max(1, p.height - 1) : Math.max(1, p.height - 1), ctx); return true; }
    if (k === 'ArrowLeft' || k === '←' || k === 'ArrowRight' || k === '→') {
      this.pickerAdjust(ctx, p.field, k === 'ArrowLeft' || k === '←' ? -1 : 1);
      return true;
    }
    if (k === 'Backspace') {
      p.filter = p.filter.slice(0, -1);
      p.chosen = true;
      p.list.selected = 0;
      this.syncWhere(ctx);
      return true;
    }
    if (digit) {
      const n = typing ? p.quantity * 10 + Number(k) : Number(k);
      if (n >= ORDER_COUNT_MIN) { p.quantity = clampCount(n); p.typing = true; }
      return true;
    }
    const step = countStep(press);
    if (step !== 0) { p.quantity = clampCount(p.quantity + step); return true; }
    if (/^[a-zA-Z]$/.test(k)) {
      p.filter += k.toLowerCase();
      p.chosen = true;
      p.list.selected = 0;
      this.syncWhere(ctx);
      return true;
    }
    return false;
  }

  /** `Enter`: submit the picked order and close the picker. */
  pickerAdd(ctx: PanelContext): Command | null {
    const p = this.picker;
    const recipe = this.pickerRecipe(ctx);
    if (recipe === undefined) {
      ctx.notice?.(p.filter === '' ? ctx.strings.get('ui.orders.no_recipes') : ctx.strings.get('ui.orders.no_recipe', { filter: p.filter }));
      return null;
    }
    if (!p.chosen) {
      ctx.notice?.(ctx.strings.get('ui.orders.choose_first'));
      return null;
    }
    const maintain = p.mode === 'maintain';
    const materialFilter = p.material === '' ? null : p.material;
    const cmd: Command = { type: 'AddWorkOrder', workshopId: p.workshopId, order: {
      recipeId: recipe.id, mode: p.mode, remaining: maintain ? 1 : p.quantity, threshold: maintain ? p.quantity : 0, priority: PRIORITY_DEFAULT, materialFilter,
    } };
    ctx.submit(cmd);
    this.recent = [recipe.id, ...this.recent.filter((id) => id !== recipe.id)].slice(0, ORDER_RECENT_MAX);
    if (!maintain) this.ask(p.workshopId, recipe.id, p.quantity, materialFilter);
    const qty = ctx.strings.get(maintain ? 'ui.orders.qty.keep' : 'ui.orders.qty.once', { n: p.quantity });
    ctx.notice?.(this.addedText(ctx, recipe, qty, p.workshopId));
    p.open = false;
    return cmd;
  }

  /** The status line after an order: it warns at once when nothing can make it yet. */
  private addedText(ctx: PanelContext, recipe: RecipeRow, qty: string, workshopId: EntityId): string {
    const s = ctx.strings;
    const reader = this.reader(ctx);
    const where = workshopId === 0 ? this.workshopsOfType(ctx, recipe.workshop) : [workshopId];
    if (where.length === 0) {
      const workshop = (ctx.registry.table<{ id: string; name: string }>('buildings').byId(recipe.workshop)?.name ?? recipe.workshop.replace(/_/g, ' ')).toLowerCase();
      return s.get('ui.orders.added_no_workshop', { qty, recipe: recipe.name, workshop });
    }
    if (reader !== null && !where.some((id) => reader.isRunnable(recipe.id, id).runnable)) {
      const waiting = waitingFor(ctx, reader.isRunnable(recipe.id, where[0] as EntityId).reason);
      if (waiting !== null) return s.get('ui.orders.added_waiting', { qty, recipe: recipe.name, item: waiting.item, n: waiting.n });
    }
    return s.get('ui.orders.added', { qty, recipe: recipe.name, where: this.whereName(ctx, workshopId, recipe) });
  }

  // ---------- the list ----------

  /** A finished order becomes a `done` row (`WorkOrderCompleted`). */
  onEvent(event: GameEvent): void {
    if (event.type !== 'WorkOrderCompleted') return;
    const e = event as unknown as { workshopId: EntityId; recipeId: string };
    // The workshop's own order first; an order placed for "any workshop" finishes at one of them.
    const own = this.placed.get(`${e.workshopId}:${e.recipeId}`);
    const workshopId = (own === undefined || own.length === 0) && (this.placed.get(`0:${e.recipeId}`)?.length ?? 0) > 0 ? 0 : e.workshopId;
    const asked = this.placed.get(`${workshopId}:${e.recipeId}`)?.shift();
    this.finished = [{ workshopId, recipeId: e.recipeId, count: asked?.count ?? ORDER_COUNT_MIN, materialFilter: asked?.materialFilter ?? null }, ...this.finished].slice(0, ORDER_FINISHED_MAX);
  }

  private recipeName(ctx: PanelContext, recipe: string | number): string {
    return this.reader(ctx)?.recipe(recipe)?.name ?? '';
  }

  /** `+`/`-`: the selected order's count: `remaining`, or the threshold of a `keep ≥ N` order. */
  adjust(ctx: PanelContext, delta: number): void {
    const s = ctx.strings;
    const row = this.selectedRow(ctx);
    if (row === undefined) { ctx.notice?.(s.get('ui.orders.no_selection')); return; }
    if (row.kind === 'done') { ctx.notice?.(s.get('ui.orders.done_fixed')); return; }
    const order = row.entry.order;
    const maintain = order.mode === 'maintain';
    const now = maintain ? order.threshold : order.remaining;
    const next = clampCount(now + delta);
    if (next === now) { ctx.notice?.(s.get('ui.orders.count_limit', { min: ORDER_COUNT_MIN, max: ORDER_COUNT_MAX })); return; }
    ctx.submit({ type: 'EditWorkOrder', workshopId: row.entry.workshopId, index: row.entry.index, patch: maintain ? { threshold: next } : { remaining: next } });
    const recipeId = this.reader(ctx)?.recipe(order.recipe)?.id;
    const asks = recipeId === undefined ? undefined : this.placed.get(`${row.entry.workshopId}:${recipeId}`);
    if (!maintain && asks !== undefined && asks.length > 0) asks[asks.length - 1] = { count: next, materialFilter: order.materialFilter };
  }

  /** `[r]`: order the selected order again, or the last finished one. */
  repeat(ctx: PanelContext): Command | null {
    const s = ctx.strings;
    const reader = this.reader(ctx);
    const row = this.selectedRow(ctx) ?? (this.finished[0] === undefined ? undefined : { kind: 'done' as const, done: this.finished[0] });
    if (row === undefined || reader === null) { ctx.notice?.(s.get('ui.orders.nothing_to_repeat')); return null; }
    let cmd: Command;
    let qty: string;
    let recipe: RecipeRow | undefined;
    let workshopId: EntityId;
    if (row.kind === 'done') {
      recipe = reader.recipe(row.done.recipeId);
      workshopId = row.done.workshopId;
      cmd = { type: 'AddWorkOrder', workshopId, order: { recipeId: row.done.recipeId, mode: 'once', remaining: row.done.count, threshold: 0, priority: PRIORITY_DEFAULT, materialFilter: row.done.materialFilter } };
      qty = s.get('ui.orders.qty.once', { n: row.done.count });
      this.finished = this.finished.filter((f) => f !== row.done);
      this.ask(workshopId, row.done.recipeId, row.done.count, row.done.materialFilter);
    } else {
      const order = row.entry.order;
      recipe = reader.recipe(order.recipe);
      workshopId = row.entry.workshopId;
      const maintain = order.mode === 'maintain';
      const count = maintain ? 1 : Math.max(order.remaining, this.asked(workshopId, recipe?.id ?? ''));
      if (!maintain && recipe !== undefined) this.ask(workshopId, recipe.id, count, order.materialFilter);
      cmd = { type: 'AddWorkOrder', workshopId, order: { recipeId: recipe?.id ?? '', mode: order.mode, remaining: count, threshold: order.threshold, priority: order.priority, materialFilter: order.materialFilter } };
      qty = maintain ? s.get('ui.orders.qty.keep', { n: order.threshold }) : s.get('ui.orders.qty.once', { n: count });
    }
    ctx.submit(cmd);
    ctx.notice?.(s.get('ui.orders.added', { qty, recipe: recipe?.name ?? '', where: this.whereName(ctx, workshopId, recipe) }));
    return cmd;
  }

  /** `[x]`: remove the selected order, after asking (D-U2); a `done` row is just cleared. */
  remove(ctx: PanelContext): void {
    const row = this.selectedRow(ctx);
    if (row === undefined) { ctx.notice?.(ctx.strings.get('ui.orders.no_selection')); return; }
    if (row.kind === 'done') {
      this.finished = this.finished.filter((f) => f !== row.done);
      return;
    }
    const entry = row.entry;
    // The game runs behind the dialog: the answer removes the order that was asked about, found again by
    // what it is, and not whatever stands at its old position by then.
    confirmThen(ctx, 'c_remove_order', { recipe: this.recipeName(ctx, entry.order.recipe) }, () => {
      const index = this.queuedIndex(ctx, entry);
      if (index === null) ctx.notice?.(ctx.strings.get('ui.orders.vanished'));
      else ctx.submit({ type: 'RemoveWorkOrder', workshopId: entry.workshopId, index });
    });
  }

  /**
   * Where the order of `entry` stands in its queue now: its serial for a global order, else the nearest
   * order of the same recipe, mode, threshold, priority, material and memorial; null when it is gone.
   * The count is not compared, because it falls while the order runs.
   */
  private queuedIndex(ctx: PanelContext, entry: OrderEntry): number | null {
    const reader = this.reader(ctx);
    if (reader === null) return null;
    const queue = entry.workshopId === 0 ? reader.globalOrders() : reader.ordersOf(entry.workshopId);
    const a = entry.order;
    const same = (b: WorkOrder): boolean => a.serial !== undefined ? b.serial === a.serial :
      a.recipe === b.recipe && a.mode === b.mode && a.threshold === b.threshold && a.priority === b.priority &&
      a.materialFilter === b.materialFilter && a.memorialDwarfId === b.memorialDwarfId;
    let best: number | null = null;
    queue.forEach((b, index) => {
      if (same(b) && (best === null || Math.abs(index - entry.index) < Math.abs(best - entry.index))) best = index;
    });
    return best;
  }

  /** `Shift+↑↓`: move the selected order within its workshop's queue. */
  reorder(ctx: PanelContext, delta: number): Command | null {
    const entry = this.selected(ctx);
    if (entry === undefined) { ctx.notice?.(ctx.strings.get('ui.orders.no_selection')); return null; }
    const count = entry.workshopId === 0 ? this.reader(ctx)?.globalOrders().length ?? 0 : this.reader(ctx)?.ordersOf(entry.workshopId).length ?? 0;
    const to = entry.index + delta;
    if (to < 0 || to >= count) { ctx.notice?.(ctx.strings.get(delta < 0 ? 'ui.orders.first' : 'ui.orders.last')); return null; }
    this.list.selected += delta;
    const cmd: Command = { type: 'ReorderWorkOrder', workshopId: entry.workshopId, from: entry.index, to };
    ctx.submit(cmd);
    return cmd;
  }

  patch(ctx: PanelContext, patch: Record<string, unknown>): Command | null {
    const entry = this.selected(ctx);
    if (entry === undefined) { ctx.notice?.(ctx.strings.get('ui.orders.no_selection')); return null; }
    const cmd: Command = { type: 'EditWorkOrder', workshopId: entry.workshopId, index: entry.index, patch };
    ctx.submit(cmd);
    return cmd;
  }
  toggleMode(ctx: PanelContext): void {
    const order = this.selected(ctx)?.order;
    if (order === undefined) { ctx.notice?.(ctx.strings.get('ui.orders.no_selection')); return; }
    this.patch(ctx, order.mode === 'once' ? { mode: 'maintain', threshold: Math.max(ORDER_COUNT_MIN, order.threshold || ORDER_KEEP_DEFAULT) } : { mode: 'once', threshold: 0 });
  }
  nextPriority(ctx: PanelContext): void {
    const order = this.selected(ctx)?.order;
    if (order === undefined) { ctx.notice?.(ctx.strings.get('ui.orders.no_selection')); return; }
    this.patch(ctx, { priority: order.priority >= PRIORITY_MAX ? PRIORITY_MIN : order.priority + 1 });
  }

  /**
   * The order list's keys (the picker and the material list first). `+`/`-` reach here only
   * through the screen, which sends them before the game-speed keys while a row is selected (Q2).
   */
  key(ctx: PanelContext, press: KeyPress): boolean {
    if (press.ctrl || press.alt || press.meta) return false;
    if (this.materialOpen) { this.materialKey(ctx, press); return true; }
    if (this.picker.open) return this.pickerKey(ctx, press);
    const k = press.key;
    const up = k === 'ArrowUp' || k === '↑';
    const down = k === 'ArrowDown' || k === '↓';
    if (up || down) {
      if (press.shift) this.reorder(ctx, up ? -1 : 1);
      else this.move(up ? -1 : 1, ctx);
      return true;
    }
    const step = countStep(press);
    if (step !== 0) { this.adjust(ctx, step); return true; }
    const letter = accel(ctx, press);
    if (letter === 'n') { this.openPicker(ctx, { workshopId: this.workshopId }); return true; }
    if (letter === 'r') { this.repeat(ctx); return true; }
    if (letter === 'x') { this.remove(ctx); return true; }
    if (letter === 'm') { this.toggleMode(ctx); return true; }
    if (letter === 'p') { this.nextPriority(ctx); return true; }
    if (letter === 'f') { this.openMaterials(ctx); return true; }
    return false;
  }

  // ---------- the workshop panel ----------

  nextWorker(ctx: PanelContext, id: EntityId): Command | null {
    const ws = ctx.readers.entities.get(id, C.Workshop);
    const building = this.buildings(ctx)?.get(id);
    const reader = this.reader(ctx);
    if (ws === undefined || building === undefined || reader === null) return null;
    const jobs = ctx.readers.of<JobsReader>('11');
    const skills = ctx.registry.table<{ id: string; labor: string | null }>('skills');
    const labors = reader.recipesFor(building.typeId).map((recipe) => skills.byId(recipe.skill)?.labor).filter((labor): labor is string => typeof labor === 'string');
    const candidates = [0, ...dwarvesOf(ctx).filter((dwarf) => labors.some((labor) => jobs.laborEnabled(dwarf, labor)))];
    const at = candidates.indexOf(ws.assignedWorker);
    return { type: 'SetWorkshopWorker', workshopId: id, dwarfId: candidates[(at + 1) % candidates.length] ?? 0 };
  }

  /** The workshop panel's actions, by key or by click; `takeApart` is the screen's confirmed deconstruct. */
  workshopAction(ctx: PanelContext, id: EntityId, action: WorkshopAction, takeApart: () => void, recipeId?: string): void {
    const ws = ctx.readers.entities.get(id, C.Workshop) as Workshop | undefined;
    if (ws === undefined) return;
    if (action === 'new') {
      this.workshopId = id;
      this.list.selected = 0;
      this.openPicker(ctx, recipeId === undefined ? { workshopId: id } : { workshopId: id, recipeId });
      ctx.openPanel('orders');
    } else if (action === 'orders') {
      this.workshopId = id;
      this.list.selected = 0;
      this.picker.open = false;
      ctx.openPanel('orders');
    } else if (action === 'material') {
      if (ws.orders.length === 0) { ctx.notice?.(ctx.strings.get('ui.orders.none_here')); return; }
      this.workshopId = id;
      this.list.selected = 0;
      this.picker.open = false;
      this.openMaterials(ctx);
      ctx.openPanel('orders');
    } else if (action === 'worker') {
      const cmd = this.nextWorker(ctx, id);
      if (cmd !== null) ctx.submit(cmd);
    } else if (action === 'suspend') {
      if (ws.suspended) ctx.submit({ type: 'SuspendWorkshop', workshopId: id, on: false });
      else confirmThen(ctx, 'c_suspend_workshop', { workshop: buildingName(ctx, id) }, () => ctx.submit({ type: 'SuspendWorkshop', workshopId: id, on: true }));
    } else takeApart();
  }

  /** The workshop panel's keys. */
  workshopKey(ctx: PanelContext, id: EntityId, press: KeyPress, takeApart: () => void): boolean {
    const building = this.buildings(ctx)?.get(id);
    const rows = this.groupRecipes(ctx, building === undefined ? [] : this.reader(ctx)?.recipesFor(building.typeId) ?? []).flatMap((row) => 'recipe' in row ? [row.recipe] : []);
    const state = this.workshopList(id);
    if (press.key === 'ArrowUp' || press.key === 'ArrowDown') {
      state.selected = Math.max(0, Math.min(rows.length - 1, state.selected + (press.key === 'ArrowUp' ? -1 : 1)));
      return true;
    }
    if (press.key === 'Enter') {
      const recipe = rows[state.selected];
      if (recipe !== undefined) this.workshopAction(ctx, id, 'new', takeApart, recipe.id);
      return true;
    }
    const letter = accel(ctx, press);
    const action = WORKSHOP_KEYS[letter];
    if (action === undefined) return false;
    // With no recipes there is only the one action.
    if (building !== undefined && !workshopHasWork(ctx.registry, building.typeId, rows.length) && action !== 'deconstruct') return true;
    this.workshopAction(ctx, id, action, takeApart);
    return true;
  }

  // ---------- the material filter ----------

  /** The materials an order of a recipe can be limited to: any, the input classes, their materials. */
  materialOptions(ctx: PanelContext, recipe?: RecipeRow): { id: string; name: string }[] {
    const any = { id: '', name: ctx.strings.get('ui.orders.any_material') };
    if (recipe === undefined) {
      const entry = this.selected(ctx);
      recipe = entry === undefined ? undefined : this.reader(ctx)?.recipe(entry.order.recipe);
    }
    if (recipe === undefined) return [];
    const brew = recipe.outputs.some((output) => 'plantDrink' in output.material);
    if (brew) return [any, ...ctx.registry.table<{ id: string; name: string; brew?: string }>('plants').rows.filter((plant) => plant.brew !== undefined).map((plant) => ({ id: plant.id, name: plant.name }))];
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
    return [any, ...Array.from(classes).sort().map((id) => ({ id, name: ctx.strings.get('ui.orders.material_class', { class: id }) })), ...materials.filter((m) => classes.has(m.class)).map((m) => ({ id: m.id, name: m.name }))];
  }
  /** A material filter as the panel names it. */
  materialName(ctx: PanelContext, filter: WorkOrder['materialFilter'] | string, recipe?: RecipeRow): string {
    if (filter === null || filter === '') return ctx.strings.get('ui.orders.any_material');
    const materials = ctx.registry.table<{ id: string; name: string }>('materials');
    if (typeof filter === 'number') return materials.byIndex(filter)?.name ?? ctx.strings.get('ui.orders.any_material');
    return this.materialOptions(ctx, recipe).find((option) => option.id === filter)?.name ?? materials.byId(filter)?.name ?? filter.replace(/_/g, ' ');
  }
  openMaterials(ctx: PanelContext): void {
    if (this.selected(ctx) === undefined) { ctx.notice?.(ctx.strings.get('ui.orders.no_selection')); return; }
    const options = this.materialOptions(ctx);
    if (options.length === 0) return;
    const current = this.selected(ctx)?.order.materialFilter;
    const selected = typeof current === 'number' ? ctx.registry.table('materials').byIndex(current)?.id : current;
    this.materials.selected = Math.max(0, options.findIndex((option) => option.id === (selected ?? '')));
    this.materialOpen = true;
  }
  materialKey(ctx: PanelContext, key: KeyPress): void {
    const options = this.materialOptions(ctx);
    if (key.key === 'Escape' || key.key === 'Esc') { this.materialOpen = false; return; }
    if (key.key === 'ArrowUp' || key.key === '↑') { this.materials.selected = Math.max(0, this.materials.selected - 1); return; }
    if (key.key === 'ArrowDown' || key.key === '↓') { this.materials.selected = Math.min(options.length - 1, this.materials.selected + 1); return; }
    if (key.key !== 'Enter') return;
    this.chooseMaterial(ctx, this.materials.selected);
  }
  chooseMaterial(ctx: PanelContext, index: number): void {
    const option = this.materialOptions(ctx)[index];
    this.materialOpen = false;
    if (option !== undefined) this.patch(ctx, { materialFilter: option.id === '' ? null : option.id });
  }

  // ---------- status ----------

  /** What an order is doing now (D-U5: "waiting for stone (0)", "no carpenter's workshop", "in progress", "done"). */
  status(ctx: PanelContext, row: OrderRow): OrderStatus {
    const s = ctx.strings;
    const reader = this.reader(ctx);
    const plain = (kind: OrderStatus['kind'], long?: string): OrderStatus => ({ kind, short: s.get(`ui.orders.status.${kind}`), long: long ?? s.get(`ui.orders.long.${kind}`) });
    if (row.kind === 'done') return plain('done');
    const { workshopId, index, order } = row.entry;
    const recipe = reader?.recipe(order.recipe);
    if (reader === null || recipe === undefined) return plain('other');
    const jobs = ctx.readers.has('11') ? ctx.readers.of<JobsReader>('11') : null;
    const workshops = workshopId === 0 ? this.workshopsOfType(ctx, recipe.workshop) : [workshopId];
    if (workshops.length === 0) {
      const workshop = ctx.registry.table<{ id: string; name: string }>('buildings').byId(recipe.workshop)?.name ?? recipe.workshop.replace(/_/g, ' ');
      return { kind: 'no_workshop', short: s.get('ui.orders.status.no_workshop', { workshop }), long: s.get('ui.orders.long.no_workshop', { workshop }) };
    }
    const working = workshopId === 0
      ? jobs?.byKey(`craft:global:${index}`) !== undefined
      : ((): boolean => {
        const ws = ctx.readers.entities.get(workshopId, C.Workshop);
        const job = ws === undefined || ws.currentJobId === 0 ? undefined : jobs?.get(ws.currentJobId);
        return job !== undefined && job.data['orderIndex'] === index && job.data['globalOrder'] !== true;
      })();
    if (working) return plain('in_progress');
    if (order.mode === 'maintain') {
      const n = reader.stockOf(recipe.outputs[0]?.item ?? '');
      if (n >= order.threshold) return { kind: 'stocked', short: s.get('ui.orders.status.stocked', { n }), long: s.get('ui.orders.long.stocked', { n, threshold: order.threshold }) };
    }
    let reason: string | null = null;
    for (const id of workshops) {
      const why = reader.isRunnable(recipe.id, id).reason;
      if (why === null) return plain('queued');
      reason ??= why;
    }
    const long = workshopBlockText(ctx, reason);
    const waiting = waitingFor(ctx, reason);
    if (waiting !== null) return { kind: 'waiting', short: s.get('ui.orders.status.waiting', { item: waiting.item, n: waiting.n }), long };
    if (reason === 'missing_input') return plain('fuel', long);
    if (reason === 'workshop_suspended') return plain('suspended', long);
    if (reason === 'no_magma') return plain('no_magma', long);
    if (reason === 'no_worker') return plain('no_worker', long);
    return plain('other', long);
  }

  /** An order's amount as its row shows it: `×5`, or `≥10` for a `keep ≥ N` order. */
  quantityText(ctx: PanelContext, row: OrderRow): string {
    if (row.kind === 'done') return ctx.strings.get('ui.orders.qty.once', { n: row.done.count });
    const order = row.entry.order;
    return order.mode === 'maintain' ? ctx.strings.get('ui.orders.qty.keep', { n: order.threshold }) : ctx.strings.get('ui.orders.qty.once', { n: order.remaining });
  }
  /** One order as a list row: "×5 Door · waiting for log (0)". */
  rowText(ctx: PanelContext, row: OrderRow): string {
    const recipe = this.recipeName(ctx, row.kind === 'done' ? row.done.recipeId : row.entry.order.recipe);
    return ctx.strings.get('ui.orders.row', { qty: this.quantityText(ctx, row), recipe, status: this.status(ctx, row).short });
  }
}

export type WorkshopAction = 'new' | 'orders' | 'material' | 'worker' | 'suspend' | 'deconstruct';

/** The workshop panel's accelerators (`s`, `o`, `f` and `n` are panel letters: `Shift`, D-U2). */
const WORKSHOP_KEYS: Readonly<Record<string, WorkshopAction>> = Object.freeze({
  n: 'new', o: 'orders', f: 'material', w: 'worker', s: 'suspend', x: 'deconstruct',
});

// ---------- drawing ----------

interface GroupRow {
  readonly heading?: string;
  readonly text?: () => string;
  readonly fg?: Rgb;
}

/**
 * A list with group headings: `state.selected` counts the rows that are not headings, and the
 * selected row's heading stays in view. The text of a row is asked for only when it is drawn.
 */
function groupedList(s: Surface, rect: Rect, rows: readonly GroupRow[], state: ListState, onSelect: (index: number) => void): void {
  const items: number[] = [];
  rows.forEach((row, k) => { if (row.heading === undefined) items.push(k); });
  state.selected = Math.max(0, Math.min(items.length - 1, state.selected));
  const at = items[state.selected] ?? 0;
  if (at - 1 < state.scroll) state.scroll = Math.max(0, at - 1);
  if (at >= state.scroll + rect.rows) state.scroll = at - rect.rows + 1;
  state.scroll = Math.max(0, Math.min(Math.max(0, rows.length - rect.rows), state.scroll));
  const scrollbar = rows.length > rect.rows;
  const width = scrollbar ? rect.cols - 1 : rect.cols;
  for (let r = 0; r < rect.rows; r += 1) {
    const k = state.scroll + r;
    const row = rows[k];
    const y = rect.row + r;
    s.fill({ col: rect.col, row: y, cols: width, rows: 1 }, s.theme.black);
    if (row === undefined) continue;
    if (row.heading !== undefined) { separator(s, rect.col, y, width, row.heading); continue; }
    label(s, rect.col, y, row.text?.() ?? '', { width, keys: false, ...(row.fg === undefined ? {} : { fg: row.fg }) });
    const cells = { col: rect.col, row: y, cols: width, rows: 1 };
    if (k === at && items.length > 0) s.invert(cells);
    const index = items.indexOf(k);
    s.hit(cells, () => onSelect(index));
  }
  if (!scrollbar) return;
  const thumbRow = Math.floor((state.scroll * (rect.rows - 1)) / Math.max(1, rows.length - rect.rows));
  for (let r = 0; r < rect.rows; r += 1) {
    s.put(rect.col + rect.cols - 1, rect.row + r, s.glyphs.index(r === thumbRow ? '█' : '│'), s.theme.border, s.theme.black);
  }
  // A press or a drag on the track moves the cursor to the first row at the pointer's place: this list scrolls to keep the cursor in view.
  s.scrollbar({ col: rect.col + rect.cols - 1, row: rect.row, cols: 1, rows: rect.rows }, (row) => {
    const at = Math.max(0, Math.min(rect.rows - 1, row - rect.row));
    const target = Math.round((at * (rows.length - 1)) / Math.max(1, rect.rows - 1));
    const index = items.findIndex((k) => k >= target);
    state.selected = index < 0 ? items.length - 1 : index;
  });
}

/** A row of `[k] action` captions, each clickable at its own cells. */
function actionRow(s: Surface, col: number, row: number, width: number, parts: readonly { readonly text: string; readonly run?: () => void; readonly fg?: Rgb }[], gap = 2): void {
  let c = col;
  for (const part of parts) {
    const room = width - (c - col);
    if (room <= 0) break;
    const n = label(s, c, row, part.text, { width: room, ...(part.fg === undefined ? {} : { fg: part.fg }) });
    if (part.run !== undefined) s.hit({ col: c, row, cols: n, rows: 1 }, part.run);
    c += n + gap;
  }
}

function statusColor(s: Surface, kind: OrderStatus['kind']): Rgb {
  if (kind === 'in_progress') return s.theme.good;
  if (kind === 'queued') return s.theme.text;
  if (kind === 'done' || kind === 'stocked') return s.theme.dim;
  return s.theme.alert;
}

/** `ui-screens/panels.md` § Add order. */
function drawPicker(s: Surface, rect: Rect, panel: OrdersPanel, ctx: PanelContext): void {
  const t = s.theme;
  const strings = ctx.strings;
  const p = panel.picker;
  const width = rect.cols - 2;
  const col = rect.col + 1;
  label(s, col, rect.row, strings.get('ui.orders.picker.title'), { fg: t.key, width });
  const find = strings.get('ui.orders.picker.find');
  label(s, col, rect.row + 1, find, { width });
  textField(s, col + find.length + 1, rect.row + 1, Math.max(1, width - find.length - 5), { value: p.filter, focused: p.field === 'recipe', maxLength: width }, () => { p.field = 'recipe'; });
  // The workshop is shown for a workshop's own order too, where it cannot change.
  const fields: PickerField[] = ['quantity', 'mode', 'material', 'where'];
  const bottom = fields.length + 2;
  const height = Math.max(1, rect.rows - 2 - bottom);
  p.height = height;
  const rows = panel.pickerRows(ctx);
  // Two workshop types can make a thing of the same name ("Door"): such rows say which one.
  const seen = new Map<string, string>();
  const twins = new Set<string>();
  for (const row of rows) {
    if (!('recipe' in row)) continue;
    const other = seen.get(row.recipe.name);
    if (other !== undefined && other !== row.recipe.id) twins.add(row.recipe.name);
    seen.set(row.recipe.name, row.recipe.id);
  }
  const workshopOf = (recipe: RecipeRow): string => ctx.registry.table<{ id: string; name: string }>('buildings').byId(recipe.workshop)?.name ?? recipe.workshop.replace(/_/g, ' ');
  if (!rows.some((row) => 'recipe' in row)) {
    label(s, col, rect.row + 2, p.filter === '' ? strings.get('ui.orders.no_recipes') : strings.get('ui.orders.no_recipe', { filter: p.filter }), { fg: t.dim, width, keys: false });
  } else {
    groupedList(s, { col, row: rect.row + 2, cols: width, rows: height }, rows.map((row): GroupRow => ('heading' in row
      ? { heading: row.heading }
      : { text: () => `${panel.makeable(ctx, row.recipe) ? '●' : '○'} ${row.recipe.name}${twins.has(row.recipe.name) ? ` · ${workshopOf(row.recipe)}` : ''}${panel.rank(ctx, row.recipe) === 2 ? ` · no ${workshopOf(row.recipe).toLowerCase()}` : ''}`, ...(panel.rank(ctx, row.recipe) === 2 ? { fg: t.dim } : {}) })), p.list, (index) => {
      // A click selects; a click on the selected recipe adds it.
      if (index === p.list.selected) panel.pickerAdd(ctx);
      else { p.list.selected = index; p.typing = false; p.chosen = true; panel.move(0, ctx); }
    });
  }
  let row = rect.row + 2 + height;
  separator(s, col, row, width); row += 1;
  const recipe = panel.pickerRecipe(ctx);
  const caption = (field: PickerField, name: string): number => label(s, col, row, `${p.field === field ? '▶' : ' '} ${name.padEnd(9)}`, { width, fg: p.field === field ? t.value : t.text });
  for (const field of fields) {
    if (row >= rect.row + rect.rows - 1) break;
    if (field === 'quantity') {
      const n = caption(field, p.mode === 'maintain' ? strings.get('ui.orders.picker.keep') : strings.get('ui.orders.picker.quantity'));
      numberField(s, col + n, row, p.quantity, (delta) => { p.field = 'quantity'; panel.pickerAdjust(ctx, 'quantity', delta); }, { min: ORDER_COUNT_MIN, max: ORDER_COUNT_MAX, width: 3 });
    } else {
      const name = field === 'mode' ? strings.get('ui.orders.picker.mode') : field === 'material' ? strings.get('ui.orders.picker.material') : strings.get('ui.orders.picker.where');
      const n = caption(field, name);
      const value = field === 'mode' ? strings.get(`ui.orders.picker.mode.${p.mode}`, { n: p.quantity })
        : field === 'material' ? panel.materialName(ctx, p.material, recipe)
          : panel.whereName(ctx, p.workshopId, recipe);
      const locked = field === 'where' && p.fixed;
      label(s, col + n, row, value, { fg: locked ? t.dim : t.value, width: width - n, keys: false });
      if (!locked) s.hit({ col, row, cols: width, rows: 1 }, () => { p.field = field; panel.pickerAdjust(ctx, field, 1); });
    }
    row += 1;
  }
  actionRow(s, col, rect.row + rect.rows - 1, width, [
    { text: strings.get('ui.orders.picker.add'), run: () => void panel.pickerAdd(ctx) },
    { text: strings.get('ui.orders.picker.field'), run: () => void panel.pickerKey(ctx, { key: 'Tab', repeat: false, shift: false, ctrl: false, alt: false, meta: false }) },
    { text: strings.get('ui.orders.picker.back'), run: () => { p.open = false; } },
  ], 1);
}

export function drawOrdersPanel(s: Surface, rect: Rect, panel: OrdersPanel, ctx: PanelContext): void {
  const reader = panel.reader(ctx);
  if (reader === null) return;
  const t = s.theme;
  const strings = ctx.strings;
  const width = rect.cols - 2;
  const col = rect.col + 1;
  if (panel.picker.open) { drawPicker(s, rect, panel, ctx); return; }
  if (panel.materialOpen) {
    label(s, col, rect.row, strings.get('ui.orders.material_title'), { fg: t.key, width });
    const options = panel.materialOptions(ctx);
    list(s, { col, row: rect.row + 1, cols: width, rows: Math.max(1, rect.rows - 3) }, options.map((option) => option.name), panel.materials, (i) => panel.chooseMaterial(ctx, i));
    label(s, col, rect.row + rect.rows - 1, strings.get('ui.orders.material_help'), { width });
    return;
  }
  // One workshop's list is headed by its name; the whole fortress's by each workshop in turn.
  actionRow(s, col, rect.row, width, [
    { text: strings.get('ui.orders.new'), run: () => panel.openPicker(ctx, { workshopId: panel.workshopId }) },
    ...(panel.workshopId === 0 ? [{ text: strings.get('ui.orders.scope.all'), fg: t.dim }] : []),
  ]);
  const rows = panel.rows(ctx);
  // The list, a rule, the selected order's six lines, then the standing orders under their rule.
  const height = Math.max(3, rect.rows - 1 - 7 - 1 - STANDING_ORDERS.length);
  if (rows.length === 0) {
    const top = panel.workshopId === 0 ? rect.row + 1 : rect.row + 2;
    if (panel.workshopId !== 0) separator(s, col, rect.row + 1, width, buildingName(ctx, panel.workshopId));
    label(s, col, top, strings.get(panel.workshopId === 0 ? 'ui.orders.empty1' : 'ui.orders.none_here'), { fg: t.dim, width });
    if (panel.workshopId === 0) label(s, col, top + 1, strings.get('ui.orders.empty2'), { fg: t.dim, width });
  } else {
    const grouped: GroupRow[] = [];
    let group = '';
    for (const row of rows) {
      const heading = row.kind === 'done' ? strings.get('ui.orders.group.finished')
        : row.entry.workshopId === 0 ? strings.get('ui.orders.group.global') : buildingName(ctx, row.entry.workshopId);
      if (heading !== group) grouped.push({ heading });
      group = heading;
      grouped.push({ text: () => panel.rowText(ctx, row), fg: statusColor(s, panel.status(ctx, row).kind) });
    }
    groupedList(s, { col, row: rect.row + 1, cols: width, rows: height }, grouped, panel.list, (i) => { panel.list.selected = i; });
  }
  let row = rect.row + 1 + height;
  const end = rect.row + rect.rows;
  separator(s, col, row, width); row += 1;
  const selected = panel.selectedRow(ctx);
  if (selected !== undefined && row + 6 <= end) {
    const status = panel.status(ctx, selected);
    const lines = wrapText(status.long, width, 2);
    label(s, col, row, lines[0] ?? '', { fg: statusColor(s, status.kind), width });
    label(s, col, row + 1, lines[1] ?? '', { fg: statusColor(s, status.kind), width });
    if (selected.kind === 'live') {
      const order = selected.entry.order;
      const maintain = order.mode === 'maintain';
      const name = strings.get(maintain ? 'ui.orders.keep' : 'ui.orders.count');
      const n = label(s, col, row + 2, `${name} `, { width });
      const used = numberField(s, col + n, row + 2, maintain ? order.threshold : order.remaining, (delta) => panel.adjust(ctx, delta), { min: ORDER_COUNT_MIN, max: ORDER_COUNT_MAX });
      label(s, col + n + used + 1, row + 2, strings.get('ui.orders.count_help'), { fg: t.dim, width: width - n - used - 1 });
      actionRow(s, col, row + 3, width, [
        { text: strings.get('ui.orders.mode_action', { mode: strings.get(`ui.orders.mode.${order.mode}`) }), run: () => panel.toggleMode(ctx) },
        { text: strings.get('ui.orders.priority', { n: order.priority }), run: () => panel.nextPriority(ctx) },
      ]);
      actionRow(s, col, row + 4, width, [
        { text: strings.get('ui.orders.material', { material: panel.materialName(ctx, order.materialFilter, reader.recipe(order.recipe)) }), run: () => panel.openMaterials(ctx) },
      ]);
      actionRow(s, col, row + 5, width, [
        { text: strings.get('ui.orders.actions.remove'), run: () => panel.remove(ctx) },
        { text: strings.get('ui.orders.actions.repeat'), run: () => void panel.repeat(ctx) },
        { text: strings.get('ui.orders.actions.move'), run: () => void panel.reorder(ctx, ctx.shiftClick() ? -1 : 1) },
      ], 1);
    } else {
      actionRow(s, col, row + 2, width, [
        { text: strings.get('ui.orders.actions.repeat'), run: () => void panel.repeat(ctx) },
        { text: strings.get('ui.orders.actions.clear'), run: () => panel.remove(ctx) },
      ]);
    }
  } else if (selected === undefined && panel.finished[0] !== undefined && row < end) {
    actionRow(s, col, row, width, [{ text: strings.get('ui.orders.actions.repeat'), run: () => void panel.repeat(ctx) }]);
  }
  row += 6;
  if (row >= end) return;
  separator(s, col, row, width, strings.get('ui.orders.standing')); row += 1;
  const standing = ctx.readers.has('11') ? ctx.readers.of<JobsReader>('11') : null;
  for (const name of STANDING_ORDERS) {
    if (row >= end) break;
    label(s, col, row, `[${standing?.standingOrder(name) ? '■' : '□'}] ${name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^auto /, '')}`, { width });
    s.hit({ col, row, cols: width, rows: 1 }, () => ctx.submit({ type: 'SetStandingOrder', name, on: !standing?.standingOrder(name) }));
    row += 1;
  }
}

/**
 * Why a workshop is idle, with the input named (`12` § Operation 3: "waiting for <input>"; D-U4).
 * The saved `lastBlockedReason` folds every missing input into `missing_input` (an empty container into `no_empty_container`); the reader's
 * `isRunnable` of the orders in turn says which one.
 */
export function workshopWaiting(reader: WorkshopsReader, id: EntityId, workshop: Workshop): string | null {
  const last = workshop.lastBlockedReason;
  if (last === null) return null;
  if (last !== 'missing_input' && last !== 'no_empty_container') return last;
  for (const order of workshop.orders) {
    const recipe = reader.recipe(order.recipe);
    const why = recipe === undefined ? null : reader.isRunnable(recipe.id, id).reason;
    if (why !== null && why !== 'complete' && why !== 'stocked') return why;
  }
  return 'inputs';
}

/** The rows the workshop panel keeps under its recipe list: the rule, three orders, three action rows, two block lines. */
const WORKSHOP_FOOT_ROWS = 9;
const WORKSHOP_ORDER_ROWS = 3;

/**
 * `ui-screens/panels.md` § Workshop. `act` runs an action by click (the keys go through
 * {@link OrdersPanel.workshopKey}); without it the captions are drawn but not clickable.
 */
export function drawWorkshopPanel(s: Surface, rect: Rect, id: EntityId, panel: OrdersPanel, ctx: PanelContext, act?: (action: WorkshopAction, recipeId?: string) => void): void {
  const reader = panel.reader(ctx);
  const building = ctx.readers.of<BuildingsReader>('14').get(id);
  const workshop = ctx.readers.entities.get(id, C.Workshop) as Workshop | undefined;
  if (reader === null || building === undefined || workshop === undefined) return;
  const t = s.theme;
  const strings = ctx.strings;
  const col = rect.col + 1; const width = rect.cols - 2;
  const run = (action: WorkshopAction, recipeId?: string): (() => void) | undefined => (act === undefined ? undefined : () => act(action, recipeId));
  const part = (text: string, action: WorkshopAction): { text: string; run?: () => void } => {
    const click = run(action);
    return click === undefined ? { text } : { text, run: click };
  };
  // A workshop that no recipe names (an old save's magma kiln) has nothing to offer but to be taken apart.
  if (!workshopHasWork(ctx.registry, building.typeId, reader.recipesFor(building.typeId).length)) {
    label(s, col, rect.row, buildingName(ctx, id), { fg: t.key, width });
    label(s, col, rect.row + 1, strings.get('ui.workshop.no_recipes'), { fg: t.dim, width, keys: false });
    actionRow(s, col, rect.row + 3, width, [part(strings.get('ui.workshop.deconstruct'), 'deconstruct')]);
    return;
  }
  label(s, col, rect.row, buildingName(ctx, id), { fg: t.key, width });
  const worker = workshop.assignedWorker === 0 ? strings.get('ui.workshop.any_worker') : ctx.readers.entities.get(workshop.assignedWorker, C.Creature)?.name ?? '?';
  label(s, col, rect.row + 1, strings.get('ui.workshop.worker', { name: worker }), { width });
  const state = [workshop.suspended ? strings.get('ui.workshop.suspended') : '', reader.isMagmaPowered(id) ? strings.get('ui.workshop.magma') : ''].filter((x) => x !== '').join(' · ');
  label(s, col, rect.row + 2, state, { fg: workshop.suspended ? t.alert : t.dim, width, keys: false });
  separator(s, col, rect.row + 3, width, strings.get('ui.workshop.recipes'));
  const recipes = reader.recipesFor(building.typeId);
  const foot = rect.row + rect.rows - WORKSHOP_FOOT_ROWS;
  const grouped = panel.groupRecipes(ctx, recipes);
  const ordered = grouped.flatMap((row) => 'recipe' in row ? [row.recipe] : []);
  const stateList = panel.workshopList(id);
  const recipeRect = { col, row: rect.row + 4, cols: width, rows: Math.max(1, foot - rect.row - 4) };
  groupedList(s, recipeRect, grouped.map((row): GroupRow => {
    if ('heading' in row) return row;
    const recipe = row.recipe;
    const can = reader.isRunnable(recipe.id, id).runnable;
    return { text: () => `${can ? '●' : '○'} ${recipe.name}`, fg: can ? t.good : t.dim };
  }), stateList, (index) => {
    stateList.selected = index;
    const recipe = ordered[index];
    if (recipe !== undefined) run('new', recipe.id)?.();
  });
  // Clicking the scrollbar browses later recipes without opening an order.
  if (grouped.length > recipeRect.rows) for (let r = 0; r < recipeRect.rows; r += 1) {
    s.hit({ col: col + width - 1, row: recipeRect.row + r, cols: 1, rows: 1 }, () => {
      const at = Math.round(r * (grouped.length - 1) / Math.max(1, recipeRect.rows - 1));
      const recipe = grouped.slice(at).find((row) => 'recipe' in row);
      if (recipe !== undefined && 'recipe' in recipe) stateList.selected = ordered.indexOf(recipe.recipe);
    });
  }
  const orderRows = reader.ordersOf(id);
  separator(s, col, foot, width, strings.get('ui.workshop.orders', { n: orderRows.length }));
  for (let k = 0; k < Math.min(WORKSHOP_ORDER_ROWS, orderRows.length); k += 1) {
    const row: OrderRow = { kind: 'live', entry: { workshopId: id, index: k, order: orderRows[k] as WorkOrder } };
    label(s, col, foot + 1 + k, panel.rowText(ctx, row), { fg: statusColor(s, panel.status(ctx, row).kind), width, keys: false });
    const click = run('orders');
    if (click !== undefined) s.hit({ col, row: foot + 1 + k, cols: width, rows: 1 }, click);
  }
  const actions = foot + 1 + WORKSHOP_ORDER_ROWS;
  actionRow(s, col, actions, width, [part(strings.get('ui.workshop.new'), 'new'), part(strings.get('ui.workshop.its_orders'), 'orders')]);
  actionRow(s, col, actions + 1, width, [part(strings.get('ui.workshop.material'), 'material'), part(strings.get('ui.workshop.worker_action'), 'worker')]);
  actionRow(s, col, actions + 2, width, [part(strings.get(workshop.suspended ? 'ui.workshop.resume' : 'ui.workshop.suspend'), 'suspend'), part(strings.get('ui.workshop.deconstruct'), 'deconstruct')]);
  const why = wrapText(workshopBlockText(ctx, workshopWaiting(reader, id, workshop)), width, 2);
  label(s, col, actions + 3, why[0] ?? '', { fg: t.alert, width, keys: false });
  label(s, col, actions + 4, why[1] ?? '', { fg: t.alert, width, keys: false });
}
