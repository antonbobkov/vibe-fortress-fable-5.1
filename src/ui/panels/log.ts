/**
 * The log panel and the log strip.
 *
 * 24 § Announcements and the log: "The log panel lists everything with filters by severity and
 * category …, newest first, and jumps to the focus on click"; `ui-screens/fortress-screen.md`:
 * "The log strip shows the last three announcements; danger lines are prefixed `!!`, alerts `!`".
 * The combat tab belongs to 16 (M6).
 */

import { dayOfSeasonOf, seasonOf, yearOf } from '@core/calendar';
import type { Rect } from '@render/cellbuffer';
import type { Rgb } from '@render/palette';
import { lineText, type LogLine, type Severity } from '../announcements';
import type { Strings } from '../strings';
import type { Surface, Theme } from '../surface';
import { label } from '../widgets';
import { wrapText } from '../messages';

/** `0` all, `1` alerts and danger, `2` combat. */
export type LogFilter = 0 | 1 | 2;

export function colorOf(theme: Theme, severity: Severity): Rgb {
  return severity === 'danger' ? theme.danger : severity === 'alert' ? theme.alert : theme.note;
}

export function filterLines(lines: readonly LogLine[], filter: LogFilter): LogLine[] {
  if (filter === 0) return lines.slice();
  if (filter === 1) return lines.filter((l) => l.severity !== 'note');
  return lines.filter((l) => l.category === 'combat');
}

/** A log row's date: "Sp 8", with the year ("Y2 Sp 8") for a line of an earlier year than `now`. */
export function logDate(strings: Strings, tick: number, now: number): string {
  const season = strings.get(`ui.log.season.${seasonOf(tick)}`);
  const day = dayOfSeasonOf(tick);
  return yearOf(tick) === yearOf(now) ? strings.get('ui.log.date', { season, day }) : strings.get('ui.log.date_year', { year: yearOf(tick), season, day });
}

export function drawLogPanel(
  s: Surface,
  rect: Rect,
  lines: readonly LogLine[],
  filter: LogFilter,
  strings: Strings,
  now: number,
  onFocus: (line: LogLine) => void,
): void {
  label(s, rect.col + 1, rect.row, strings.get('ui.log.filter'), { width: rect.cols - 2 });
  const shown = filterLines(lines, filter).reverse();
  if (shown.length === 0) {
    label(s, rect.col + 1, rect.row + 2, strings.get('ui.log.empty'), { fg: s.theme.dim });
    return;
  }
  const visible = shown.slice(0, Math.max(0, rect.rows - 2));
  const dates = visible.map((line) => logDate(strings, line.tick, now));
  const dateCols = Math.max(0, ...dates.map((date) => Array.from(date).length)) + 1;
  for (let k = 0; k < visible.length; k += 1) {
    const line = visible[k] as LogLine;
    const row = rect.row + 2 + k;
    s.text(rect.col + 1, row, dates[k] as string, s.theme.dim, s.theme.black, Math.min(dateCols, rect.cols - 2));
    s.text(rect.col + 1 + dateCols, row, lineText(line), colorOf(s.theme, line.severity), s.theme.black, Math.max(0, rect.cols - 2 - dateCols));
    if (line.focus !== undefined) s.hit({ col: rect.col, row, cols: rect.cols, rows: 1 }, () => onFocus(line));
  }
}

/**
 * The strip: the last `rect.rows` lines, newest at the bottom; a pinned danger line (shown until
 * any key) takes the bottom row; `flash` draws the strip on the panel background for the alert's
 * second.
 */
export function drawLogStrip(s: Surface, rect: Rect, lines: readonly LogLine[], pinned: LogLine | null, flash: boolean): void {
  const bg = flash ? s.theme.panelBg : s.theme.black;
  s.fill(rect, bg);
  const tail = lines.slice(Math.max(0, lines.length - rect.rows));
  const shown = pinned !== null && !tail.includes(pinned) ? [...tail.slice(1), pinned] : tail;
  // A hint that does not fit one line takes two of the strip's lines; every other line is cut with `»`.
  const width = rect.cols - 2;
  const rows = shown.flatMap((line) => {
    const hint = line.category === 'hint';
    const color = hint ? s.theme.value : colorOf(s.theme, line.severity);
    return (hint ? wrapText(lineText(line), width, 2) : [lineText(line)]).map((text) => ({ text, color }));
  }).slice(-rect.rows);
  const offset = rect.rows - rows.length;
  rows.forEach((row, k) => {
    label(s, rect.col + 1, rect.row + offset + k, row.text, { fg: row.color, bg, width, keys: false });
  });
}
