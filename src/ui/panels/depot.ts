/** The selected trade depot's stock and actions (T-M7-03). */
import type { EntityId, TileIndex } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { TradeReader } from '@systems/trade';
import type { ItemsReader } from '@systems/items';
import { brokerOnWay, buildingName, caravanUnreachable, materialItemName, tradeBlocked, tradeWait, unreachableFrom, wrapHang } from '../messages';
import { DEPOT_WARNING_ROWS } from '../constants';
import type { Surface } from '../surface';
import { label, type ListState, clampList } from '../widgets';
import { buildings, type PanelContext } from './context';

/** One row of the depot's list: the stacks of one item type, material and quality, counted together. */
export interface DepotRow {
  readonly ids: readonly EntityId[];
  readonly type: number;
  readonly material: number;
  readonly quality: number;
  readonly count: number;
  readonly value: number;
}

export class DepotPanel {
  depotId: EntityId = 0;
  readonly list: ListState = { selected: 0, scroll: 0 };

  select(ctx: PanelContext, id: EntityId): void {
    if (buildings(ctx)?.depots().includes(id)) this.depotId = id;
  }

  selectedDepot(ctx: PanelContext): EntityId {
    const depots = buildings(ctx)?.depots() ?? [];
    return depots.includes(this.depotId) ? this.depotId : depots[0] ?? 0;
  }

  items(ctx: PanelContext): EntityId[] {
    if (!ctx.readers.has('20')) return [];
    const id = this.selectedDepot(ctx);
    const trade = ctx.readers.of<TradeReader>('20');
    const items = ctx.readers.of<ItemsReader>('13');
    return trade.depotItems().filter((itemId) => items.get(itemId)?.containerId === id);
  }

  /**
   * The goods at the depot grouped as the trade session's merchant column groups them: one row per
   * item type, material and quality, its count and value summed, in the order the first stack comes.
   */
  rows(ctx: PanelContext): DepotRow[] {
    const items = ctx.readers.of<ItemsReader>('13');
    const trade = ctx.readers.has('20') ? ctx.readers.of<TradeReader>('20') : null;
    const civ = trade?.activeCaravan()?.civ;
    const groups = new Map<string, { ids: EntityId[]; type: number; material: number; quality: number; count: number; value: number }>();
    for (const id of this.items(ctx)) {
      const item = items.get(id);
      if (!item) continue;
      const value = civ !== undefined && trade !== null ? trade.valuation(civ, id) : items.value(id);
      const key = `${item.type}:${item.material}:${item.quality}`;
      const group = groups.get(key);
      if (group === undefined) groups.set(key, { ids: [id], type: item.type, material: item.material, quality: item.quality, count: item.count, value });
      else { group.ids.push(id); group.count += item.count; group.value += value; }
    }
    return [...groups.values()];
  }

  move(delta: number, ctx: PanelContext): void {
    this.list.selected = Math.max(0, Math.min(this.rows(ctx).length - 1, this.list.selected + delta));
  }

  /** `[r] remove`: the selected row's stacks, all of them. */
  remove(ctx: PanelContext): void {
    const row = this.rows(ctx)[this.list.selected];
    if (row !== undefined) ctx.submit({ type: 'RemoveFromDepot', depotId: this.selectedDepot(ctx), itemIds: [...row.ids] });
  }

  /** `[t] Trade`: open the session, or say why it cannot open (§4.2). */
  trade(ctx: PanelContext, paused = false): void {
    const depotId = this.selectedDepot(ctx);
    const why = tradeBlocked(ctx, depotId);
    if (why === null) {
      ctx.notice?.(brokerOnWay(ctx, depotId, paused));
      ctx.submit({ type: 'TradeOpen', depotId });
    }
    else ctx.notice?.(why);
  }
}

/**
 * The depot's warning, or '': the waiting caravan's line when it cannot reach this depot, else the
 * caravans that could not reach it from their edges (`panels.md` § Depot).
 */
export function depotWarning(ctx: PanelContext, depotId: EntityId): string {
  const waiting = caravanUnreachable(ctx, depotId);
  if (waiting !== null) return waiting;
  const who = unreachableFrom(ctx, buildings(ctx)?.get(depotId)?.footprint ?? []);
  return who === '' ? '' : ctx.strings.get('ui.depot.unreachable', { who });
}

/**
 * Where caravans' ways to the depot break (20 § Movement step 6), as the panel marks them on the map:
 * the waiting caravan's gap while it cannot reach the depot, else the gap of each civilization whose
 * edge reaches none of the depot's tiles (`panels.md` § Depot).
 */
export function depotGaps(ctx: PanelContext, depotId: EntityId): { readonly tile: TileIndex; readonly depotSide: TileIndex }[] {
  const footprint = buildings(ctx)?.get(depotId)?.footprint ?? [];
  if (!ctx.readers.has('20') || footprint.length === 0) return [];
  const trade = ctx.readers.of<TradeReader>('20');
  const active = trade.activeCaravan();
  const civs = active !== null && caravanUnreachable(ctx, depotId) !== null
    ? [active.civ]
    : trade.caravanReach(footprint).filter((r) => !r.reaches).map((r) => r.civ);
  const out: { tile: TileIndex; depotSide: TileIndex }[] = [];
  for (const civ of civs) {
    const gap = trade.caravanGap(civ, footprint);
    if (gap !== null && !out.some((g) => g.tile === gap.tile && g.depotSide === gap.depotSide)) out.push(gap);
  }
  return out;
}

export function drawDepotPanel(s: Surface, rect: Rect, panel: DepotPanel, ctx: PanelContext, moveGoods: () => void, paused = false): void {
  const depotId = panel.selectedDepot(ctx);
  const col = rect.col + 1;
  const width = rect.cols - 2;
  if (!depotId) { label(s, col, rect.row, 'No built trade depot.', { fg: s.theme.dim, width }); return; }
  label(s, col, rect.row, `${buildingName(ctx, depotId)} · goods at depot`, { fg: s.theme.key, width });
  const warning = depotWarning(ctx, depotId);
  let top = rect.row + 1;
  if (warning !== '') {
    // Wrapped under the title, at most `DEPOT_WARNING_ROWS` rows; a longer one ends clipped, with its whole text as a tooltip.
    const lines = wrapHang(warning, width, 0);
    const shown = lines.slice(0, DEPOT_WARNING_ROWS);
    shown.forEach((line, k) => label(s, col, top + k, k === shown.length - 1 && lines.length > shown.length ? `${line}…` : line, { fg: s.theme.alert, width }));
    if (lines.length > shown.length) s.tooltip({ col, row: top, cols: width, rows: shown.length }, warning);
    // A click on the warning centres the map where the way breaks, on the caravan's side.
    const gap = depotGaps(ctx, depotId)[0];
    if (gap !== undefined) s.hit({ col, row: top, cols: width, rows: shown.length }, () => ctx.focusOn(gap.tile));
    top += shown.length;
  }
  // A waiting trade request says who it waits for and why, wrapped as the warning is.
  const wait = tradeWait(ctx, depotId);
  if (wait !== null) {
    const lines = wrapHang(wait, width, 0);
    const shown = lines.slice(0, DEPOT_WARNING_ROWS);
    shown.forEach((line, k) => label(s, col, top + k, k === shown.length - 1 && lines.length > shown.length ? `${line}…` : line, { fg: s.theme.key, width }));
    if (lines.length > shown.length) s.tooltip({ col, row: top, cols: width, rows: shown.length }, wait);
    top += shown.length;
  }
  const rows = panel.rows(ctx);
  const active = ctx.readers.of<TradeReader>('20').activeCaravan();
  const height = Math.max(1, rect.row + rect.rows - 3 - top);
  clampList(panel.list, rows.length, height);
  for (let index = panel.list.scroll; index < Math.min(rows.length, panel.list.scroll + height); index += 1) {
    const group = rows[index] as DepotRow;
    // The name the trade session gives the same stacks: the material and the type, in the plural above one.
    const type = ctx.registry.table<{ id: string; name: string; plural?: string; category?: string }>('items').byIndex(group.type);
    const material = ctx.registry.table<{ id: string; name: string }>('materials').byIndex(group.material)?.name ?? '';
    const name = materialItemName(material, type ?? { name: ctx.readers.of<ItemsReader>('13').def(group.type)?.name ?? 'goods' }, group.count);
    const row = top + index - panel.list.scroll;
    label(s, col, row, `${index === panel.list.selected ? '▶' : ' '} ${group.count} ${name}  ${Math.round(group.value)} ☼`, { width });
    s.hit({ col, row, cols: width, rows: 1 }, () => { panel.list.selected = index; });
  }
  const footer = rect.row + rect.rows - 2;
  // `m` and `t` open panels, so moving goods and trading take `Shift` (D-U2).
  let at = col;
  const action = (text: string, fg: typeof s.theme.key, run: () => void): void => {
    const n = label(s, at, footer, text, { fg, width: Math.max(0, col + width - at) });
    s.hit({ col: at, row: footer, cols: n, rows: 1 }, run);
    at += n + 1;
  };
  action(ctx.strings.get('ui.depot.move'), s.theme.key, moveGoods);
  action(ctx.strings.get('ui.depot.remove'), s.theme.key, () => panel.remove(ctx));
  action(ctx.strings.get('ui.depot.trade'), active?.state === 'atDepot' ? s.theme.key : s.theme.dim, () => panel.trade(ctx, paused));
}
