/** Trade relationships and next-caravan requests (T-M7-03, panels.md § Civilizations). */
import { logDate } from './log';
import { TICKS_PER_DAY } from '@core/constants';
import type { Civ } from '@core/types';
import type { KeyPress } from '@platform/input';
import type { Rect } from '@render/cellbuffer';
import { eligibleGoodsEntries, neverSold, REQUEST_MAX, type TradeReader, type TradeRequest } from '@systems/trade';
import type { Registry } from '@core/registry';
import { itemName, tradeWait, wrapHang } from '../messages';
import { DEPOT_WARNING_ROWS } from '../constants';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { captionButtons, label } from '../widgets';
import { accel, buildings, type PanelContext } from './context';
import { drawPanelFilter, PanelFilter } from './filter';

export const TRADE_CIVILIZATIONS: readonly Civ[] = ['mountainhome', 'hillfolk', 'wildwood'];

/** A reputation log row: the change, its reason in words and its date as the log writes it ("+3 trade (Su 1)"). */
export function reputationEntryText(ctx: PanelContext, entry: ReputationRow): string {
  const key = ctx.strings.has(`ui.civ.rep_reason.${entry.reason}`) ? `ui.civ.rep_reason.${entry.reason}` : 'ui.civ.rep_reason.other';
  const date = logDate(ctx.strings, entry.tick, ctx.readers.calendar.tick);
  const reason = (entry.count ?? 1) > 1 ? ctx.strings.get('ui.civ.rep_count', { reason: ctx.strings.get(key), n: entry.count ?? 1 }) : ctx.strings.get(key);
  return `${entry.delta >= 0 ? '+' : ''}${entry.delta} ${reason} (${date})`;
}

/** A reputation log row: one change, or `count` changes of one reason on one day folded into one (`panels.md` § Civilizations). */
export interface ReputationRow { readonly delta: number; readonly reason: string; readonly tick: number; readonly count?: number }

/**
 * The reputation log as the panel lists it, newest first: the changes of one reason on one day fold
 * into one row, at the newest one's place, with their total, their count and the newest one's date
 * ("-20 offered wood ×10 (Au 3)"). The saved history keeps every change.
 */
export function foldReputationLog(entries: readonly { readonly delta: number; readonly reason: string; readonly tick: number }[]): ReputationRow[] {
  const rows: { delta: number; reason: string; tick: number; count: number }[] = [];
  const byDay = new Map<string, { delta: number; reason: string; tick: number; count: number }>();
  for (const entry of [...entries].reverse()) {
    const key = `${entry.reason} ${Math.floor(entry.tick / TICKS_PER_DAY)}`;
    const row = byDay.get(key);
    if (row !== undefined) {
      row.delta += entry.delta;
      row.count += 1;
    } else {
      const fresh = { delta: entry.delta, reason: entry.reason, tick: entry.tick, count: 1 };
      byDay.set(key, fresh);
      rows.push(fresh);
    }
  }
  return rows;
}
/** A civilization's name as the panel writes it ("Mountainhome"). */
function civName(ctx: PanelContext, civ: Civ): string {
  return ctx.strings.get(`ui.civ.name.${civ}`);
}

/**
 * The goods of a civilization's last caravan as the panel names them: each kind once by its name,
 * with its count when it came more than once ("leather ×4, goat, dung ×3"); an id is an item type
 * or, for an animal, a creature.
 */
export function lastBroughtText(registry: Registry, strings: Strings, ids: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  const creatures = registry.hasTable('creatures') ? registry.table<{ id: string; name: string }>('creatures') : null;
  return Array.from(counts, ([id, n]) => {
    const name = registry.table('items').has(id) ? itemName(registry, strings, id) : creatures?.byId(id)?.name ?? id.replace(/_/g, ' ');
    return n > 1 ? `${name} ×${n}` : name;
  }).join(', ');
}

/**
 * A request as the panel names it: the item, then its material or species when it has one
 * ("seed: dimcap", "bar: iron"); an animal by its species ("cow").
 */
export function requestText(registry: Registry, strings: Strings, entry: Pick<TradeRequest, 'itemType' | 'material'>): string {
  const creatures = registry.hasTable('creatures') ? registry.table<{ id: string; name: string }>('creatures') : null;
  const item = registry.table('items').has(entry.itemType) ? itemName(registry, strings, entry.itemType) : creatures?.byId(entry.itemType)?.name ?? entry.itemType.replace(/_/g, ' ');
  if (entry.material === undefined) return item;
  const material = registry.table<{ id: string; name: string }>('materials').byId(entry.material)?.name ?? entry.material.replace(/_/g, ' ');
  // A material that already says the item ("wool cloth", "coal") is the whole name.
  return material === item || material.endsWith(` ${item}`) ? material : `${item}: ${material}`;
}

/**
 * The requests as the panel lists them: two of one item and material are one row, at the higher
 * priority, in the place of the first.
 */
export function mergedRequests(entries: readonly TradeRequest[]): TradeRequest[] {
  const out: TradeRequest[] = [];
  for (const entry of entries) {
    const same = out.findIndex((e) => e.itemType === entry.itemType && e.material === entry.material);
    const prev = out[same];
    if (prev === undefined) out.push({ ...entry });
    else out[same] = { ...prev, priority: Math.max(prev.priority, entry.priority) as 1 | 2 | 3 };
  }
  return out;
}

/**
 * The materials a civilization's list brings an item in, for the requests editor: none named (any),
 * then each material of its entries in their order (20 § Requests); a class pool ("metal" crafts)
 * names no material, and a never-sold material is left out.
 */
export function requestMaterials(registry: Registry, civ: Civ, reputation: number, itemType: string): (string | undefined)[] {
  const materials = registry.table('materials');
  const out: (string | undefined)[] = [undefined];
  for (const entry of eligibleGoodsEntries(registry, civ, reputation)) {
    const keys = Array.isArray(entry.item) ? entry.item : [entry.item];
    if (!keys.includes(itemType)) continue;
    for (const choice of entry.materials) {
      if (materials.has(choice.material) && !out.includes(choice.material) && !neverSold(itemType, choice.material, reputation)) out.push(choice.material);
    }
  }
  return out;
}

/**
 * The goods the requests editor offers, from the registry (the UI never invents an id): the
 * civilization's own goods first, each item or animal of its list once in the list's order, then
 * every other item in registry order (`panels.md` § Civilizations).
 */
export function requestCandidates(registry: Registry, civ: Civ, reputation: number): string[] {
  const items = registry.table('items');
  const creatures = registry.hasTable('creatures') ? registry.table('creatures') : null;
  const own: string[] = [];
  for (const entry of eligibleGoodsEntries(registry, civ, reputation)) {
    for (const id of Array.isArray(entry.item) ? entry.item : [entry.item]) {
      if ((items.has(id) || creatures?.has(id) === true) && !own.includes(id) && !neverSold(id, undefined, reputation)) own.push(id);
    }
  }
  const listed = new Set(own);
  return [...own, ...items.ids().filter((id) => !listed.has(id))];
}

export class CivilizationsPanel {
  selected = 0;
  requestSelected = 0;
  choosingRequest = false;
  candidate = 0;
  /** The material of the candidate in the requests editor: an index into {@link requestMaterials}, 0 for any. */
  candidateMaterial = 0;
  /** The requests editor's `/filter`: only the goods whose name contains its text are offered. */
  readonly filter = new PanelFilter();

  civ(): Civ { return TRADE_CIVILIZATIONS[this.selected] as Civ; }

  private trade(ctx: PanelContext): TradeReader { return ctx.readers.of<TradeReader>('20'); }

  /** Every good the editor offers the selected civilization, its own first ({@link requestCandidates}). */
  allCandidates(ctx: PanelContext): readonly string[] {
    return requestCandidates(ctx.registry, this.civ(), this.trade(ctx).reputation(this.civ()));
  }

  /** The goods the editor lists: those whose name, as a request names it, contains the filter's text, ignoring case. */
  candidates(ctx: PanelContext): readonly string[] {
    const needle = this.filter.value.toLowerCase();
    const all = this.allCandidates(ctx);
    return needle === '' ? all : all.filter((id) => requestText(ctx.registry, ctx.strings, { itemType: id }).toLowerCase().includes(needle));
  }

  /** Opens the requests editor on the first good, with an empty filter. */
  openEditor(): void {
    this.choosingRequest = true;
    this.candidate = 0;
    this.candidateMaterial = 0;
    this.filter.value = '';
    this.filter.focused = false;
  }

  /** The editor's filter field takes the keys while it has focus; each change to its text chooses the first match. */
  filterKey(press: KeyPress): boolean {
    if (!this.choosingRequest) return false;
    const before = this.filter.value;
    if (!this.filter.key(press)) return false;
    if (this.filter.value !== before) { this.candidate = 0; this.candidateMaterial = 0; }
    return true;
  }

  /** The materials the selected civilization brings the candidate in, `undefined` (any) first. */
  candidateMaterials(ctx: PanelContext): (string | undefined)[] {
    const id = this.candidates(ctx)[this.candidate];
    return id === undefined ? [undefined] : requestMaterials(ctx.registry, this.civ(), this.trade(ctx).reputation(this.civ()), id);
  }

  /** The request the editor would add: the candidate item in the chosen material. */
  candidateRequest(ctx: PanelContext): { itemType: string; material?: string } | null {
    const id = this.candidates(ctx)[this.candidate];
    if (id === undefined) return null;
    const material = this.candidateMaterials(ctx)[this.candidateMaterial];
    return material === undefined ? { itemType: id } : { itemType: id, material };
  }

  private update(ctx: PanelContext, entries: readonly TradeRequest[]): void {
    ctx.submit({ type: 'SetRequests', civ: this.civ(), entries: mergedRequests(entries).map((entry) => ({ ...entry })) });
  }

  key(ctx: PanelContext, press: KeyPress, openTrade: () => void): boolean {
    const k = press.key;
    // `d`, `t`, `a` and `p` are this panel's before they are panel letters (D-253).
    const letter = accel(ctx, press);
    if (this.choosingRequest) {
      if (this.filterKey(press)) return true;
      if (k === '/') { this.filter.focused = true; return true; }
      const candidates = this.candidates(ctx);
      if (k === 'ArrowUp' || k === '↑') { this.candidate = Math.max(0, this.candidate - 1); this.candidateMaterial = 0; return true; }
      if (k === 'ArrowDown' || k === '↓') { this.candidate = Math.max(0, Math.min(candidates.length - 1, this.candidate + 1)); this.candidateMaterial = 0; return true; }
      if (k === 'ArrowLeft' || k === '←' || k === 'ArrowRight' || k === '→') {
        const n = this.candidateMaterials(ctx).length;
        this.candidateMaterial = (this.candidateMaterial + (k === 'ArrowLeft' || k === '←' ? n - 1 : 1)) % n;
        return true;
      }
      if (k === 'Esc' || k === 'Escape') { this.choosingRequest = false; return true; }
      if (k === 'Enter') {
        const request = this.candidateRequest(ctx);
        const entries = mergedRequests(this.trade(ctx).requests(this.civ()));
        // 20 § Never sold: refused here, with the reason.
        if (request !== null && neverSold(request.itemType, request.material, this.trade(ctx).reputation(this.civ()))) {
          ctx.notice?.(ctx.strings.get('ui.trade.not_traded', { civ: civName(ctx, this.civ()) }));
          this.choosingRequest = false;
          return true;
        }
        // A second request of one item and material would be the same row: it is not added.
        if (request !== null && entries.length < REQUEST_MAX && !entries.some((entry) => entry.itemType === request.itemType && entry.material === request.material)) {
          this.update(ctx, [...entries, { ...request, priority: 1 }]);
        }
        this.choosingRequest = false;
        return true;
      }
      return false;
    }
    if (k === 'ArrowUp' || k === '↑') { this.selected = Math.max(0, this.selected - 1); this.requestSelected = 0; return true; }
    if (k === 'ArrowDown' || k === '↓') { this.selected = Math.min(TRADE_CIVILIZATIONS.length - 1, this.selected + 1); this.requestSelected = 0; return true; }
    if (letter === 'd') { ctx.openPanel('depot'); return true; }
    if (letter === 't') { openTrade(); return true; }
    const entries = mergedRequests(this.trade(ctx).requests(this.civ()));
    if (k === '+' || letter === 'a') { this.openEditor(); return true; }
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
    const here = active?.civ === civ ? ctx.strings.get('ui.civ.here') : '';
    const banned = trade.isBanned(civ) ? ctx.strings.get('ui.civ.banned') : '';
    const line = ctx.strings.get('ui.civ.row', { name: civName(ctx, civ), rep: `${rep >= 0 ? '+' : ''}${rep}`, when: trade.schedule()[civ] ?? '' });
    label(s, col, row, `${index === panel.selected ? '▶' : ' '} ${line}${here}${banned}`, { fg: index === panel.selected ? s.theme.key : s.theme.text, width });
    s.hit({ col, row, cols: width, rows: 1 }, () => { panel.selected = index; panel.requestSelected = 0; });
    row += 1;
  }
  row += 1;
  const civ = panel.civ();
  label(s, col, row++, `── ${civName(ctx, civ)} ──`, { fg: s.theme.key, width });
  // The caravan here: a waiting trade request says who it waits for and why, wrapped as the depot's warning.
  const wait = active?.civ === civ ? civilizationsTradeWait(ctx) : null;
  if (wait !== null) {
    const lines = wrapHang(wait, width, 0);
    const shown = lines.slice(0, DEPOT_WARNING_ROWS);
    shown.forEach((line, k) => label(s, col, row + k, k === shown.length - 1 && lines.length > shown.length ? `${line}…` : line, { fg: s.theme.key, width }));
    if (lines.length > shown.length) s.tooltip({ col, row, cols: width, rows: shown.length }, wait);
    row += shown.length;
  }
  label(s, col, row++, ctx.strings.get('ui.civ.last_brought', { goods: lastBroughtText(ctx.registry, ctx.strings, trade.lastBrought(civ)) || ctx.strings.get('ui.civ.nothing') }), { width });
  const requestsWidth = label(s, col, row++, ctx.strings.get('ui.civ.requests'), { fg: s.theme.key, width });
  s.hit({ col, row: row - 1, cols: requestsWidth, rows: 1 }, () => panel.openEditor());
  // One row per item and material, its priority as a word at the right ("seed: dimcap      high").
  const entries = mergedRequests(trade.requests(civ));
  for (const [index, entry] of entries.entries()) {
    if (row >= rect.row + rect.rows - 5) break;
    const priority = ctx.strings.get(`ui.civ.priority.${entry.priority}`);
    const name = `${index === panel.requestSelected ? '▶' : ' '} ${requestText(ctx.registry, ctx.strings, entry)}`;
    const room = Math.max(1, width - priority.length - 1);
    const shown = Array.from(name).length > room ? `${Array.from(name).slice(0, room - 1).join('')}»` : name.padEnd(room);
    label(s, col, row, `${shown} ${priority}`, { width, keys: false });
    if (Array.from(name).length > room) s.tooltip({ col, row, cols: width, rows: 1 }, name.replace(/^[▶\s]+/, ''));
    s.hit({ col, row, cols: width, rows: 1 }, () => { panel.requestSelected = index; });
    row += 1;
  }
  if (panel.choosingRequest && row < rect.row + rect.rows - 5) {
    const request = panel.candidateRequest(ctx);
    const any = request !== null && request.material === undefined && panel.candidateMaterials(ctx).length > 1;
    const what = request === null ? ctx.strings.get('ui.civ.request_none') : any ? ctx.strings.get('ui.civ.request_any', { item: requestText(ctx.registry, ctx.strings, request) }) : requestText(ctx.registry, ctx.strings, request);
    label(s, col, row++, ctx.strings.get('ui.civ.request_add', { what }), { fg: s.theme.key, width });
    drawPanelFilter(s, col, row++, width, panel.filter, ctx);
    label(s, col, row++, ctx.strings.get('ui.civ.request_keys1'), { fg: s.theme.dim, width });
    label(s, col, row++, ctx.strings.get('ui.civ.request_keys2'), { fg: s.theme.dim, width });
  }
  if (row < rect.row + rect.rows - 4) label(s, col, row++, ctx.strings.get('ui.civ.request_keys'), { fg: s.theme.dim, width });
  if (row < rect.row + rect.rows - 3) label(s, col, row++, ctx.strings.get('ui.civ.reputation_log'), { fg: s.theme.key, width });
  // Newest first, one reason's changes on one day folded, as many as fit above the footer, each reason in words ("−50 caravan member killed (Au 3)").
  for (const entry of foldReputationLog(trade.reputationLog(civ))) {
    if (row >= rect.row + rect.rows - 2) break;
    label(s, col, row++, reputationEntryText(ctx, entry), { width });
  }
  const footer = rect.row + rect.rows - 1;
  captionButtons(s, col, footer, ctx.strings.get('ui.civ.footer'), [() => ctx.openPanel('depot'), openTrade], { fg: s.theme.key, width });
}

/** The first depot's waiting trade request in words (`panels.md` § Civilizations), or null. */
export function civilizationsTradeWait(ctx: PanelContext): string | null {
  for (const depotId of buildings(ctx)?.depots() ?? []) {
    const wait = tradeWait(ctx, depotId);
    if (wait !== null) return wait;
  }
  return null;
}
