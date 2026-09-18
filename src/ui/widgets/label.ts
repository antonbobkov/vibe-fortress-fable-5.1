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
  if (options.keys === false) return s.text(col, row, text, fg, bg, width);
  const chars = Array.from(text);
  let written = 0;
  let inKey = false;
  for (let k = 0; k < chars.length && written < width; k += 1) {
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
  return written;
}

/** A label padded with blanks to exactly `width` cells (so a row is fully repainted). */
export function labelRow(s: Surface, col: number, row: number, width: number, text: string, options: LabelOptions = {}): void {
  const bg = options.bg ?? s.theme.black;
  s.fill({ col, row, cols: width, rows: 1 }, bg);
  label(s, col, row, text, { ...options, width });
}
