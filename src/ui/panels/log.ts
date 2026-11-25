/**
 * The log panel and the log strip.
 *
 * 24 § Announcements and the log: "The log panel lists everything with filters by severity and
 * category …, newest first, and jumps to the focus on click"; `ui-screens/fortress-screen.md`:
 * "The log strip shows the last three announcements; danger lines are prefixed `!!`, alerts `!`".
 * The combat tab belongs to 16 (M6).
 */

import { dayOfSeasonOf, seasonOf, yearOf } from '@core/calendar';
import type { EntityId } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { Rgb } from '@render/palette';
import { combatOnly, lineText, type LogLine, type Severity } from '../announcements';
import type { Strings } from '../strings';
import type { Surface, Theme } from '../surface';
import { label, type ListState } from '../widgets';
import { PanelFilter, drawPanelFilter } from './filter';
import { wrapHang, wrapText } from '../messages';
import type { KeyContext } from '../keymap';

/** The contexts a hint's keys are read in: the panel letters, the global and map keys, and the building panel's (`hint_gate`). */
export const HINT_KEY_CONTEXTS: readonly KeyContext[] = ['global', 'fortress_panel', 'map', 'building_panel'];

/** A log line's text, with a hint's keys named as the live keymap binds them. */
function shownText(s: Surface, line: LogLine, strings: Strings): string {
  const text = lineText(line, strings);
  return line.category === 'hint' && s.keyNames !== null ? s.keyNames(text, HINT_KEY_CONTEXTS) : text;
}

/** The creatures a log line may name, and what a click on a name does. */
export interface LogCreatures {
  readonly names: readonly { readonly id: EntityId; readonly name: string }[];
  readonly open: (id: EntityId) => void;
  /** The name of the creature or item a line names whose view `[v]` opens, or null when it is gone (T-679). */
  readonly subject?: (line: LogLine) => string | null;
}

/** `0` all but the combat notes, `1` alerts and danger, `2` combat. */
export type LogFilter = 0 | 1 | 2;

export function colorOf(theme: Theme, severity: Severity): Rgb {
  return severity === 'danger' ? theme.danger : severity === 'alert' ? theme.alert : theme.note;
}

export function filterLines(lines: readonly LogLine[], filter: LogFilter): LogLine[] {
  // The blows and kills are the Combat tab's alone (16 § Combat log).
  if (filter === 0) return lines.filter((l) => !combatOnly(l));
  if (filter === 1) return lines.filter((l) => l.severity !== 'note');
  return lines.filter((l) => l.category === 'combat');
}

/** The lines of a tab whose text as the panel shows it contains `text`, ignoring case (panels.md § Log: the filter field). */
export function matchLines(s: Surface, lines: readonly LogLine[], filter: LogFilter, text: string, strings: Strings): LogLine[] {
  const tab = filterLines(lines, filter);
  if (text === '') return tab;
  const needle = text.toLowerCase();
  return tab.filter((line) => shownText(s, line, strings).toLowerCase().includes(needle));
}

/** A log row's date: "Sp 8", with the year ("Y2 Sp 8") for a line of an earlier year than `now`. */
export function logDate(strings: Strings, tick: number, now: number): string {
  const season = strings.get(`ui.log.season.${seasonOf(tick)}`);
  const day = dayOfSeasonOf(tick);
  return yearOf(tick) === yearOf(now) ? strings.get('ui.log.date', { season, day }) : strings.get('ui.log.date_year', { year: yearOf(tick), season, day });
}

/**
 * The log panel's place in its list, counted in entries (newest first), not in rows: an entry wraps
 * over as many rows as its text needs, and `↑` `↓` `PageUp` `PageDown` move by entries.
 */
export class LogView implements ListState {
  /** The selected entry. */
  selected = 0;
  /** The first entry drawn. */
  scroll = 0;
  /** The selected line, so that lines arriving above it do not move the selection off it. */
  line: LogLine | null = null;
  /** The entries the last draw showed whole; a page is this less one. */
  visible = 1;
  /** Whether the player has chosen an entry: until then nothing is inverted and the newest is the selected one. */
  chosen = false;
  /** The `/filter` field under the tabs: only the entries containing its text are listed. */
  readonly filter = new PanelFilter();

  /** Move the selection by `delta` entries; the draw clamps it to the entries that exist. The first `↑` or `↓` marks the selected entry. */
  move(delta: number): void {
    const first = !this.chosen;
    this.chosen = true;
    if (first && Math.abs(delta) === 1) return;
    this.selected = Math.max(0, this.selected + delta);
    this.line = null;
  }

  /** `PageDown` / `PageUp`: a page of entries less one, so the last one stays in view. */
  page(direction: 1 | -1): void {
    this.move(direction * Math.max(1, this.visible - 1));
  }

  /** Back to the newest entry (another tab, or another filter text). */
  reset(): void {
    this.selected = 0;
    this.scroll = 0;
    this.line = null;
    this.chosen = false;
  }
}

/** One entry as the panel lays it out: its text's rows, and how many of them the panel holds. */
interface PlacedEntry {
  readonly index: number;
  readonly date: string;
  readonly parts: readonly string[];
  readonly rows: number;
}

interface LogLayout {
  readonly dateCols: number;
  readonly textCols: number;
  readonly entries: readonly PlacedEntry[];
}

/** The entries from `scroll` in `height` rows of `cols` cells: the date column, then the text wrapped under itself. */
function layoutLog(s: Surface, strings: Strings, shown: readonly LogLine[], dates: (index: number) => string, scroll: number, height: number, cols: number): LogLayout {
  const end = Math.min(shown.length, scroll + height);
  let widest = 0;
  for (let index = scroll; index < end; index += 1) widest = Math.max(widest, Array.from(dates(index)).length);
  const dateCols = Math.min(widest + 1, Math.max(0, cols - 1));
  const textCols = Math.max(1, cols - dateCols);
  const entries: PlacedEntry[] = [];
  let used = 0;
  for (let index = scroll; index < shown.length && used < height; index += 1) {
    const parts = wrapHang(shownText(s, shown[index] as LogLine, strings), textCols, 0);
    const rows = Math.min(parts.length, height - used);
    // The log never cuts an entry: one the rows left cannot hold whole is left for the scroll, unless it is
    // the first drawn (an entry taller than the panel).
    if (rows < parts.length && entries.length > 0) break;
    entries.push({ index, date: dates(index), parts, rows });
    used += rows;
  }
  return { dateCols, textCols, entries };
}

const whole = (entry: PlacedEntry): boolean => entry.rows === entry.parts.length;

/**
 * The log panel: newest first, each entry wrapped under its own text with its date before it,
 * the chosen entry inverted over all its rows, and a scrollbar when the entries do not all fit.
 */
export function drawLogPanel(
  s: Surface,
  rect: Rect,
  lines: readonly LogLine[],
  filter: LogFilter,
  strings: Strings,
  now: number,
  /** A click on an entry with a place: `again` when it was already the chosen entry, which goes there (T-679). */
  onFocus: (line: LogLine, again: boolean) => void,
  view: LogView = new LogView(),
  /** The creatures a line may name, and what a click on a name does (24 § Inspection: inspect that creature). */
  creatures?: LogCreatures,
): void {
  label(s, rect.col + 1, rect.row, strings.get('ui.log.filter'), { width: rect.cols - 2 });
  if (rect.rows > 1) drawPanelFilter(s, rect.col + 1, rect.row + 1, rect.cols - 2, view.filter, { strings });
  const shown = matchLines(s, lines, filter, view.filter.value, strings).reverse();
  if (shown.length === 0) {
    view.reset();
    const empty = view.filter.value === '' ? 'ui.log.empty' : 'ui.log.no_match';
    label(s, rect.col + 1, rect.row + 2, strings.get(empty), { fg: s.theme.dim, width: rect.cols - 2 });
    return;
  }
  // A selection below the newest entry stays on its line while newer lines arrive above it.
  if (view.line !== null && view.selected > 0) {
    const at = shown.indexOf(view.line);
    if (at >= 0) {
      view.scroll = Math.max(0, view.scroll + at - view.selected);
      view.selected = at;
    }
  }
  view.selected = Math.max(0, Math.min(shown.length - 1, view.selected));
  const footer = rect.rows >= 5 ? 1 : 0;
  const top = rect.row + 2;
  const height = rect.rows - 2 - footer;
  if (height <= 0) return;
  const dateOf = new Map<number, string>();
  const dates = (index: number): string => {
    let date = dateOf.get(index);
    if (date === undefined) {
      date = logDate(strings, (shown[index] as LogLine).tick, now);
      dateOf.set(index, date);
    }
    return date;
  };
  const place = (cols: number): LogLayout => {
    view.scroll = Math.max(0, Math.min(view.selected, view.scroll));
    let layout = layoutLog(s, strings, shown, dates, view.scroll, height, cols);
    // Down until the selected entry is whole; an entry taller than the panel is shown from its top.
    while (view.scroll < view.selected && !layout.entries.some((e) => e.index === view.selected && whole(e))) {
      view.scroll += 1;
      layout = layoutLog(s, strings, shown, dates, view.scroll, height, cols);
    }
    // Up while every entry from one earlier to the oldest still fits, so the end of the list fills the panel.
    while (view.scroll > 0) {
      const earlier = layoutLog(s, strings, shown, dates, view.scroll - 1, height, cols);
      const last = earlier.entries[earlier.entries.length - 1];
      if (last === undefined || last.index !== shown.length - 1 || !whole(last)) break;
      view.scroll -= 1;
      layout = earlier;
    }
    return layout;
  };
  let layout = place(rect.cols - 2);
  const end = layout.entries[layout.entries.length - 1];
  const bar = view.scroll > 0 || end === undefined || end.index < shown.length - 1 || !whole(end);
  if (bar) layout = place(rect.cols - 3);
  const cols = rect.cols - 2 - (bar ? 1 : 0);
  view.visible = Math.max(1, layout.entries.filter(whole).length);
  view.line = shown[view.selected] ?? null;
  let row = top;
  for (const entry of layout.entries) {
    const line = shown[entry.index] as LogLine;
    const fg = colorOf(s.theme, line.severity);
    const cells = { col: rect.col + 1, row, cols, rows: entry.rows };
    s.fill(cells, s.theme.black);
    label(s, rect.col + 1, row, entry.date, { fg: s.theme.dim, width: layout.dateCols, keys: false });
    for (let k = 0; k < entry.rows; k += 1) {
      // The last row of an entry the panel cannot hold whole ends with `»`.
      const text = k === entry.rows - 1 && !whole(entry) ? entry.parts.slice(k).join(' ') : entry.parts[k] as string;
      label(s, rect.col + 1 + layout.dateCols, row + k, text, { fg, width: layout.textCols, keys: false });
    }
    // Such an entry's tooltip is the whole entry.
    if (!whole(entry)) s.tooltip(cells, shownText(s, line, strings));
    if (view.chosen && entry.index === view.selected) s.invert(cells);
    s.hit({ col: rect.col, row, cols: cols + 1, rows: entry.rows }, () => {
      const again = view.chosen && view.selected === entry.index;
      view.selected = entry.index;
      view.line = line;
      view.chosen = true;
      if (line.focus !== undefined) onFocus(line, again);
    });
    if (creatures !== undefined) {
      for (let k = 0; k < entry.rows; k += 1) {
        const text = k === entry.rows - 1 && !whole(entry) ? entry.parts.slice(k).join(' ') : entry.parts[k] as string;
        nameHits(s, rect.col + 1 + layout.dateCols, row + k, layout.textCols, text, creatures);
      }
    }
    row += entry.rows;
  }
  if (bar) drawLogScrollbar(s, { col: rect.col + rect.cols - 2, row: top, cols: 1, rows: height }, view, shown.length);
  if (footer === 1) drawLogFooter(s, { col: rect.col + 1, row: rect.row + rect.rows - 1, cols: rect.cols - 2, rows: 1 }, view.line, strings, creatures);
}

/**
 * The action row for the selected entry (T-679): `[Enter] go there` when it has a place, `[v]` and the
 * name of the creature or item it names while that still exists, else that it has neither.
 */
function drawLogFooter(s: Surface, at: Rect, line: LogLine | null, strings: Strings, creatures?: LogCreatures): void {
  const name = line === null || creatures?.subject === undefined ? null : creatures.subject(line);
  const place = line?.focus !== undefined;
  const text = place && name !== null ? strings.get('ui.log.actions_view', { name })
    : place ? strings.get('ui.log.actions')
    : name !== null ? strings.get('ui.log.view_only', { name })
    : strings.get('ui.log.nowhere');
  label(s, at.col, at.row, text, { width: at.cols, ...(place || name !== null ? {} : { fg: s.theme.dim }) });
}

/** A click on a creature's name in a log row inspects it; a longer name wins over a shorter one inside it. */
function nameHits(s: Surface, col: number, row: number, width: number, text: string, creatures: LogCreatures): void {
  const byLength = creatures.names.slice().sort((a, b) => a.name.length - b.name.length);
  for (const { id, name } of byLength) {
    for (let at = text.indexOf(name); at >= 0; at = text.indexOf(name, at + name.length)) {
      const from = Array.from(text.slice(0, at)).length;
      const cols = Math.min(Array.from(name).length, width - from);
      if (cols > 0) s.hit({ col: col + from, row, cols, rows: 1 }, () => creatures.open(id));
    }
  }
}

/** The scrollbar of the log panel, over entries: a press or a drag on the track scrolls to that place. */
function drawLogScrollbar(s: Surface, track: Rect, view: LogView, count: number): void {
  const last = Math.max(1, count - 1);
  const thumbRow = Math.round((view.scroll * (track.rows - 1)) / last);
  const jump = (r: number): void => {
    const at = Math.max(0, Math.min(track.rows - 1, r));
    view.scroll = Math.round((at * last) / Math.max(1, track.rows - 1));
    view.selected = Math.max(view.scroll, Math.min(view.scroll + view.visible - 1, view.selected));
    view.line = null;
  };
  for (let r = 0; r < track.rows; r += 1) {
    s.put(track.col, track.row + r, s.glyphs.index(r === thumbRow ? '█' : '│'), s.theme.border, s.theme.black);
    s.hit({ col: track.col, row: track.row + r, cols: 1, rows: 1 }, () => jump(r));
  }
  s.scrollbar(track, (row) => jump(row - track.row));
}

/**
 * The strip: the last `rect.rows` lines but the combat notes, newest at the bottom; a pinned danger line (shown until
 * any key) takes the bottom row; `flash` draws the strip on the panel background for the alert's
 * second.
 */
export function drawLogStrip(s: Surface, rect: Rect, lines: readonly LogLine[], pinned: LogLine | null, flash: boolean, strings: Strings): void {
  const bg = flash ? s.theme.panelBg : s.theme.black;
  s.fill(rect, bg);
  // The newest lines but the combat notes, which only the Combat tab lists (16 § Combat log).
  const tail: LogLine[] = [];
  for (let k = lines.length - 1; k >= 0 && tail.length < rect.rows; k -= 1) {
    const line = lines[k] as LogLine;
    if (!combatOnly(line)) tail.unshift(line);
  }
  const shown = pinned !== null && !tail.includes(pinned) ? [...tail.slice(1), pinned] : tail;
  // Fill from the newest line back. A hint that does not fit one line wraps over as many of the strip's
  // lines as are left, so an older line is the one cut; every other line is one line, cut with `»`.
  const width = rect.cols - 2;
  const rows: { text: string; color: Rgb }[] = [];
  // A line newer than the pinned danger line leaves it a row: a hint that follows it (the alert hint
  // after a raid's line) wraps under it over the rows left, never over it.
  const pin = pinned === null ? -1 : shown.indexOf(pinned);
  for (let k = shown.length - 1; k >= 0 && rows.length < rect.rows; k -= 1) {
    const line = shown[k] as LogLine;
    const left = rect.rows - rows.length - (pin >= 0 && k > pin ? 1 : 0);
    if (left <= 0) continue;
    const hint = line.category === 'hint';
    const color = hint ? s.theme.value : colorOf(s.theme, line.severity);
    const parts = hint && left >= 2 ? wrapText(shownText(s, line, strings), width, left) : [shownText(s, line, strings)];
    for (let p = parts.length - 1; p >= 0; p -= 1) rows.unshift({ text: parts[p] as string, color });
  }
  const offset = rect.rows - rows.length;
  rows.forEach((row, k) => {
    label(s, rect.col + 1, rect.row + offset + k, row.text, { fg: row.color, bg, width, keys: false });
  });
}
