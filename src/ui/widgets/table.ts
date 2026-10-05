/**
 * `Table` (24 § Concepts › Widget): a header row and fixed-width columns over a `List` (§ Panels:
 * "Lists show at most the visible rows with a scrollbar glyph column; selection is inverted").
 */

import type { Rect } from '@render/cellbuffer';
import type { Surface } from '../surface';
import { label } from './label';
import { list, type ListState } from './list';

export interface Column {
  readonly title: string;
  /** Cells; the last column takes what is left. */
  readonly width: number;
  readonly align?: 'left' | 'right';
}

/** One row's cells laid out in the columns (padded or clipped). */
export function tableRow(columns: readonly Column[], cells: readonly string[], total: number): string {
  let out = '';
  columns.forEach((c, k) => {
    const last = k === columns.length - 1;
    const width = last ? Math.max(0, total - out.length) : c.width;
    // A column keeps one blank before the next.
    const text = Array.from(cells[k] ?? '').slice(0, last ? width : Math.max(0, width - 1)).join('');
    const pad = ' '.repeat(Math.max(0, width - Array.from(text).length));
    out += c.align === 'right' ? pad + text : text + pad;
  });
  return out;
}

export function table(
  s: Surface,
  rect: Rect,
  columns: readonly Column[],
  rows: readonly (readonly string[])[],
  state: ListState,
  onSelect?: (index: number) => void,
): void {
  if (rect.rows <= 0) return;
  label(s, rect.col, rect.row, tableRow(columns, columns.map((c) => c.title), rect.cols), { fg: s.theme.key, width: rect.cols, keys: false });
  list(
    s,
    { col: rect.col, row: rect.row + 1, cols: rect.cols, rows: rect.rows - 1 },
    rows.map((r) => tableRow(columns, r, rect.cols)),
    state,
    onSelect,
  );

  let headOffset = 0;
  for (let k = 0; k < columns.length; k += 1) {
    const c = columns[k] as Column;
    const last = k === columns.length - 1;
    const colWidth = last ? Math.max(0, rect.cols - headOffset) : c.width;
    const contentWidth = last ? colWidth : Math.max(0, colWidth - 1);
    if (Array.from(c.title).length > contentWidth && colWidth > 0) {
      s.tooltip({ col: rect.col + headOffset, row: rect.row, cols: colWidth, rows: 1 }, c.title.trim());
    }
    headOffset += colWidth;
  }

  const listHeight = rect.rows - 1;
  if (listHeight <= 0) return;
  const scrollbar = rows.length > listHeight;
  const listWidth = scrollbar ? rect.cols - 1 : rect.cols;

  for (let r = 0; r < listHeight; r += 1) {
    const index = state.scroll + r;
    if (index >= rows.length) break;
    const cells = rows[index];
    if (!cells) continue;
    let offset = 0;
    for (let k = 0; k < columns.length; k += 1) {
      const c = columns[k] as Column;
      const last = k === columns.length - 1;
      const colWidth = last ? Math.max(0, listWidth - offset) : c.width;
      const contentWidth = last ? colWidth : Math.max(0, colWidth - 1);
      const text = cells[k] ?? '';
      const chars = Array.from(text);
      if (chars.length > contentWidth && colWidth > 0) {
        const cleanText = text.replace(/^[▶\s]+/, '').replace(/\s+$/, '');
        s.tooltip({ col: rect.col + offset, row: rect.row + 1 + r, cols: colWidth, rows: 1 }, cleanText.length > 0 ? cleanText : text);
      }
      offset += colWidth;
    }
  }
}
