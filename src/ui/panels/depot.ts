/** The selected trade depot's stock and actions (T-M7-03). */
import type { EntityId } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { TradeReader } from '@systems/trade';
import type { ItemsReader } from '@systems/items';
import { buildingName, tradeBlocked } from '../messages';
import type { Surface } from '../surface';
import { label, type ListState, clampList } from '../widgets';
import { buildings, type PanelContext } from './context';

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

  move(delta: number, ctx: PanelContext): void {
    this.list.selected = Math.max(0, Math.min(this.items(ctx).length - 1, this.list.selected + delta));
  }

  remove(ctx: PanelContext): void {
    const itemId = this.items(ctx)[this.list.selected];
    if (itemId !== undefined) ctx.submit({ type: 'RemoveFromDepot', depotId: this.selectedDepot(ctx), itemIds: [itemId] });
  }

  /** `[t] Trade`: open the session, or say why it cannot open (§4.2). */
  trade(ctx: PanelContext): void {
    const depotId = this.selectedDepot(ctx);
    const why = tradeBlocked(ctx, depotId);
    if (why === null) ctx.submit({ type: 'TradeOpen', depotId });
    else ctx.notice?.(why);
  }
}

export function drawDepotPanel(s: Surface, rect: Rect, panel: DepotPanel, ctx: PanelContext, moveGoods: () => void): void {
  const depotId = panel.selectedDepot(ctx);
  const col = rect.col + 1;
  const width = rect.cols - 2;
  if (!depotId) { label(s, col, rect.row, 'No built trade depot.', { fg: s.theme.dim, width }); return; }
  label(s, col, rect.row, `${buildingName(ctx, depotId)} · goods at depot`, { fg: s.theme.key, width });
  const ids = panel.items(ctx);
  const items = ctx.readers.of<ItemsReader>('13');
  const active = ctx.readers.of<TradeReader>('20').activeCaravan();
  const civ = active?.civ;
  const trade = ctx.readers.of<TradeReader>('20');
  const height = Math.max(1, rect.rows - 4);
  clampList(panel.list, ids.length, height);
  for (let index = panel.list.scroll; index < Math.min(ids.length, panel.list.scroll + height); index += 1) {
    const id = ids[index] as EntityId;
    const item = items.get(id);
    if (!item) continue;
    const name = items.def(item.type)?.name ?? 'goods';
    const value = civ ? trade.valuation(civ, id) : items.value(id);
    const row = rect.row + 1 + index - panel.list.scroll;
    label(s, col, row, `${index === panel.list.selected ? '▶' : ' '} ${item.count} ${name}  ${Math.round(value)} ☼`, { width });
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
  action(ctx.strings.get('ui.depot.trade'), active?.state === 'atDepot' ? s.theme.key : s.theme.dim, () => panel.trade(ctx));
}
