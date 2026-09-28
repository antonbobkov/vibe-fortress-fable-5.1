/** Trade relationships and next-caravan requests (T-M7-03, panels.md § Civilizations). */
import { formatDate } from '@core/calendar';
import type { Civ } from '@core/types';
import type { KeyPress } from '@platform/input';
import type { Rect } from '@render/cellbuffer';
import { REQUEST_MAX, type TradeReader, type TradeRequest } from '@systems/trade';
import type { Surface } from '../surface';
import { label } from '../widgets';
import type { PanelContext } from './context';

export const TRADE_CIVILIZATIONS: readonly Civ[] = ['mountainhome', 'hillfolk', 'wildwood'];
const CIV_NAMES: Readonly<Record<Civ, string>> = { mountainhome: 'Mountainhome', hillfolk: 'Hillfolk', wildwood: 'Wildwood', gloam: 'Gloam' };

export class CivilizationsPanel {
  selected = 0;
  requestSelected = 0;
  choosingRequest = false;
  candidate = 0;

  civ(): Civ { return TRADE_CIVILIZATIONS[this.selected] as Civ; }

  private trade(ctx: PanelContext): TradeReader { return ctx.readers.of<TradeReader>('20'); }

  /** The content registry supplies valid ids; the UI never invents an item id. */
  candidates(ctx: PanelContext): readonly string[] { return ctx.registry.table('items').ids(); }

  private update(ctx: PanelContext, entries: readonly TradeRequest[]): void {
    ctx.submit({ type: 'SetRequests', civ: this.civ(), entries: entries.map((entry) => ({ ...entry })) });
  }

  key(ctx: PanelContext, press: KeyPress, openTrade: () => void): boolean {
    const k = press.key;
    const letter = k.length === 1 ? k.toLowerCase() : '';
    if (this.choosingRequest) {
      const candidates = this.candidates(ctx);
      if (k === 'ArrowUp' || k === '↑') { this.candidate = Math.max(0, this.candidate - 1); return true; }
      if (k === 'ArrowDown' || k === '↓') { this.candidate = Math.min(candidates.length - 1, this.candidate + 1); return true; }
      if (k === 'Esc' || k === 'Escape') { this.choosingRequest = false; return true; }
      if (k === 'Enter') {
        const id = candidates[this.candidate];
        const entries = this.trade(ctx).requests(this.civ());
        if (id && entries.length < REQUEST_MAX && !entries.some((entry) => entry.itemType === id)) this.update(ctx, [...entries, { itemType: id, priority: 1 }]);
        this.choosingRequest = false;
        return true;
      }
      return false;
    }
    if (k === 'ArrowUp' || k === '↑') { this.selected = Math.max(0, this.selected - 1); this.requestSelected = 0; return true; }
    if (k === 'ArrowDown' || k === '↓') { this.selected = Math.min(TRADE_CIVILIZATIONS.length - 1, this.selected + 1); this.requestSelected = 0; return true; }
    if (letter === 'd') { ctx.openPanel('depot'); return true; }
    if (letter === 't') { openTrade(); return true; }
    const entries = this.trade(ctx).requests(this.civ());
    if (letter === '+' || letter === 'a') { this.choosingRequest = true; this.candidate = 0; return true; }
    if (k === 'ArrowLeft' || k === '←') { this.requestSelected = Math.max(0, this.requestSelected - 1); return true; }
    if (k === 'ArrowRight' || k === '→') { this.requestSelected = Math.min(entries.length - 1, this.requestSelected + 1); return true; }
    const entry = entries[this.requestSelected];
    if (entry === undefined) return false;
    if (letter === 'x') { this.update(ctx, entries.filter((_, index) => index !== this.requestSelected)); return true; }
    if (letter === 'p') {
      this.update(ctx, entries.map((item, index) => index === this.requestSelected ? { ...item, priority: (item.priority % 3 + 1) as 1 | 2 | 3 } : item));
      return true;
    }
    return false;
  }
}

export function drawCivilizationsPanel(s: Surface, rect: Rect, panel: CivilizationsPanel, ctx: PanelContext, openTrade: () => void): void {
  if (!ctx.readers.has('20')) return;
  const trade = ctx.readers.of<TradeReader>('20');
  const width = rect.cols - 2;
  const col = rect.col + 1;
  let row = rect.row;
  const active = trade.activeCaravan();
  for (const [index, civ] of TRADE_CIVILIZATIONS.entries()) {
    const rep = trade.reputation(civ);
    const here = active?.civ === civ ? ' here!' : '';
    const banned = trade.isBanned(civ) ? ' banned' : '';
    label(s, col, row, `${index === panel.selected ? '▶' : ' '} ${CIV_NAMES[civ]} rep ${rep >= 0 ? '+' : ''}${rep} ${trade.schedule()[civ] ?? ''}${here}${banned}`, { fg: index === panel.selected ? s.theme.key : s.theme.text, width });
    s.hit({ col, row, cols: width, rows: 1 }, () => { panel.selected = index; panel.requestSelected = 0; });
    row += 1;
  }
  row += 1;
  const civ = panel.civ();
  label(s, col, row++, `── ${CIV_NAMES[civ]} ──`, { fg: s.theme.key, width });
  label(s, col, row++, `Last brought: ${trade.lastBrought(civ).join(', ') || 'none'}`, { width });
  label(s, col, row++, 'Requests [+]', { fg: s.theme.key, width });
  s.hit({ col, row: row - 1, cols: 12, rows: 1 }, () => { panel.choosingRequest = true; panel.candidate = 0; });
  const entries = trade.requests(civ);
  for (const [index, entry] of entries.entries()) {
    if (row >= rect.row + rect.rows - 5) break;
    label(s, col, row, `${index === panel.requestSelected ? '▶' : ' '} ${entry.itemType} ${'★'.repeat(entry.priority)}`, { width });
    s.hit({ col, row, cols: width, rows: 1 }, () => { panel.requestSelected = index; });
    row += 1;
  }
  if (panel.choosingRequest && row < rect.row + rect.rows - 4) {
    const candidates = panel.candidates(ctx);
    label(s, col, row++, `Add: ${candidates[panel.candidate] ?? ''}`, { fg: s.theme.key, width });
    label(s, col, row++, '[↑/↓] item [Enter] add [Esc] cancel', { fg: s.theme.dim, width });
  }
  if (row < rect.row + rect.rows - 4) label(s, col, row++, '[←/→] request [p] priority [x] remove', { fg: s.theme.dim, width });
  if (row < rect.row + rect.rows - 3) label(s, col, row++, 'Reputation log', { fg: s.theme.key, width });
  for (const entry of trade.reputationLog(civ).slice(-2).reverse()) {
    if (row >= rect.row + rect.rows - 2) break;
    label(s, col, row++, `${entry.delta >= 0 ? '+' : ''}${entry.delta} ${entry.reason} (${formatDate(entry.tick)})`, { width });
  }
  const footer = rect.row + rect.rows - 1;
  label(s, col, footer, '[d] depot panel  [t] trade now', { fg: s.theme.key, width });
  s.hit({ col, row: footer, cols: 15, rows: 1 }, () => ctx.openPanel('depot'));
  s.hit({ col: col + 17, row: footer, cols: 13, rows: 1 }, openTrade);
}
