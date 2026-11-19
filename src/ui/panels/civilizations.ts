/** Trade relationships and next-caravan requests (T-M7-03, panels.md § Civilizations). */
import { logDate } from './log';
import type { Civ } from '@core/types';
import type { KeyPress } from '@platform/input';
import type { Rect } from '@render/cellbuffer';
import { neverSold, REQUEST_MAX, type TradeReader, type TradeRequest } from '@systems/trade';
import type { Registry } from '@core/registry';
import { itemName, tradeWait, wrapHang } from '../messages';
import { DEPOT_WARNING_ROWS } from '../constants';
import type { Surface } from '../surface';
import { captionButtons, label } from '../widgets';
import { accel, buildings, type PanelContext } from './context';

export const TRADE_CIVILIZATIONS: readonly Civ[] = ['mountainhome', 'hillfolk', 'wildwood'];

/** A reputation log row: the change, its reason in words and its date as the log writes it ("+3 trade (Su 1)"). */
export function reputationEntryText(ctx: PanelContext, entry: { readonly delta: number; readonly reason: string; readonly tick: number }): string {
  const key = ctx.strings.has(`ui.civ.rep_reason.${entry.reason}`) ? `ui.civ.rep_reason.${entry.reason}` : 'ui.civ.rep_reason.other';
  const date = logDate(ctx.strings, entry.tick, ctx.readers.calendar.tick);
  return `${entry.delta >= 0 ? '+' : ''}${entry.delta} ${ctx.strings.get(key)} (${date})`;
}
const CIV_NAMES: Readonly<Record<Civ, string>> = { mountainhome: 'Mountainhome', hillfolk: 'Hillfolk', wildwood: 'Wildwood', gloam: 'Gloam' };

/**
 * The goods of a civilization's last caravan as the panel names them: each kind once by its name,
 * with its count when it came more than once ("leather ×4, goat, dung ×3"); an id is an item type
 * or, for an animal, a creature.
 */
export function lastBroughtText(registry: Registry, ids: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  const creatures = registry.hasTable('creatures') ? registry.table<{ id: string; name: string }>('creatures') : null;
  return Array.from(counts, ([id, n]) => {
    const name = registry.table('items').has(id) ? itemName(registry, id) : creatures?.byId(id)?.name ?? id.replace(/_/g, ' ');
    return n > 1 ? `${name} ×${n}` : name;
  }).join(', ');
}

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
    // `d`, `t`, `a` and `p` open panels: the panel's own use of them takes `Shift` (D-U2).
    const letter = accel(ctx, press);
    if (this.choosingRequest) {
      const candidates = this.candidates(ctx);
      if (k === 'ArrowUp' || k === '↑') { this.candidate = Math.max(0, this.candidate - 1); return true; }
      if (k === 'ArrowDown' || k === '↓') { this.candidate = Math.min(candidates.length - 1, this.candidate + 1); return true; }
      if (k === 'Esc' || k === 'Escape') { this.choosingRequest = false; return true; }
      if (k === 'Enter') {
        const id = candidates[this.candidate];
        const entries = this.trade(ctx).requests(this.civ());
        // 20 § Never sold: refused here, with the reason.
        if (id && neverSold(id, undefined, this.trade(ctx).reputation(this.civ()))) {
          ctx.notice?.(ctx.strings.get('ui.trade.not_traded', { civ: CIV_NAMES[this.civ()] }));
          this.choosingRequest = false;
          return true;
        }
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
    if (k === '+' || letter === 'a') { this.choosingRequest = true; this.candidate = 0; return true; }
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
  // The caravan here: a waiting trade request says who it waits for and why, wrapped as the depot's warning.
  const wait = active?.civ === civ ? civilizationsTradeWait(ctx) : null;
  if (wait !== null) {
    const lines = wrapHang(wait, width, 0);
    const shown = lines.slice(0, DEPOT_WARNING_ROWS);
    shown.forEach((line, k) => label(s, col, row + k, k === shown.length - 1 && lines.length > shown.length ? `${line}…` : line, { fg: s.theme.key, width }));
    if (lines.length > shown.length) s.tooltip({ col, row, cols: width, rows: shown.length }, wait);
    row += shown.length;
  }
  label(s, col, row++, `Last brought: ${lastBroughtText(ctx.registry, trade.lastBrought(civ)) || 'none'}`, { width });
  const requestsWidth = label(s, col, row++, 'Requests [+]', { fg: s.theme.key, width });
  s.hit({ col, row: row - 1, cols: requestsWidth, rows: 1 }, () => { panel.choosingRequest = true; panel.candidate = 0; });
  const entries = trade.requests(civ);
  for (const [index, entry] of entries.entries()) {
    if (row >= rect.row + rect.rows - 5) break;
    label(s, col, row, `${index === panel.requestSelected ? '▶' : ' '} ${itemName(ctx.registry, entry.itemType)} ${'★'.repeat(entry.priority)}`, { width });
    s.hit({ col, row, cols: width, rows: 1 }, () => { panel.requestSelected = index; });
    row += 1;
  }
  if (panel.choosingRequest && row < rect.row + rect.rows - 4) {
    const candidates = panel.candidates(ctx);
    label(s, col, row++, `Add: ${itemName(ctx.registry, candidates[panel.candidate] ?? '')}`, { fg: s.theme.key, width });
    label(s, col, row++, '[↑/↓] item [Enter] add [Esc] cancel', { fg: s.theme.dim, width });
  }
  if (row < rect.row + rect.rows - 4) label(s, col, row++, '[←→] pick [S-p] prio [x] remove', { fg: s.theme.dim, width });
  if (row < rect.row + rect.rows - 3) label(s, col, row++, 'Reputation log', { fg: s.theme.key, width });
  // Newest first, as many as fit above the footer, each reason in words ("−50 caravan member killed (Au 3)").
  for (const entry of [...trade.reputationLog(civ)].reverse()) {
    if (row >= rect.row + rect.rows - 2) break;
    label(s, col, row++, reputationEntryText(ctx, entry), { width });
  }
  const footer = rect.row + rect.rows - 1;
  captionButtons(s, col, footer, '[S-d] depot  [S-t] trade now', [() => ctx.openPanel('depot'), openTrade], { fg: s.theme.key, width });
}

/** The first depot's waiting trade request in words (`panels.md` § Civilizations), or null. */
export function civilizationsTradeWait(ctx: PanelContext): string | null {
  for (const depotId of buildings(ctx)?.depots() ?? []) {
    const wait = tradeWait(ctx, depotId);
    if (wait !== null) return wait;
  }
  return null;
}
