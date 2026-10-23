/**
 * `Label` (24 § Concepts › Widget): one line of text, clipped to its width. A label may carry
 * accelerators written `[k]`: the bracketed key is drawn in `text_key` (23 § Text cells: "yellow
 * for shortcuts"), the rest in the label's color.
 */

import type { Rgb } from '@render/palette';
import type { KeyContext } from '../keymap';
import type { Surface } from '../surface';

export interface LabelOptions {
  readonly fg?: Rgb;
  readonly bg?: Rgb;
  readonly width?: number;
  /** Color the `[k]` accelerators; on by default. */
  readonly keys?: boolean;
  /**
   * Whether the `[k]` keys are named as the live keymap binds them (the surface's
   * {@link Surface.keyNames}): `false` never (a `[x]` button), `true` or the contexts to read them
   * in always, and by default whenever the keys are coloured.
   */
  readonly relabel?: boolean | readonly KeyContext[];
}

/** The text of a label with its `[k]` keys named as the live keymap binds them. */
function named(s: Surface, text: string, options: LabelOptions): string {
  const relabel = options.relabel;
  if (relabel !== false && s.keyNames !== null && (options.keys !== false || relabel !== undefined)) return s.keyNames(text, relabel === true || relabel === undefined ? undefined : relabel);
  return text;
}

/** Draw a label; returns the cells written. */
export function label(s: Surface, col: number, row: number, text: string, options: LabelOptions = {}): number {
  text = named(s, text, options);
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

/** One `[k]` key of a caption: the key as written, and the cells its bracketed name takes as drawn. */
export interface KeyCell {
  readonly key: string;
  readonly from: number;
  readonly cols: number;
}

/** Where the `[k]` keys of a text start and end, in characters. */
function bracketed(chars: readonly string[]): { readonly from: number; readonly close: number }[] {
  const out: { from: number; close: number }[] = [];
  for (let k = 0; k < chars.length; k += 1) {
    if (chars[k] !== '[') continue;
    const close = chars.indexOf(']', k);
    if (close <= k || close - k > 20 || /[\s[]/.test(chars.slice(k + 1, close).join(''))) continue;
    out.push({ from: k, close });
    k = close;
  }
  return out;
}

/**
 * The `[k]` keys of a caption as `label` draws it, with the key each was written with: a key the
 * keymap has rebound takes the cells of its new name, and the keys after it move with it. A click
 * region over a key is measured here, not on the text as written.
 */
export function keyCells(s: Surface, text: string, options: LabelOptions = {}): KeyCell[] {
  const written = Array.from(text);
  const drawn = Array.from(named(s, text, options));
  const was = bracketed(written);
  const now = bracketed(drawn);
  if (was.length !== now.length) return [];
  // Text that does not fit ends with `»`: a key past the cut, or cut through, is not drawn whole.
  const room = options.width !== undefined && options.width > 0 && drawn.length > options.width ? options.width - 1 : Infinity;
  return now
    .map((cell, i) => ({ key: written.slice((was[i] as { from: number }).from + 1, (was[i] as { close: number }).close).join(''), from: cell.from, cols: cell.close - cell.from + 1 }))
    .filter((cell) => cell.from + cell.cols <= room);
}

/**
 * Draw a caption of `[k] words` pieces (`[S-t] train  [x] disband`) and make each piece clickable at
 * the cells it is drawn in: a piece starts at its `[` and ends before the blanks that precede the
 * next one, measured on the text as drawn, so a rebound key with a longer or shorter name moves the
 * pieces after it and their click regions with it. `runs[i]` is what the i-th piece does, or `null`
 * for a piece that does nothing now. Returns the cells written.
 */
export function captionButtons(
  s: Surface,
  col: number,
  row: number,
  text: string,
  runs: readonly (null | (() => void))[],
  options: LabelOptions = {},
): number {
  const written = label(s, col, row, text, options);
  const chars = Array.from(named(s, text, options));
  const cells = keyCells(s, text, options);
  cells.forEach((cell, i) => {
    const run = runs[i];
    if (run === undefined || run === null) return;
    let end = Math.min(written, cells[i + 1]?.from ?? chars.length);
    while (end > cell.from + 1 && /\s/.test(chars[end - 1] as string)) end -= 1;
    if (end > cell.from) s.hit({ col: col + cell.from, row, cols: end - cell.from, rows: 1 }, run);
  });
  return written;
}

/**
 * Draw what a text or number field shows with its captions as written: the field reads its keys as
 * they are (`ui-keymap-and-screens.md` § Fixed keys), so a rebinding must not rename them.
 */
export function asWritten(s: Surface, draw: () => void): void {
  const names = s.keyNames;
  s.keyNames = null;
  try {
    draw();
  } finally {
    s.keyNames = names;
  }
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
