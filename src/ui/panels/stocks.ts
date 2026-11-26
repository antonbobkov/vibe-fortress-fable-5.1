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
import { ROT_ALERT_DAYS, STOCKS_PLAIN_QUALITY, STOCKS_USE_ROWS } from '../constants';

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

/** 13's soil node: soil loads, which Stocks shows as a row of their own (`STOCKS_SOIL`). */
const SOIL_NODE = 'stone/soil';
/** The top-level row Stocks files soil loads under, so the stone row counts only what a mason can cut. */
export const STOCKS_SOIL = 'soil';

/** The row a category path files under in Stocks (`panels.md` § Stocks): 13's, with soil loads lifted out of stone. */
export function stocksCategory(category: string): string {
  return category === SOIL_NODE || category.startsWith(`${SOIL_NODE}/`) ? `${STOCKS_SOIL}${category.slice(SOIL_NODE.length)}` : category;
}

/** The id prefix of a row of like stacks under a type: `stacks:<type>:<what they share>`. */
const STACKS_ROW = 'stacks:';

/** The category a category's pick for the depot leaves behind unless its row lies under it: rotten food, corpses, skeletons, parts (`panels.md` § Stocks). */
const DEPOT_SKIPS = 'refuse';

/** Whether a row is a stack or a row of like stacks, which a filter matches only by its material. */
function isStackRow(id: string): boolean {
  return id.startsWith('item:') || id.startsWith(STACKS_ROW);
}

/** The marks that keep a stack on a row apart from unmarked ones (`panels.md` § Stocks). */
const STACK_MARKS = ItemFlag.Forbidden | ItemFlag.Dump | ItemFlag.Melt;

/**
 * What stacks of one type that read alike share: their name as the row writes it (the material,
 * its cellar stage and years, an enchantment), quality, rot stage and alert colour, and the forbid,
 * dump and melt marks.
 */
function stackKey(rec: { material: number; quality: number; rotStage: number; flags: number }, label: string, alert: boolean): string {
  return `${rec.material}.${rec.quality}.${rec.rotStage}.${alert ? 1 : 0}.${rec.flags & STACK_MARKS}.${label}`;
}

/** A stack's quality as a Stocks row names it (12's tier, as Look words it); '' for the plain tier, which goes unnamed. */
function qualityWord(ctx: PanelContext, quality: number): string {
  return quality === STOCKS_PLAIN_QUALITY ? '' : ctx.strings.get(`ui.item.quality.${quality}`);
}

/** A type's row, whose stack rows are built the first time they are read and kept. */
function lazyNode(id: string, name: string, open: boolean, build: () => TreeNode[]): TreeNode {
  let built: TreeNode[] | null = null;
  return { id, name, openable: open, get children(): TreeNode[] { return (built ??= build()); } };
}

export class StocksPanel {
  readonly tree: TreeState = { selected: 0, scroll: 0, expanded: new Set<string>() };
  readonly filter = new PanelFilter();
  depotSelection = 0;
  readonly depotChosen = new Set<EntityId>();
  /** The rot a pick of a category left behind, for the pick's count ("12 rotten left"). */
  readonly depotLeft = new Set<EntityId>();
  private forest: TreeNode[] | null = null;
  private cache: { tick: number; totals: Map<string, NodeTotals>; types: Map<string, number[]>; itemIds: Map<number, EntityId[]>; rot: Map<string, NodeRot> } | null = null;
  private forestCache: { totals: object; query: string; forest: TreeNode[] } | null = null;
  /** The stacks of each row of like stacks in the current forest, filled as its types are opened. */
  private readonly stackGroups = new Map<string, EntityId[]>();

  categories(): TreeNode[] {
    // The soil row comes right after stone, whose other rows its path order keeps together.
    if (this.forest === null) this.forest = buildTree(CATEGORY_TREE.map(stocksCategory));
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
    // Per type, the rows its stacks count toward: its category and every category above it, the
    // path worked out once per type rather than once per stack.
    const pathOf = new Map<number, { nodes: string[]; rotNodes: string[] }>();
    if (it !== null) {
      for (const id of ctx.readers.entities.with(C.Item)) {
        const rec = it.get(id as EntityId);
        if (rec === undefined || (rec.flags & ItemFlag.Merchant) !== 0) continue;
        let ids = itemIds.get(rec.type);
        if (ids === undefined) { ids = []; itemIds.set(rec.type, ids); }
        ids.push(id as EntityId);
        let path = pathOf.get(rec.type);
        if (path === undefined) {
          const parts = stocksCategory(it.categoryOf(rec.type)).split('/');
          const nodes = parts.map((_, k) => parts.slice(0, k + 1).join('/'));
          path = { nodes, rotNodes: [`type:${rec.type}`, ...nodes] };
          pathOf.set(rec.type, path);
          for (const node of nodes) {
            const list = types.get(node);
            if (list === undefined) types.set(node, [rec.type]);
            else list.push(rec.type);
          }
        }
        // A perishable stack not yet rotting counts toward every row above it.
        const outlook = rec.rotStage >= 2 ? null : it.rotOutlook(id as EntityId);
        if (outlook !== null) {
          const soon = outlook.toRot !== null && outlook.toRot <= within ? rec.count : 0;
          for (const node of path.rotNodes) {
            const r = rot.get(node);
            if (r === undefined) rot.set(node, { soon });
            else r.soon += soon;
          }
        }
        const value = it.value(id as EntityId);
        for (const node of path.nodes) {
          const t = totals.get(node);
          if (t === undefined) totals.set(node, { count: rec.count, value });
          else { t.count += rec.count; t.value += value; }
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

  /**
   * The rows the tree shows: stocked categories, then types, then individual stacks. Built once a
   * tick and filter, as one frame asks for the tree several times (the selection, the rot and usable
   * lines, the drawing); a type's stacks, with 25,000 items as many rows, are built only when the
   * type is opened or a filter reads them.
   */
  visibleForest(ctx: PanelContext): TreeNode[] {
    const totals = this.totals(ctx);
    const query = this.filter.value.toLowerCase();
    if (this.forestCache !== null && this.forestCache.totals === totals && this.forestCache.query === query) return this.forestCache.forest;
    this.stackGroups.clear();
    const forest = this.buildForest(ctx, totals, query);
    this.forestCache = { totals, query, forest };
    return forest;
  }

  private buildForest(ctx: PanelContext, { totals, types, itemIds }: ReturnType<StocksPanel['totals']>, query: string): TreeNode[] {
    const it = items(ctx);
    const keep = (nodes: readonly TreeNode[]): TreeNode[] =>
      nodes.filter((n) => (totals.get(n.id)?.count ?? 0) > 0).map((n) => {
        const children = keep(n.children);
        if (it !== null) for (const type of types.get(n.id) ?? []) {
          if (stocksCategory(it.categoryOf(type)) !== n.id) continue;
          const stacks = itemIds.get(type) ?? [];
          children.push(lazyNode(`type:${type}`, it.def(type)?.name ?? String(type), stacks.length > 0, () => this.stackRows(ctx, type, stacks)));
        }
        return { ...n, children };
      });
    const forest = keep(this.categories());
    if (query === '') return forest;
    // A row whose own name or path matches keeps everything under it. A category or type that
    // matches, or holds one that does, is listed before one that holds only stacks whose material
    // matches, so `bar` shows the bars before the barley seed.
    const narrow = (nodes: readonly TreeNode[]): Array<{ node: TreeNode; strong: boolean }> => {
      const kept = nodes.flatMap((n) => {
        if (n.name.toLowerCase().includes(query) || (!n.id.includes(':') && n.id.toLowerCase().includes(query))) return [{ node: n, strong: !isStackRow(n.id) }];
        const children = narrow(n.children);
        return children.length ? [{ node: { ...n, children: children.map((c) => c.node) }, strong: children.some((c) => c.strong) }] : [];
      });
      return [...kept.filter((k) => k.strong), ...kept.filter((k) => !k.strong)];
    };
    return narrow(forest).map((k) => k.node);
  }

  /**
   * A type's rows: its stacks, those that read alike (`stackKey`) as one row with their units,
   * which opens to them, and a stack unlike the others as a row of its own; each in the place of
   * its first stack.
   */
  private stackRows(ctx: PanelContext, type: number, stacks: readonly EntityId[]): TreeNode[] {
    const it = items(ctx);
    if (it === null) return [];
    const groups = new Map<string, { name: string; alert: boolean; rows: TreeNode[]; ids: EntityId[] }>();
    const quality = it.def(type)?.quality === true;
    for (const id of stacks) {
      const rec = it.get(id);
      const plain = rec === undefined ? '?' : ctx.registry.table<{ id: string; name: string }>('materials').byIndex(rec.material)?.name ?? '?';
      // 13 § Aging in a cellar: an aged stack names its stage and its years ("aged bellwine ×20 (aged, 1 year in the cellar)").
      const material = agedMaterial(ctx.strings, plain, rec?.age);
      const note = rec === undefined ? '' : ageNote(ctx.strings, ctx.registry, rec, rec.containerId === 0 ? undefined : it.get(rec.containerId));
      // An enchanted stack carries its suffix (25 § Setting stones): "keen iron ×1"; a stack of a type
      // with quality names its tier first, unless it is the plain one ("fine steel ×1", "steel ×1").
      const enchanted = enchantedName(ctx.readers, id, material);
      const tier = rec === undefined || !quality ? '' : qualityWord(ctx, rec.quality);
      const name = tier === '' ? enchanted : ctx.strings.get('ui.stocks.quality_name', { quality: tier, name: enchanted });
      // 13 § Rot: a stale stack, or one that rots within `ROT_ALERT_DAYS`, is drawn in the alert colour.
      const outlook = rec === undefined ? null : it.rotOutlook(id);
      const alert = outlook !== null && (outlook.stage >= 1 || (outlook.toRot !== null && outlook.toRot <= ROT_ALERT_DAYS * TICKS_PER_DAY));
      const label = note === '' ? name : `${name} (${note})`;
      // The units are in the count column too: a row too narrow for them drops them from its name.
      const row = { id: `item:${id}`, name: `${name} ×${rec?.count ?? 1}${note === '' ? '' : ` (${note})`}`, short: label, children: [], ...(alert ? { alert } : {}) };
      const key = rec === undefined ? `${id}` : stackKey(rec, label, alert);
      const group = groups.get(key);
      if (group === undefined) groups.set(key, { name: label, alert, rows: [row], ids: [id] });
      else { group.rows.push(row); group.ids.push(id); }
    }
    return Array.from(groups, ([key, group]): TreeNode => {
      if (group.rows.length === 1) return group.rows[0] as TreeNode;
      const id = `${STACKS_ROW}${type}:${key}`;
      this.stackGroups.set(id, group.ids);
      return { id, name: group.name, children: group.rows, ...(group.alert ? { alert: true } : {}) };
    });
  }

  /** Whether a row is open: under a filter every row but a row of like stacks is, unless the player opened it. */
  opens(id: string): boolean {
    return this.tree.expanded.has(id) || (this.filter.value !== '' && !id.startsWith(STACKS_ROW));
  }

  private visible(ctx: PanelContext): string[] {
    const out: string[] = [];
    const walk = (nodes: readonly TreeNode[]): void => {
      for (const n of nodes) {
        out.push(n.id);
        if (this.opens(n.id)) walk(n.children);
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
    this.depotLeft.clear();
  }

  cancelDepot(): void {
    this.depotSelection = 0;
    this.depotChosen.clear();
    this.depotLeft.clear();
  }

  /** The stacks under the current tree row that may go to the depot, including a single expanded item row. */
  private depotEligible(ctx: PanelContext): EntityId[] {
    const node = this.selectedNode(ctx);
    const reader = items(ctx);
    if (!node || !reader) return [];
    return this.rowItems(ctx, node).filter((id) => {
      const item = reader.get(id);
      return item !== undefined && (item.flags & (ItemFlag.Merchant | ItemFlag.Owned | ItemFlag.Installed | ItemFlag.Forbidden | ItemFlag.AtDepot)) === 0;
    });
  }

  /**
   * Whether a stack is rot a pick of the current row leaves behind: under a category row that does
   * not lie under refuse itself, refuse (rotten food, a corpse) and a stack that has begun to rot
   * (stale: it would rot at the depot). A type's row, a stack's and a row of like stacks name their
   * goods, and take them.
   */
  private depotSkips(ctx: PanelContext, id: EntityId): boolean {
    const node = this.selectedNode(ctx);
    if (node === null || node.startsWith('item:') || node.startsWith(STACKS_ROW) || node.startsWith('type:')) return false;
    if (categoryUnder(node, DEPOT_SKIPS)) return false;
    const reader = items(ctx);
    const rec = reader?.get(id);
    if (rec === undefined) return false;
    const category = reader?.def(rec.type)?.category;
    return rec.rotStage >= 1 || (category !== undefined && categoryUnder(category, DEPOT_SKIPS));
  }

  /** Eligible stacks under the current tree row, less the refuse a category's pick leaves behind. */
  depotChoices(ctx: PanelContext): EntityId[] {
    return this.depotEligible(ctx).filter((id) => !this.depotSkips(ctx, id));
  }

  toggleDepot(ctx: PanelContext): void {
    const ids = this.depotChoices(ctx);
    const left = this.depotEligible(ctx).filter((id) => this.depotSkips(ctx, id));
    const add = ids.some((id) => !this.depotChosen.has(id)) || (ids.length === 0 && left.some((id) => !this.depotLeft.has(id)));
    for (const id of ids) {
      if (add) this.depotChosen.add(id);
      else this.depotChosen.delete(id);
    }
    for (const id of left) {
      if (add) this.depotLeft.add(id);
      else this.depotLeft.delete(id);
    }
  }

  /** The pick's count: the units chosen, and the units of rot its categories left behind and nothing chose. */
  depotUnits(ctx: PanelContext): { n: number; left: number } {
    const reader = items(ctx);
    const units = (ids: Iterable<EntityId>): number => {
      let n = 0;
      for (const id of ids) n += reader?.get(id)?.count ?? 0;
      return n;
    };
    return { n: units(this.depotChosen), left: units(Array.from(this.depotLeft).filter((id) => !this.depotChosen.has(id))) };
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
      // A stack is named whole, with its quality and units, which its row may have had to leave out or cut.
      return text === '' ? { text: this.selectedName(ctx), alert: false } : { text: `${this.selectedName(ctx)} · ${text}`, alert };
    }
    if (node.startsWith(STACKS_ROW)) {
      // A row of like stacks says how many stacks it holds, and, of perishable ones, the units that rot soon.
      const ids = this.stackGroups.get(node) ?? [];
      let perishable = false;
      let soon = 0;
      for (const id of ids) {
        const rec = it.get(id);
        const outlook = rec === undefined || rec.rotStage >= 2 ? null : it.rotOutlook(id);
        if (rec === undefined || outlook === null) continue;
        perishable = true;
        if (outlook.toRot !== null && outlook.toRot <= ROT_ALERT_DAYS * TICKS_PER_DAY) soon += rec.count;
      }
      // Of a type with quality, the stacks' tier, which a deep row's name may not hold: "fine · 2 stacks".
      const first = it.get(ids[0] ?? 0);
      const tier = first !== undefined && it.def(first.type)?.quality === true ? qualityWord(ctx, first.quality) : '';
      const count = ctx.strings.get('ui.stocks.stacks', { n: ids.length });
      const stacks = tier === '' ? count : ctx.strings.get('ui.stocks.stacks_quality', { stacks: count, quality: tier });
      if (!perishable) return { text: stacks, alert: false };
      return { text: ctx.strings.get('ui.stocks.stacks_rot', { stacks, rot: ctx.strings.get('ui.stocks.rot_soon', { n: soon, days: ROT_ALERT_DAYS }) }), alert: soon > 0 };
    }
    const r = this.totals(ctx).rot.get(node);
    if (r === undefined) return { text: '', alert: false };
    return { text: ctx.strings.get('ui.stocks.rot_soon', { n: r.soon, days: ROT_ALERT_DAYS }), alert: r.soon > 0 };
  }

  /** The stacks under the selected row. */
  private selectedItems(ctx: PanelContext): EntityId[] {
    const node = this.selectedNode(ctx);
    return node === null ? [] : this.rowItems(ctx, node);
  }

  /** The stacks under a row: the stack itself, a row of like stacks, a type's stacks, or every stack of a category's types. */
  rowItems(ctx: PanelContext, node: string): EntityId[] {
    const { types, itemIds } = this.totals(ctx);
    if (node.startsWith('item:')) return [Number(node.slice(5))];
    if (node.startsWith(STACKS_ROW)) return this.stackGroups.get(node) ?? [];
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
    // The selected row is a visible one: look under open rows only, as the stacks of a closed type are not built.
    const find = (nodes: readonly TreeNode[]): string | null => {
      for (const n of nodes) {
        if (n.id === id) return n.name;
        if (!this.opens(n.id)) continue;
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
    if (node.startsWith(STACKS_ROW)) {
      // A row of like stacks acts on each of its stacks, turning the mark on unless all carry it.
      const chosen = (this.stackGroups.get(node) ?? []).filter((id) => {
        const rec = it.get(id);
        return rec !== undefined && (kind !== 'MeltItem' || this.isMetal(ctx, rec.material));
      });
      const on = chosen.some((id) => ((it.get(id)?.flags ?? 0) & flag) === 0);
      return chosen.map((itemId) => ({ type: kind, itemId, on }));
    }
    if (node.startsWith('type:')) {
      const type = Number(node.slice(5));
      return this.typeCommands(ctx, kind, type, flag);
    }
    const types = this.totals(ctx).types.get(node) ?? [];
    return types.filter((type) => categoryUnder(stocksCategory(it.categoryOf(type)), node)).flatMap((type) => this.typeCommands(ctx, kind, type, flag));
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

/**
 * The wealth line, `Wealth 18,450 ☼   (buildings 3,200 ☼)`; when it is wider than the panel, the
 * buildings' part goes to a second row, indented two cells.
 */
export function wealthLines(ctx: PanelContext, width: number): string[] {
  const b = buildings(ctx);
  let built = 0;
  if (b !== null) for (const id of ctx.readers.entities.with(C.Building)) built += b.value(id as EntityId);
  const wealth = ctx.strings.get('ui.stocks.wealth', { wealth: marks(items(ctx)?.wealth() ?? 0) });
  const parts = ctx.strings.get('ui.stocks.wealth_buildings', { buildings: marks(built) });
  const one = `${wealth}   ${parts}`;
  return Array.from(one).length <= width ? [one] : [wealth, `  ${parts}`];
}

export function drawStocksPanel(s: Surface, rect: Rect, panel: StocksPanel, ctx: PanelContext): void {
  const t = s.theme;
  const strings = ctx.strings;
  const { totals } = panel.totals(ctx);
  drawPanelFilter(s, rect.col + 1, rect.row, rect.cols - 2, panel.filter, ctx);
  // Under the tree: the line about the selected row (wrapped, the tree giving up its rows), the usable
  // line (two rows), the wealth (wrapped) and two rows of actions.
  const wealth = wealthLines(ctx, rect.cols - 2);
  const rot = panel.rotLine(ctx);
  const rotRows = rot.text === '' ? [''] : wrapHang(rot.text, rect.cols - 2, 2);
  const height = Math.max(1, rect.rows - 3 - rotRows.length - wealth.length - STOCKS_USE_ROWS);
  const state = panel.filter.value === '' ? panel.tree : { ...panel.tree, expanded: new Set<string>() };
  if (panel.filter.value !== '') {
    // A filter opens the rows down to the rows of like stacks; one of those opens when the player opens it.
    const expand = (nodes: readonly TreeNode[]): void => {
      for (const n of nodes) {
        if (n.children.length === 0 || !panel.opens(n.id)) continue;
        state.expanded.add(n.id);
        expand(n.children);
      }
    };
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
      const v = isStackRow(n.id) || n.id.startsWith('type:')
        ? panel.rowItems(ctx, n.id).reduce((sum, id) => ({ count: sum.count + (it?.get(id)?.count ?? 0), value: sum.value + (it?.value(id) ?? 0) }), { count: 0, value: 0 })
        : totals.get(n.id) ?? { count: 0, value: 0 };
      return `${v.count.toLocaleString('en-US').padStart(6)} ${marks(v.value).padStart(8)}`;
    },
  );
  panel.tree.selected = state.selected;
  panel.tree.scroll = state.scroll;
  let row = rect.row + 1 + height;
  for (const line of rotRows) {
    label(s, rect.col + 1, row, line, { fg: rot.alert ? t.alert : t.dim, width: rect.cols - 2 });
    row += 1;
  }
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
  for (const line of wealth) {
    label(s, rect.col + 1, row, line, { fg: t.value, width: rect.cols - 2 });
    row += 1;
  }
  if (panel.depotSelection) {
    const pick = panel.depotUnits(ctx);
    label(s, rect.col + 1, row, strings.get(pick.left > 0 ? 'ui.stocks.depot_pick_left' : 'ui.stocks.depot_pick', pick), { fg: t.key, width: rect.cols - 2 });
    s.hit({ col: rect.col + 1, row, cols: rect.cols - 2, rows: 1 }, () => panel.confirmDepot(ctx));
    return;
  }
  // Forbid and to depot are bare letters, dump and melt stay on `Shift` (D-253); each is clickable.
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
