/**
 * The stocks panel: `ui-screens/panels.md` § Stocks and `13` § Player-facing behavior ("Stocks
 * panel (hotkey `s`): the category tree with counts, values and material breakdown; forbid, dump,
 * melt actions apply to the selected category"). `[t]o depot` belongs to trade (M7) and is dim.
 *
 * A node's count and value sum the stocked types whose category lies under it; `f`, `d` and `m`
 * submit `ForbidItem`/`DumpItem`/`MeltItem` by `typeId` for each of them, turning the flag on
 * unless every item there already carries it (D-077).
 */

import { C, ItemFlag } from '@core/components';
import type { Command } from '@core/commands';
import type { EntityId } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import { CATEGORY_TREE, categoryUnder } from '@systems/items';
import type { Surface } from '../surface';
import { buildTree, label, tree, type TreeNode, type TreeState } from '../widgets';
import { buildings, items, marks, type PanelContext } from './context';

interface NodeTotals {
  count: number;
  value: number;
}

export class StocksPanel {
  readonly tree: TreeState = { selected: 0, scroll: 0, expanded: new Set<string>() };
  private forest: TreeNode[] | null = null;
  private cache: { tick: number; totals: Map<string, NodeTotals>; types: Map<string, number[]> } | null = null;

  categories(): TreeNode[] {
    if (this.forest === null) this.forest = buildTree(CATEGORY_TREE);
    return this.forest;
  }

  /** Count and value per node, from the items (cached per tick). */
  totals(ctx: PanelContext): { totals: Map<string, NodeTotals>; types: Map<string, number[]> } {
    const tick = ctx.readers.calendar.tick;
    if (this.cache?.tick === tick) return this.cache;
    const it = items(ctx);
    const totals = new Map<string, NodeTotals>();
    const types = new Map<string, number[]>();
    if (it !== null) {
      for (const id of ctx.readers.entities.with(C.Item)) {
        const rec = it.get(id as EntityId);
        if (rec === undefined || (rec.flags & ItemFlag.Merchant) !== 0) continue;
        const cat = it.categoryOf(rec.type);
        const parts = cat.split('/');
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
    this.cache = { tick, totals, types };
    return this.cache;
  }

  selectedNode(ctx: PanelContext): string | null {
    const rows = this.visible(ctx);
    return rows[this.tree.selected] ?? null;
  }

  /** The rows the tree shows: only nodes with stock. */
  visibleForest(ctx: PanelContext): TreeNode[] {
    const { totals } = this.totals(ctx);
    const keep = (nodes: readonly TreeNode[]): TreeNode[] =>
      nodes.filter((n) => (totals.get(n.id)?.count ?? 0) > 0).map((n) => ({ ...n, children: keep(n.children) }));
    return keep(this.categories());
  }

  private visible(ctx: PanelContext): string[] {
    const out: string[] = [];
    const walk = (nodes: readonly TreeNode[]): void => {
      for (const n of nodes) {
        out.push(n.id);
        if (this.tree.expanded.has(n.id)) walk(n.children);
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

  /** `f` / `d` / `m` on the selected node. */
  flagCommands(ctx: PanelContext, kind: 'ForbidItem' | 'DumpItem' | 'MeltItem'): Command[] {
    const node = this.selectedNode(ctx);
    const it = items(ctx);
    if (node === null || it === null) return [];
    const flag = kind === 'ForbidItem' ? ItemFlag.Forbidden : kind === 'DumpItem' ? ItemFlag.Dump : ItemFlag.Melt;
    const types = this.totals(ctx).types.get(node) ?? [];
    let all = true;
    for (const id of ctx.readers.entities.with(C.Item)) {
      const rec = it.get(id as EntityId);
      if (rec === undefined || !types.includes(rec.type) || !categoryUnder(it.categoryOf(rec.type), node)) continue;
      if ((rec.flags & flag) === 0) all = false;
    }
    let chosen = types;
    // "melt only metal items": melting is offered for the metal-made types only.
    if (kind === 'MeltItem') chosen = types.filter((t) => this.metalOnly(ctx, t));
    return chosen.map((t) => ({ type: kind, typeId: t, on: !all }));
  }

  private metalOnly(ctx: PanelContext, type: number): boolean {
    const it = items(ctx);
    if (it === null) return false;
    const materials = ctx.registry.table<{ id: string; class: string }>('materials');
    for (const id of ctx.readers.entities.with(C.Item)) {
      const rec = it.get(id as EntityId);
      if (rec === undefined || rec.type !== type) continue;
      if (materials.byIndex(rec.material)?.class !== 'metal') return false;
    }
    return true;
  }
}

export function drawStocksPanel(s: Surface, rect: Rect, panel: StocksPanel, ctx: PanelContext): void {
  const t = s.theme;
  const strings = ctx.strings;
  const { totals } = panel.totals(ctx);
  const height = Math.max(1, rect.rows - 3);
  tree(
    s,
    { col: rect.col + 1, row: rect.row, cols: rect.cols - 2, rows: height },
    panel.visibleForest(ctx),
    panel.tree,
    null,
    {},
    (n) => {
      const v = totals.get(n.id) ?? { count: 0, value: 0 };
      return `${String(v.count).padStart(5)} ${marks(v.value).padStart(9)}`;
    },
  );
  let row = rect.row + height;
  const it = items(ctx);
  const b = buildings(ctx);
  let built = 0;
  if (b !== null) for (const id of ctx.readers.entities.with(C.Building)) built += b.value(id as EntityId);
  label(s, rect.col + 1, row, strings.get('ui.stocks.wealth', { wealth: marks(it?.wealth() ?? 0), buildings: marks(built) }), { fg: t.value, width: rect.cols - 2 });
  row += 1;
  label(s, rect.col + 1, row, strings.get('ui.stocks.actions'), { width: rect.cols - 2 });
  const act = (col: number, width: number, kind: 'ForbidItem' | 'DumpItem' | 'MeltItem'): void =>
    s.hit({ col: rect.col + 1 + col, row, cols: width, rows: 1 }, () => {
      for (const c of panel.flagCommands(ctx, kind)) ctx.submit(c);
    });
  act(0, 8, 'ForbidItem');
  act(9, 6, 'DumpItem');
  act(16, 6, 'MeltItem');
}
