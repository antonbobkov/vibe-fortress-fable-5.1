/**
 * `Label` (24 § Concepts › Widget): one line of text, clipped to its width. A label may carry
 * accelerators written `[k]`: the bracketed key is drawn in `text_key` (23 § Text cells: "yellow
 * for shortcuts"), the rest in the label's color.
 */

import type { Rgb } from '@render/palette';
import type { Surface } from '../surface';

export interface LabelOptions {
  readonly fg?: Rgb;
  readonly bg?: Rgb;
  readonly width?: number;
  /** Color the `[k]` accelerators; on by default. */
  readonly keys?: boolean;
}

/** Draw a label; returns the cells written. */
export function label(s: Surface, col: number, row: number, text: string, options: LabelOptions = {}): number {
  const fg = options.fg ?? s.theme.text;
  const bg = options.bg ?? s.theme.black;
  const width = options.width ?? Infinity;
  const chars = Array.from(text);
  const cut = chars.length > width && width > 0;
  if (chars.length > width && width > 0) {
    const cleanText = text.replace(/^[▶\s]+/, '').replace(/\s+$/, '');
    s.tooltip({ col, row, cols: width, rows: 1 }, cleanText.length > 0 ? cleanText : text);
  }
  // 24 § Rules: text that does not fit ends with `»` and has a tooltip with the whole text.
  if (options.keys === false) return s.text(col, row, cut ? `${chars.slice(0, width - 1).join('')}»` : text, fg, bg, width);
  const shown = cut ? width - 1 : width;
  let written = 0;
  let inKey = false;
  for (let k = 0; k < chars.length && written < shown; k += 1) {
    const ch = chars[k] as string;
    if (ch === '[') {
      const close = chars.indexOf(']', k);
      inKey = close > k && close - k <= 7;
    }
    const color = inKey ? s.theme.key : fg;
    s.put(col + written, row, s.glyphs.index(ch), color, bg);
    written += 1;
    if (ch === ']') inKey = false;
  }
  if (cut) {
    s.put(col + written, row, s.glyphs.index('»'), fg, bg);
    written += 1;
  }
  return written;
}

/** A label padded with blanks to exactly `width` cells (so a row is fully repainted). */
export function labelRow(s: Surface, col: number, row: number, width: number, text: string, options: LabelOptions = {}): void {
  const bg = options.bg ?? s.theme.black;
  s.fill({ col, row, cols: width, rows: 1 }, bg);
  label(s, col, row, text, { ...options, width });
}

/**
 * Draw a tooltip overlay if the pointer hovers over a truncated cell (24 § Input model).
 */
export function drawTooltip(s: Surface, pointer: { col: number; row: number } | null): void {
  if (pointer === null) return;
  const tip = s.tooltipAt(pointer.col, pointer.row);
  if (tip === null) return;
  const t = s.theme;
  const text = tip.text;
  const chars = Array.from(text);
  const width = Math.min(s.cols, chars.length + 2);
  if (width <= 0) return;
  const boxCol = Math.max(0, Math.min(s.cols - width, tip.rect.col));
  const boxRow = pointer.row > 0 ? pointer.row - 1 : pointer.row + 1;
  if (boxRow < 0 || boxRow >= s.rows) return;
  s.fill({ col: boxCol, row: boxRow, cols: width, rows: 1 }, t.panelBg);
  s.put(boxCol, boxRow, s.glyphs.index('['), t.border, t.panelBg);
  s.text(boxCol + 1, boxRow, text, t.value, t.panelBg, width - 2);
  s.put(boxCol + width - 1, boxRow, s.glyphs.index(']'), t.border, t.panelBg);
}
