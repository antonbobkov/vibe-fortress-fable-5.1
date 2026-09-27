/**
 * The log panel and the log strip.
 *
 * 24 § Announcements and the log: "The log panel lists everything with filters by severity and
 * category …, newest first, and jumps to the focus on click"; `ui-screens/fortress-screen.md`:
 * "The log strip shows the last three announcements; danger lines are prefixed `!!`, alerts `!`".
 * The combat tab belongs to 16 (M6).
 */

import type { Rect } from '@render/cellbuffer';
import type { Rgb } from '@render/palette';
import { lineText, type LogLine, type Severity } from '../announcements';
import type { Strings } from '../strings';
import type { Surface, Theme } from '../surface';
import { label } from '../widgets';

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

export function drawLogPanel(
  s: Surface,
  rect: Rect,
  lines: readonly LogLine[],
  filter: LogFilter,
  strings: Strings,
  onFocus: (line: LogLine) => void,
): void {
  label(s, rect.col + 1, rect.row, '[1] All  [2] Alerts  [3] Combat', { width: rect.cols - 2 });
  const shown = filterLines(lines, filter).reverse();
  if (shown.length === 0) {
    label(s, rect.col + 1, rect.row + 2, strings.get('ui.log.empty'), { fg: s.theme.dim });
    return;
  }
  for (let k = 0; k < rect.rows - 2 && k < shown.length; k += 1) {
    const line = shown[k] as LogLine;
    const row = rect.row + 2 + k;
    s.text(rect.col + 1, row, lineText(line), colorOf(s.theme, line.severity), s.theme.black, rect.cols - 2);
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
  const offset = rect.rows - shown.length;
  shown.forEach((line, k) => {
    s.text(rect.col + 1, rect.row + offset + k, lineText(line), colorOf(s.theme, line.severity), bg, rect.cols - 2);
  });
}
