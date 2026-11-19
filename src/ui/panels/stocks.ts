/**
 * The stocks panel: `ui-screens/panels.md` § Stocks and `13` § Player-facing behavior ("Stocks
 * panel (hotkey `s`): the category tree with counts, values and material breakdown; forbid, dump,
 * melt actions apply to the selected category"). `[t]o depot` belongs to trade (M7) and is dim.
 *
 * A node's count and value sum the stocked types whose category lies under it; `f`, `d` and `m`
 * submit `ForbidItem`/`DumpItem`/`MeltItem` by `typeId` for each of them, turning the flag on
 * unless every item there already carries it (D-077).
 */

import { PanelFilter, drawPanelFilter } from './filter';
import { C, ItemFlag } from '@core/components';
import type { Command } from '@core/commands';
import type { EntityId } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import { CATEGORY_TREE, categoryUnder } from '@systems/items';
import type { Surface } from '../surface';
import { buildTree, label, tree, type TreeNode, type TreeState } from '../widgets';
import { buildings, confirmThen, items, marks, type PanelContext } from './context';
import { ageNote, agedMaterial, enchantedName, rotText, wrapHang } from '../messages';
import { TICKS_PER_DAY } from '@core/constants';
import { ROT_ALERT_DAYS, STOCKS_USE_ROWS } from '../constants';

interface NodeTotals {
  count: number;
  value: number;
}

/** 13 § Rot under a row: whether it holds anything with a rot timer, and the units that rot within `ROT_ALERT_DAYS`. */
interface NodeRot {
  soon: number;
}

/**
 * Why a unit in stock cannot be used now (13's available count leaves it out), in the order the
 * line names them: taken to the trade depot, forbidden, in use (installed furniture, a full cage),
 * owned by a dwarf, in a dwarf's hands, reserved by a job, or not yet recovered (foreign loot).
 */
export const UNUSABLE_REASONS = ['depot', 'forbidden', 'in_use', 'owned', 'carried', 'reserved', 'foreign'] as const;
export type UnusableReason = (typeof UNUSABLE_REASONS)[number];

/** The first reason that keeps an item out of 13's available count, or null for a usable item. */
export function unusableReason(rec: { flags: number; carriedBy: EntityId; occupantId?: EntityId }): UnusableReason | null {
  if ((rec.flags & ItemFlag.AtDepot) !== 0) return 'depot';
  if ((rec.flags & ItemFlag.Forbidden) !== 0) return 'forbidden';
  if ((rec.flags & ItemFlag.Installed) !== 0 || (rec.occupantId ?? 0) !== 0) return 'in_use';
  if ((rec.flags & ItemFlag.Owned) !== 0) return 'owned';
  if (rec.carriedBy !== 0) return 'carried';
  if ((rec.flags & ItemFlag.Reserved) !== 0) return 'reserved';
  if ((rec.flags & ItemFlag.Foreign) !== 0) return 'foreign';
  return null;
}

export class StocksPanel {
  readonly tree: TreeState = { selected: 0, scroll: 0, expanded: new Set<string>() };
  readonly filter = new PanelFilter();
  depotSelection = 0;
  readonly depotChosen = new Set<EntityId>();
  private forest: TreeNode[] | null = null;
  private cache: { tick: number; totals: Map<string, NodeTotals>; types: Map<string, number[]>; itemIds: Map<number, EntityId[]>; rot: Map<string, NodeRot> } | null = null;

  categories(): TreeNode[] {
    if (this.forest === null) this.forest = buildTree(CATEGORY_TREE);
    return this.forest;
  }

  /** Count and value per node, from the items (cached per tick). */
  totals(ctx: PanelContext): { totals: Map<string, NodeTotals>; types: Map<string, number[]>; itemIds: Map<number, EntityId[]>; rot: Map<string, NodeRot> } {
    const tick = ctx.readers.calendar.tick;
    if (this.cache?.tick === tick) return this.cache;
    const it = items(ctx);
    const totals = new Map<string, NodeTotals>();
    const types = new Map<string, number[]>();
    const itemIds = new Map<number, EntityId[]>();
    const rot = new Map<string, NodeRot>();
    const within = ROT_ALERT_DAYS * TICKS_PER_DAY;
    if (it !== null) {
      for (const id of ctx.readers.entities.with(C.Item)) {
        const rec = it.get(id as EntityId);
        if (rec === undefined || (rec.flags & ItemFlag.Merchant) !== 0) continue;
        const ids = itemIds.get(rec.type) ?? [];
        ids.push(id as EntityId);
        itemIds.set(rec.type, ids);
        const cat = it.categoryOf(rec.type);
        const parts = cat.split('/');
        // A perishable stack not yet rotting counts toward every row above it.
        const outlook = rec.rotStage >= 2 ? null : it.rotOutlook(id as EntityId);
        if (outlook !== null) {
          const soon = outlook.toRot !== null && outlook.toRot <= within ? rec.count : 0;
          for (const node of [`type:${rec.type}`, ...parts.map((_, k) => parts.slice(0, k + 1).join('/'))]) {
            const r = rot.get(node) ?? { soon: 0 };
            r.soon += soon;
            rot.set(node, r);
          }
        }
        for (let k = 1; k <= parts.length; k += 1) {
          const node = parts.slice(0, k).join('/');
          const t = totals.get(node) ?? { count: 0, value: 0 };
          t.count += rec.count;
          t.value += it.value(id as EntityId);
          totals.set(node, t);
          const list = types.get(node) ?? [];
          if (!list.includes(rec.type)) list.push(rec.type);
          types.set(node, list);
        }
      }
    }
    this.cache = { tick, totals, types, itemIds, rot };
    return this.cache;
  }

  selectedNode(ctx: PanelContext): string | null {
    const rows = this.visible(ctx);
    return rows[this.tree.selected] ?? null;
  }

  /** The rows the tree shows: stocked categories, then types, then individual stacks. */
  visibleForest(ctx: PanelContext): TreeNode[] {
    const { totals, types, itemIds } = this.totals(ctx);
    const it = items(ctx);
    const keep = (nodes: readonly TreeNode[]): TreeNode[] =>
      nodes.filter((n) => (totals.get(n.id)?.count ?? 0) > 0).map((n) => {
        const children = keep(n.children);
        if (it !== null) for (const type of types.get(n.id) ?? []) {
          if (it.categoryOf(type) !== n.id) continue;
          children.push({ id: `type:${type}`, name: it.def(type)?.name ?? String(type), children: (itemIds.get(type) ?? []).map((id) => {
            const rec = it.get(id);
            const plain = rec === undefined ? '?' : ctx.registry.table<{ id: string; name: string }>('materials').byIndex(rec.material)?.name ?? '?';
            // 13 § Aging in a cellar: an aged stack names its stage and its years ("aged bellwine ×20 (aged, 1 year in the cellar)").
            const material = agedMaterial(ctx.strings, plain, rec?.age);
            const note = rec === undefined ? '' : ageNote(ctx.strings, ctx.registry, rec, rec.containerId === 0 ? undefined : it.get(rec.containerId));
            // An enchanted stack carries its suffix (25 § Setting stones): "keen iron ×1".
            // 13 § Rot: a stale stack, or one that rots within `ROT_ALERT_DAYS`, is drawn in the alert colour.
            const outlook = rec === undefined ? null : it.rotOutlook(id);
            const alert = outlook !== null && (outlook.stage >= 1 || (outlook.toRot !== null && outlook.toRot <= ROT_ALERT_DAYS * TICKS_PER_DAY));
            return { id: `item:${id}`, name: `${enchantedName(ctx.readers, id, material)} ×${rec?.count ?? 1}${note === '' ? '' : ` (${note})`}`, children: [], ...(alert ? { alert } : {}) };
          }) });
        }
        return { ...n, children };
      });
    const forest = keep(this.categories());
    const query = this.filter.value.toLowerCase();
    if (query === '') return forest;
    const narrow = (nodes: readonly TreeNode[]): TreeNode[] => nodes.flatMap(n => {
      if (n.name.toLowerCase().includes(query) || (!n.id.includes(':') && n.id.toLowerCase().includes(query))) return [n];
      const children = narrow(n.children);
      return children.length ? [{ ...n, children }] : [];
    });
    return narrow(forest);
  }

  private visible(ctx: PanelContext): string[] {
    const out: string[] = [];
    const walk = (nodes: readonly TreeNode[]): void => {
      for (const n of nodes) {
        out.push(n.id);
        if (this.filter.value !== '' || this.tree.expanded.has(n.id)) walk(n.children);
      }
    };
    walk(this.visibleForest(ctx));
    return out;
  }

  move(delta: number, ctx: PanelContext): void {
    const n = this.visible(ctx).length;
    this.tree.selected = Math.max(0, Math.min(n - 1, this.tree.selected + delta));
  }

  /** `Enter`: expand or collapse the selected node. */
  expand(ctx: PanelContext): void {
    const node = this.selectedNode(ctx);
    if (node === null) return;
    if (this.tree.expanded.has(node)) this.tree.expanded.delete(node);
    else this.tree.expanded.add(node);
  }

  startDepot(depotId: EntityId): void {
    this.depotSelection = depotId;
    this.depotChosen.clear();
  }

  cancelDepot(): void {
    this.depotSelection = 0;
    this.depotChosen.clear();
  }

  /** Eligible stacks under the current tree row, including a single expanded item row. */
  depotChoices(ctx: PanelContext): EntityId[] {
    const node = this.selectedNode(ctx);
    const reader = items(ctx);
    if (!node || !reader) return [];
    const totals = this.totals(ctx);
    const ids = node.startsWith('item:') ? [Number(node.slice(5))]
      : node.startsWith('type:') ? totals.itemIds.get(Number(node.slice(5))) ?? []
        : (totals.types.get(node) ?? []).flatMap((type) => totals.itemIds.get(type) ?? []);
    return ids.filter((id) => {
      const item = reader.get(id);
      return item !== undefined && (item.flags & (ItemFlag.Merchant | ItemFlag.Owned | ItemFlag.Installed | ItemFlag.Forbidden | ItemFlag.AtDepot)) === 0;
    });
  }

  toggleDepot(ctx: PanelContext): void {
    const ids = this.depotChoices(ctx);
    const add = ids.some((id) => !this.depotChosen.has(id));
    for (const id of ids) {
      if (add) this.depotChosen.add(id);
      else this.depotChosen.delete(id);
    }
  }

  confirmDepot(ctx: PanelContext): void {
    if (this.depotSelection && this.depotChosen.size > 0) ctx.submit({ type: 'MoveToDepot', depotId: this.depotSelection, itemIds: [...this.depotChosen] });
    this.cancelDepot();
    ctx.openPanel('depot');
  }

  /**
   * 13 § Rot, the line under the tree for the selected row: a stack's name, stage and days left
   * ("turnip ×20 · stale, rots in 4 days"); a type or category that holds perishable stacks counts
   * the units that rot within `ROT_ALERT_DAYS` ("52 rot within 3 days"); '' for anything else.
   */
  rotLine(ctx: PanelContext): { text: string; alert: boolean } {
    const node = this.selectedNode(ctx);
    const it = items(ctx);
    if (node === null || it === null) return { text: '', alert: false };
    if (node.startsWith('item:')) {
      const id = Number(node.slice(5));
      const rec = it.get(id);
      if (rec === undefined) return { text: '', alert: false };
      const outlook = it.rotOutlook(id);
      const text = rotText(ctx.strings, outlook, it.def(rec.type)?.edible === true);
      const alert = outlook !== null && (outlook.stage >= 1 || (outlook.toRot !== null && outlook.toRot <= ROT_ALERT_DAYS * TICKS_PER_DAY));
      return text === '' ? { text: '', alert: false } : { text: `${this.selectedName(ctx)} · ${text}`, alert };
    }
    const r = this.totals(ctx).rot.get(node);
    if (r === undefined) return { text: '', alert: false };
    return { text: ctx.strings.get('ui.stocks.rot_soon', { n: r.soon, days: ROT_ALERT_DAYS }), alert: r.soon > 0 };
  }

  /** The stacks under the selected row: the stack itself, a type's stacks, or every stack of a category's types. */
  private selectedItems(ctx: PanelContext): EntityId[] {
    const node = this.selectedNode(ctx);
    if (node === null) return [];
    const { types, itemIds } = this.totals(ctx);
    if (node.startsWith('item:')) return [Number(node.slice(5))];
    if (node.startsWith('type:')) return itemIds.get(Number(node.slice(5))) ?? [];
    return (types.get(node) ?? []).flatMap((type) => itemIds.get(type) ?? []);
  }

  /**
   * The line under the rot line, for the selected row: how many of its units can be used now and
   * why the rest cannot, each reason with its units ("Usable 0 of 14: 11 at the depot, 3
   * forbidden"); `alert` when none can. '' when every unit can. Read from the items as they are
   * now, so a forbid made while paused shows at once.
   */
  useLine(ctx: PanelContext): { text: string; alert: boolean } {
    const it = items(ctx);
    if (it === null) return { text: '', alert: false };
    const by: Partial<Record<UnusableReason, number>> = {};
    let n = 0;
    let unusable = 0;
    for (const id of this.selectedItems(ctx)) {
      const rec = it.get(id);
      if (rec === undefined || (rec.flags & ItemFlag.Merchant) !== 0) continue;
      n += rec.count;
      const reason = unusableReason(rec);
      if (reason === null) continue;
      by[reason] = (by[reason] ?? 0) + rec.count;
      unusable += rec.count;
    }
    if (unusable === 0) return { text: '', alert: false };
    const reasons = UNUSABLE_REASONS.filter((reason) => (by[reason] ?? 0) > 0).map((reason) => ctx.strings.get(`ui.stocks.why.${reason}`, { n: by[reason] ?? 0 }));
    return { text: ctx.strings.get('ui.stocks.usable', { usable: n - unusable, n, reasons: reasons.join(', ') }), alert: unusable === n };
  }

  /** The selected row's name as the tree shows it ("Weapons", "sword", "iron ×3"). */
  selectedName(ctx: PanelContext): string {
    const id = this.selectedNode(ctx);
    const find = (nodes: readonly TreeNode[]): string | null => {
      for (const n of nodes) {
        if (n.id === id) return n.name;
        const below = find(n.children);
        if (below !== null) return below;
      }
      return null;
    };
    return id === null ? '' : find(this.visibleForest(ctx)) ?? '';
  }

  /**
   * `[S-f]` / `[S-d]` / `[S-m]`, by key or click: submit the flag for the selected row. Marking for
   * the dump or the smelter asks first (D-U2); clearing a mark and forbidding do not.
   */
  flag(ctx: PanelContext, kind: 'ForbidItem' | 'DumpItem' | 'MeltItem'): void {
    const commands = this.flagCommands(ctx, kind);
    if (commands.length === 0) {
      ctx.notice?.(ctx.strings.get(kind === 'MeltItem' ? 'ui.stocks.no_metal' : 'ui.stocks.nothing_selected'));
      return;
    }
    const send = (): void => { for (const c of commands) ctx.submit(c); };
    if (kind === 'ForbidItem' || !commands.some((c) => c['on'] === true)) send();
    else confirmThen(ctx, kind === 'MeltItem' ? 'c_melt_items' : 'c_dump_items', { what: this.selectedName(ctx) }, send);
  }

  /** `f` / `d` / `m` on the selected node. */
  flagCommands(ctx: PanelContext, kind: 'ForbidItem' | 'DumpItem' | 'MeltItem'): Command[] {
    const node = this.selectedNode(ctx);
    const it = items(ctx);
    if (node === null || it === null) return [];
    const flag = kind === 'ForbidItem' ? ItemFlag.Forbidden : kind === 'DumpItem' ? ItemFlag.Dump : ItemFlag.Melt;
    if (node.startsWith('item:')) {
      const itemId = Number(node.slice(5));
      const rec = it.get(itemId);
      if (rec === undefined || (kind === 'MeltItem' && !this.isMetal(ctx, rec.material))) return [];
      return [{ type: kind, itemId, on: (rec.flags & flag) === 0 }];
    }
    if (node.startsWith('type:')) {
      const type = Number(node.slice(5));
      return this.typeCommands(ctx, kind, type, flag);
    }
    const types = this.totals(ctx).types.get(node) ?? [];
    return types.filter((type) => categoryUnder(it.categoryOf(type), node)).flatMap((type) => this.typeCommands(ctx, kind, type, flag));
  }

  private isMetal(ctx: PanelContext, material: number): boolean {
    return ctx.registry.table<{ id: string; class: string }>('materials').byIndex(material)?.class === 'metal';
  }

  private typeCommands(ctx: PanelContext, kind: 'ForbidItem' | 'DumpItem' | 'MeltItem', type: number, flag: ItemFlag): Command[] {
    const it = items(ctx);
    if (it === null) return [];
    const ids = this.totals(ctx).itemIds.get(type) ?? [];
    const chosen = kind === 'MeltItem' ? ids.filter((id) => this.isMetal(ctx, it.get(id)?.material ?? -1)) : ids;
    if (chosen.length === 0) return [];
    const on = chosen.some((id) => ((it.get(id)?.flags ?? 0) & flag) === 0);
    if (chosen.length === ids.length) return [{ type: kind, typeId: type, on }];
    return chosen.map((itemId) => ({ type: kind, itemId, on }));
  }
}

export function drawStocksPanel(s: Surface, rect: Rect, panel: StocksPanel, ctx: PanelContext): void {
  const t = s.theme;
  const strings = ctx.strings;
  const { totals } = panel.totals(ctx);
  drawPanelFilter(s, rect.col + 1, rect.row, rect.cols - 2, panel.filter, ctx);
  // Under the tree: the rot line, the usable line (two rows), the wealth and two rows of actions.
  const height = Math.max(1, rect.rows - 4 - 1 - STOCKS_USE_ROWS);
  const state = panel.filter.value === '' ? panel.tree : { ...panel.tree, expanded: new Set<string>() };
  if (panel.filter.value !== '') {
    const expand = (nodes: readonly TreeNode[]): void => { for (const n of nodes) { state.expanded.add(n.id); expand(n.children); } };
    expand(panel.visibleForest(ctx));
  }
  tree(
    s,
    { col: rect.col + 1, row: rect.row + 1, cols: rect.cols - 2, rows: height },
    panel.visibleForest(ctx),
    state,
    null,
    { select: (index) => { panel.tree.selected = index; } },
    (n) => {
      const it = items(ctx);
      const v = n.id.startsWith('item:') && it !== null
        ? { count: it.get(Number(n.id.slice(5)))?.count ?? 0, value: it.value(Number(n.id.slice(5))) }
        : n.id.startsWith('type:') && it !== null
          ? (panel.totals(ctx).itemIds.get(Number(n.id.slice(5))) ?? []).reduce((sum, id) => ({ count: sum.count + (it.get(id)?.count ?? 0), value: sum.value + it.value(id) }), { count: 0, value: 0 })
          : totals.get(n.id) ?? { count: 0, value: 0 };
      return `${String(v.count).padStart(5)} ${marks(v.value).padStart(9)}`;
    },
  );
  panel.tree.selected = state.selected;
  panel.tree.scroll = state.scroll;
  let row = rect.row + 1 + height;
  const rot = panel.rotLine(ctx);
  label(s, rect.col + 1, row, rot.text, { fg: rot.alert ? t.alert : t.dim, width: rect.cols - 2 });
  row += 1;
  // 13's available count, beside the stock: what of the row a build or an order can have now, and why not the rest.
  const use = panel.useLine(ctx);
  const useRows = use.text === '' ? [] : wrapHang(use.text, rect.cols - 2, 2);
  for (let k = 0; k < STOCKS_USE_ROWS; k += 1) {
    const last = k === STOCKS_USE_ROWS - 1;
    const text = last ? useRows.slice(k).map((part, n) => (n === 0 ? part : part.trim())).join(' ') : useRows[k] ?? '';
    // A longer line ends its last row with `»`, the rest of it in the tooltip.
    label(s, rect.col + 1, row, text, { fg: use.alert ? t.alert : t.dim, width: rect.cols - 2, keys: false });
    row += 1;
  }
  const it = items(ctx);
  const b = buildings(ctx);
  let built = 0;
  if (b !== null) for (const id of ctx.readers.entities.with(C.Building)) built += b.value(id as EntityId);
  label(s, rect.col + 1, row, strings.get('ui.stocks.wealth', { wealth: marks(it?.wealth() ?? 0), buildings: marks(built) }), { fg: t.value, width: rect.cols - 2 });
  row += 1;
  if (panel.depotSelection) {
    label(s, rect.col + 1, row, strings.get('ui.stocks.depot_pick', { n: panel.depotChosen.size }), { fg: t.key, width: rect.cols - 2 });
    s.hit({ col: rect.col + 1, row, cols: rect.cols - 2, rows: 1 }, () => panel.confirmDepot(ctx));
    return;
  }
  // `f`, `d`, `m` and `t` open panels, so the actions take `Shift` (D-U2); each is clickable.
  let col = rect.col + 1;
  const action = (key: string, kind: 'ForbidItem' | 'DumpItem' | 'MeltItem'): void => {
    const n = label(s, col, row, strings.get(key), { width: rect.col + rect.cols - 1 - col });
    s.hit({ col, row, cols: n, rows: 1 }, () => panel.flag(ctx, kind));
    col += n + 2;
  };
  action('ui.stocks.forbid', 'ForbidItem');
  action('ui.stocks.dump', 'DumpItem');
  row += 1;
  if (row >= rect.row + rect.rows) return;
  col = rect.col + 1;
  action('ui.stocks.melt', 'MeltItem');
  const n = label(s, col, row, strings.get('ui.stocks.to_depot'), { fg: buildings(ctx)?.depots().length ? t.text : t.dim, width: rect.col + rect.cols - 1 - col });
  s.hit({ col, row, cols: n, rows: 1 }, () => {
    const depotId = buildings(ctx)?.depots()[0] ?? 0;
    if (depotId) panel.startDepot(depotId);
    else ctx.notice?.(strings.get('ui.status.no_depot'));
  });
}
