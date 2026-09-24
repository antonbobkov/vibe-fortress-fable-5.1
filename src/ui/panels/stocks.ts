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
  private cache: { tick: number; totals: Map<string, NodeTotals>; types: Map<string, number[]>; itemIds: Map<number, EntityId[]> } | null = null;

  categories(): TreeNode[] {
    if (this.forest === null) this.forest = buildTree(CATEGORY_TREE);
    return this.forest;
  }

  /** Count and value per node, from the items (cached per tick). */
  totals(ctx: PanelContext): { totals: Map<string, NodeTotals>; types: Map<string, number[]>; itemIds: Map<number, EntityId[]> } {
    const tick = ctx.readers.calendar.tick;
    if (this.cache?.tick === tick) return this.cache;
    const it = items(ctx);
    const totals = new Map<string, NodeTotals>();
    const types = new Map<string, number[]>();
    const itemIds = new Map<number, EntityId[]>();
    if (it !== null) {
      for (const id of ctx.readers.entities.with(C.Item)) {
        const rec = it.get(id as EntityId);
        if (rec === undefined || (rec.flags & ItemFlag.Merchant) !== 0) continue;
        const ids = itemIds.get(rec.type) ?? [];
        ids.push(id as EntityId);
        itemIds.set(rec.type, ids);
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
    this.cache = { tick, totals, types, itemIds };
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
            const material = rec === undefined ? '?' : ctx.registry.table<{ id: string; name: string }>('materials').byIndex(rec.material)?.name ?? '?';
            return { id: `item:${id}`, name: `${material} #${id}`, children: [] };
          }) });
        }
        return { ...n, children };
      });
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
  const height = Math.max(1, rect.rows - 3);
  tree(
    s,
    { col: rect.col + 1, row: rect.row, cols: rect.cols - 2, rows: height },
    panel.visibleForest(ctx),
    panel.tree,
    null,
    {},
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
  let row = rect.row + height;
  const it = items(ctx);
  const b = buildings(ctx);
  let built = 0;
  if (b !== null) for (const id of ctx.readers.entities.with(C.Building)) built += b.value(id as EntityId);
  label(s, rect.col + 1, row, strings.get('ui.stocks.wealth', { wealth: marks(it?.wealth() ?? 0), buildings: marks(built) }), { fg: t.value, width: rect.cols - 2 });
  row += 1;
  label(s, rect.col + 1, row, strings.get('ui.stocks.actions'), { width: rect.cols - 2 });
  label(s, rect.col + 24, row, '[t] depot', { fg: t.dim, width: rect.cols - 25 });
  const act = (col: number, width: number, kind: 'ForbidItem' | 'DumpItem' | 'MeltItem'): void =>
    s.hit({ col: rect.col + 1 + col, row, cols: width, rows: 1 }, () => {
      for (const c of panel.flagCommands(ctx, kind)) ctx.submit(c);
    });
  act(0, 8, 'ForbidItem');
  act(9, 6, 'DumpItem');
  act(16, 6, 'MeltItem');
}
