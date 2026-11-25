/**
 * Text cells.
 *
 * `02-systems/23-rendering.md` § Text cells: "Panels and bars are drawn as text into the same cell
 * buffer by the UI's widgets: `fg` text colors (white, gray, yellow for shortcuts, cyan for
 * values, red/green for bad/good), `bg` black or a dark panel color, inverted for selection. Panel
 * borders use box-drawing glyphs. The renderer does not know the difference between a map cell
 * and a text cell."
 *
 * A {@link Surface} writes strings into a {@link CellBuffer} through the glyph set of
 * `glyphs-and-colors.md` § Glyph set, and records the clickable regions its widgets draw so the
 * mouse reaches every action the keyboard does (24 § Input model: "Keyboard and mouse produce the
 * same actions").
 */

import type { Registry } from '@core/registry';
import { glyphChars } from '@render/atlas';
import type { CellBuffer, Rect } from '@render/cellbuffer';
import type { Palette, Rgb } from '@render/palette';
import type { KeyContext } from './keymap';

/** The UI colors of `glyphs-and-colors.md` § State and UI colors, resolved once. */
export interface Theme {
  readonly black: Rgb;
  readonly panelBg: Rgb;
  readonly border: Rgb;
  readonly text: Rgb;
  readonly dim: Rgb;
  readonly key: Rgb;
  readonly value: Rgb;
  readonly good: Rgb;
  readonly bad: Rgb;
  readonly note: Rgb;
  readonly alert: Rgb;
  readonly danger: Rgb;
  /** The build ghost's backgrounds (23 § Compositor step 10). */
  readonly ghostOk: Rgb;
  readonly ghostBad: Rgb;
  /** § Status bar glyphs: heatwave red, cold snap cyan, the moon dark cyan (T-M3-08). */
  readonly hot: Rgb;
  readonly cold: Rgb;
  readonly moon: Rgb;
}

export function themeOf(palette: Palette): Theme {
  return {
    black: palette.color('black'),
    panelBg: palette.color('panel_bg'),
    border: palette.color('panel_border'),
    text: palette.color('text'),
    dim: palette.color('text_dim'),
    key: palette.color('text_key'),
    value: palette.color('text_value'),
    good: palette.color('text_good'),
    bad: palette.color('text_bad'),
    note: palette.color('note'),
    alert: palette.color('alert'),
    danger: palette.color('danger'),
    ghostOk: palette.color('ghost_ok'),
    ghostBad: palette.color('ghost_bad'),
    hot: palette.color('red'),
    cold: palette.color('cyan'),
    moon: palette.color('dark_cyan'),
  };
}

/** Characters the documents write that the glyph set carries under a near-identical code point. */
export const GLYPH_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  '▶': '►',
  '×': 'x',
  '–': '-',
  '—': '-',
  // The panel wireframes' tree arrows and check boxes (D-077).
  '▸': '►',
  '▾': '▼',
  '□': ' ',
  '▪': '∙',
  '…': '»',
  // Q7: the recipe list's makeable dot, a request's priority star, and a newline in a text cell.
  '●': '•',
  '★': '☼',
  '\n': ' ',
});

/** Character to glyph index over the whole glyph set; CP437 first, then the content extras. */
export class GlyphMap {
  private readonly byChar = new Map<string, number>();
  readonly chars: readonly string[];
  readonly unknown: number;

  constructor(chars: readonly string[]) {
    this.chars = chars;
    for (let i = 0; i < chars.length; i += 1) {
      const ch = chars[i] as string;
      if (!this.byChar.has(ch)) this.byChar.set(ch, i);
    }
    // CP437 has no glyph for index 0's space and 32 is the ASCII space; both draw nothing.
    this.byChar.set(' ', 32);
    // A no-break space keeps two words on one row when a line wraps (`splint ×4`); it is drawn, and read back, as a space.
    this.byChar.set('\u00a0', 32);
    // The documents write U+25B6, the multiplication sign and dashes that CP437 lacks: their nearest CP437 glyphs.
    for (const [alias, ch] of Object.entries(GLYPH_ALIASES)) {
      const at = this.byChar.get(ch);
      if (at !== undefined && !this.byChar.has(alias)) this.byChar.set(alias, at);
    }
    this.unknown = this.byChar.get('?') ?? 63;
  }

  static of(registry: Registry): GlyphMap {
    return new GlyphMap(glyphChars(registry));
  }

  index(ch: string): number {
    return this.byChar.get(ch) ?? this.unknown;
  }

  char(index: number): string {
    return this.chars[index] ?? ' ';
  }
}

/** One clickable region: the cells of a widget and what clicking it does. */
export interface HitRegion {
  readonly rect: Rect;
  readonly action: () => void;
}

/** A scrollbar track: pressing on it, or dragging along it, sets the list's scroll from the pointer's row. */
export interface ScrollRegion {
  readonly rect: Rect;
  /** Scroll the list to the place that screen row stands for (the row is clamped to the track). */
  set(row: number): void;
}

/** One tooltip region: the cell bounds of a truncated widget and its full text. */
export interface TooltipRegion {
  readonly rect: Rect;
  readonly text: string;
  /** False: the text shows on the status row only, with no box over the row above (a table's rows). */
  readonly box?: boolean;
}

export class Surface {
  readonly hits: HitRegion[] = [];
  readonly scrollbars: ScrollRegion[] = [];
  readonly tooltips: TooltipRegion[] = [];
  /**
   * Names the keys of a caption as the live keymap binds them (24 § Settings: a rebinding shows
   * wherever a key is named). The screen that draws sets it with the contexts its keys act in;
   * `contexts` replaces those for one caption. `null` draws captions as they are written.
   */
  keyNames: ((text: string, contexts?: readonly KeyContext[]) => string) | null = null;
  /**
   * The cell the compositor drew the map cursor on this frame, or null. A box drawn over the map
   * keeps its own colours everywhere else and leaves this cell to the cursor (23 § Compositor step 10).
   */
  mapCursor: { readonly col: number; readonly row: number } | null = null;

  constructor(
    readonly cells: CellBuffer,
    readonly glyphs: GlyphMap,
    readonly theme: Theme,
    /**
     * The live palette, when the caller has one. The glyph legend of `ui-screens/panels.md` § Help
     * draws content colours by their palette row name, including the colorblind alternates, which
     * the fixed {@link Theme} cannot name (T-M7-08).
     */
    readonly palette: Palette | null = null,
  ) {}

  /** A palette row by name, or the theme's text colour when no palette was given. */
  color(id: string): Rgb {
    const palette = this.palette;
    if (palette === null || !palette.has(id)) return this.theme.text;
    return palette.color(id);
  }

  get cols(): number {
    return this.cells.cols;
  }

  get rows(): number {
    return this.cells.rows;
  }

  inside(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cells.cols && row < this.cells.rows;
  }

  /** One glyph; outside the buffer it draws nothing. */
  put(col: number, row: number, glyph: number, fg: Rgb, bg: Rgb): void {
    if (!this.inside(col, row)) return;
    this.cells.set(col, row, glyph, fg, bg);
  }

  /**
   * A string from `(col, row)`, clipped to `width` cells (and the buffer). Returns the number of
   * cells written.
   */
  text(col: number, row: number, text: string, fg: Rgb, bg: Rgb = this.theme.black, width = Infinity): number {
    const chars = Array.from(text);
    const n = Math.min(chars.length, width);
    for (let k = 0; k < n; k += 1) this.put(col + k, row, this.glyphs.index(chars[k] as string), fg, bg);
    return n;
  }

  /** Fill a rectangle with blanks on `bg`. */
  fill(rect: Rect, bg: Rgb, fg: Rgb = this.theme.text): void {
    for (let r = 0; r < rect.rows; r += 1) {
      for (let c = 0; c < rect.cols; c += 1) this.put(rect.col + c, rect.row + r, 32, fg, bg);
    }
  }

  /**
   * Swap `fg` and `bg` over a rectangle: the selection and cursor style. With `visible`, a cell
   * whose colours are nearly alike (unexplored rock on the map) takes the text colour as its
   * background instead, so a map selection always shows (23 § Step 10).
   */
  invert(rect: Rect, visible = false): void {
    for (let r = 0; r < rect.rows; r += 1) {
      for (let c = 0; c < rect.cols; c += 1) {
        const col = rect.col + c;
        const row = rect.row + r;
        if (!this.inside(col, row)) continue;
        const cell = this.cells.get(col, row);
        if (visible && lumaGap(cell.fg, cell.bg) < INVERT_MIN_GAP) this.cells.set(col, row, cell.glyph, this.theme.black, this.theme.text);
        else this.cells.set(col, row, cell.glyph, cell.bg, cell.fg);
      }
    }
  }

  /** Whether a cell is the map cursor's (see {@link mapCursor}). */
  isMapCursor(col: number, row: number): boolean {
    return this.mapCursor !== null && this.mapCursor.col === col && this.mapCursor.row === row;
  }

  /** {@link invert} a box on the map, made visible everywhere, leaving the map cursor's cell as it is. */
  invertMap(rect: Rect): void {
    const at = this.mapCursor;
    const inside = at !== null && at.col >= rect.col && at.col < rect.col + rect.cols && at.row >= rect.row && at.row < rect.row + rect.rows;
    const keep = inside ? this.cells.get(at.col, at.row) : null;
    this.invert(rect, true);
    if (keep !== null && at !== null) this.cells.setCell(at.col, at.row, keep);
  }

  /** Record a clickable region. */
  hit(rect: Rect, action: () => void): void {
    this.hits.push({ rect, action });
  }

  /** Record a scrollbar track (a list's last column). */
  scrollbar(rect: Rect, set: (row: number) => void): void {
    this.scrollbars.push({ rect, set });
  }

  /** The scrollbar track under a cell, if any. */
  scrollbarAt(col: number, row: number): ScrollRegion | null {
    for (let k = this.scrollbars.length - 1; k >= 0; k -= 1) {
      const b = this.scrollbars[k] as ScrollRegion;
      const r = b.rect;
      if (col >= r.col && row >= r.row && col < r.col + r.cols && row < r.row + r.rows) return b;
    }
    return null;
  }

  /** The topmost region under a cell (the last drawn wins). */
  hitAt(col: number, row: number): HitRegion | null {
    for (let k = this.hits.length - 1; k >= 0; k -= 1) {
      const h = this.hits[k] as HitRegion;
      const r = h.rect;
      if (col >= r.col && row >= r.row && col < r.col + r.cols && row < r.row + r.rows) return h;
    }
    return null;
  }

  /** Record a tooltip for a truncated cell or label; `box: false` keeps it to the status row. */
  tooltip(rect: Rect, text: string, options: { box?: boolean } = {}): void {
    this.tooltips.push(options.box === false ? { rect, text, box: false } : { rect, text });
  }

  /** The topmost tooltip under a cell (the last recorded wins). */
  tooltipAt(col: number, row: number): TooltipRegion | null {
    for (let k = this.tooltips.length - 1; k >= 0; k -= 1) {
      const t = this.tooltips[k] as TooltipRegion;
      const r = t.rect;
      if (col >= r.col && row >= r.row && col < r.col + r.cols && row < r.row + r.rows) return t;
    }
    return null;
  }

  /** The buffer's rows decoded to text: what the e2e harness and the tests read. */
  lines(): string[] {
    const out: string[] = [];
    for (let row = 0; row < this.cells.rows; row += 1) out.push(rowText(this.cells, this.glyphs, row));
    return out;
  }
}

/** One row of a cell buffer as text; blank glyphs read as spaces. */
export function rowText(cells: CellBuffer, glyphs: GlyphMap, row: number): string {
  let s = '';
  for (let col = 0; col < cells.cols; col += 1) {
    const g = cells.glyph[row * cells.cols + col] as number;
    s += g === 0 ? ' ' : glyphs.char(g);
  }
  return s;
}

/** The smallest luma gap (0-255) between a cell's colours at which swapping them still shows. */
const INVERT_MIN_GAP = 48;

function lumaGap(a: Rgb, b: Rgb): number {
  const luma = (c: Rgb): number => 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);
  return Math.abs(luma(a) - luma(b));
}
