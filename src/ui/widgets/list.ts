/**
 * `List` (24 § Concepts › Widget; § Panels: "Lists show at most the visible rows with a scrollbar
 * glyph column; selection is inverted"). The rows are text; the last column of the rectangle is
 * the scrollbar (`│` track, `█` thumb) when the rows do not fit.
 */

import type { Rect } from '@render/cellbuffer';
import type { Surface } from '../surface';
import { label } from './label';

export interface ListState {
  selected: number;
  scroll: number;
}

/** Keep the selection inside the rows and visible in a window of `height` rows. */
export function clampList(state: ListState, count: number, height: number): void {
  state.selected = count === 0 ? 0 : Math.max(0, Math.min(count - 1, state.selected));
  const maxScroll = Math.max(0, count - height);
  if (state.selected < state.scroll) state.scroll = state.selected;
  if (state.selected >= state.scroll + height) state.scroll = state.selected - height + 1;
  state.scroll = Math.max(0, Math.min(maxScroll, state.scroll));
}

export function list(
  s: Surface,
  rect: Rect,
  rows: readonly string[],
  state: ListState,
  onSelect?: (index: number) => void,
): void {
  clampList(state, rows.length, rect.rows);
  const scrollbar = rows.length > rect.rows;
  const width = scrollbar ? rect.cols - 1 : rect.cols;
  for (let r = 0; r < rect.rows; r += 1) {
    const index = state.scroll + r;
    const row = rect.row + r;
    s.fill({ col: rect.col, row, cols: width, rows: 1 }, s.theme.black);
    if (index >= rows.length) continue;
    label(s, rect.col, row, rows[index] as string, { width });
    const cells = { col: rect.col, row, cols: width, rows: 1 };
    if (index === state.selected) s.invert(cells);
    if (onSelect !== undefined) s.hit(cells, () => onSelect(index));
  }
  if (!scrollbar) return;
  const track = s.glyphs.index('│');
  const thumb = s.glyphs.index('█');
  const thumbRow = Math.floor((state.scroll * (rect.rows - 1)) / Math.max(1, rows.length - rect.rows));
  const maxScroll = Math.max(0, rows.length - rect.rows);
  // A press on the track jumps the list to that place and a drag along it follows the pointer; the
  // scroll is proportional to the pointer's row and the selection stays inside the window.
  const jump = (r: number): void => {
    const at = Math.max(0, Math.min(rect.rows - 1, r));
    state.scroll = Math.round((at * maxScroll) / Math.max(1, rect.rows - 1));
    state.selected = Math.max(state.scroll, Math.min(state.scroll + rect.rows - 1, state.selected));
  };
  const trackRect = { col: rect.col + rect.cols - 1, row: rect.row, cols: 1, rows: rect.rows };
  for (let r = 0; r < rect.rows; r += 1) {
    s.put(trackRect.col, rect.row + r, r === thumbRow ? thumb : track, s.theme.border, s.theme.black);
    s.hit({ col: trackRect.col, row: rect.row + r, cols: 1, rows: 1 }, () => jump(r));
  }
  s.scrollbar(trackRect, (row) => jump(row - rect.row));
}
