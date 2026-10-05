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

/** One tooltip region: the cell bounds of a truncated widget and its full text. */
export interface TooltipRegion {
  readonly rect: Rect;
  readonly text: string;
}

export class Surface {
  readonly hits: HitRegion[] = [];
  readonly tooltips: TooltipRegion[] = [];

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

  /** Swap `fg` and `bg` over a rectangle: the selection and cursor style. */
  invert(rect: Rect): void {
    for (let r = 0; r < rect.rows; r += 1) {
      for (let c = 0; c < rect.cols; c += 1) {
        const col = rect.col + c;
        const row = rect.row + r;
        if (!this.inside(col, row)) continue;
        const cell = this.cells.get(col, row);
        this.cells.set(col, row, cell.glyph, cell.bg, cell.fg);
      }
    }
  }

  /** Record a clickable region. */
  hit(rect: Rect, action: () => void): void {
    this.hits.push({ rect, action });
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

  /** Record a tooltip for a truncated cell or label. */
  tooltip(rect: Rect, text: string): void {
    this.tooltips.push({ rect, text });
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
