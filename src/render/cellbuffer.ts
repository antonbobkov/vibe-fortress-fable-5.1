/**
 * The cell buffer and the screen layout.
 *
 * Implements `02-systems/23-rendering.md` § Canvas and cells: "One `<canvas>` ... Cell size
 * `CELL_PX_ZOOM_1 × zoom`", the `cols`/`rows` arithmetic with the zoom step-down rule, and the
 * layout of `24-ui-and-input.md` § Fortress screen layout (map viewport, sidebar, log strip,
 * status bar), expressed as `algorithms/compositor.md` § Layout writes it.
 *
 * A cell is `{ glyph, fg, bg }` (23 § Concepts). The buffer keeps the three fields in parallel
 * typed arrays: the whole screen is rewritten every composed frame, and the compositor's golden
 * files compare it cell by cell.
 */

import {
  CELL_PX_ZOOM_1,
  MIN_VIEW_COLS,
  MIN_VIEW_ROWS,
  SIDEBAR_COLS,
  STATUS_ROWS,
  ZOOM_LEVELS,
} from '@core/constants';
import { LOG_ROWS } from './constants';
import type { Rgb } from './palette';

/** One screen position. */
export interface Cell {
  readonly glyph: number;
  readonly fg: Rgb;
  readonly bg: Rgb;
}

/**
 * CP437 index 0 and the ASCII space both draw nothing, so the renderer skips them
 * (`algorithms/compositor.md` § draw: "for each cell with glyph != ' '").
 */
export const GLYPH_BLANK = 0;
export const GLYPH_SPACE = 32;

export function isBlankGlyph(glyph: number): boolean {
  return glyph === GLYPH_BLANK || glyph === GLYPH_SPACE;
}

export class CellBuffer {
  readonly cols: number;
  readonly rows: number;
  readonly glyph: Uint16Array;
  readonly fg: Int32Array;
  readonly bg: Int32Array;

  constructor(cols: number, rows: number) {
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 0 || rows < 0) {
      throw new RangeError(`CellBuffer: bad size ${cols}x${rows}`);
    }
    this.cols = cols;
    this.rows = rows;
    this.glyph = new Uint16Array(cols * rows);
    this.fg = new Int32Array(cols * rows);
    this.bg = new Int32Array(cols * rows);
  }

  get length(): number {
    return this.cols * this.rows;
  }

  index(col: number, row: number): number {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) {
      throw new RangeError(`CellBuffer: (${col}, ${row}) is outside ${this.cols}x${this.rows}`);
    }
    return row * this.cols + col;
  }

  set(col: number, row: number, glyph: number, fg: Rgb, bg: Rgb): void {
    const i = this.index(col, row);
    this.glyph[i] = glyph;
    this.fg[i] = fg;
    this.bg[i] = bg;
  }

  setCell(col: number, row: number, cell: Cell): void {
    this.set(col, row, cell.glyph, cell.fg, cell.bg);
  }

  get(col: number, row: number): Cell {
    const i = this.index(col, row);
    return { glyph: this.glyph[i] as number, fg: this.fg[i] as number, bg: this.bg[i] as number };
  }

  fill(glyph: number, fg: Rgb, bg: Rgb): void {
    this.glyph.fill(glyph);
    this.fg.fill(fg);
    this.bg.fill(bg);
  }

  /** Cell-for-cell equality; the frame loop keeps two buffers for change detection (23 § State). */
  equals(other: CellBuffer): boolean {
    if (other.cols !== this.cols || other.rows !== this.rows) return false;
    for (let i = 0; i < this.glyph.length; i += 1) {
      if (this.glyph[i] !== other.glyph[i]) return false;
      if (this.fg[i] !== other.fg[i]) return false;
      if (this.bg[i] !== other.bg[i]) return false;
    }
    return true;
  }
}

/** A rectangle of cells. */
export interface Rect {
  readonly col: number;
  readonly row: number;
  readonly cols: number;
  readonly rows: number;
}

/** The four regions of the fortress screen. */
export interface Layout {
  readonly cols: number;
  readonly rows: number;
  readonly map: Rect;
  readonly sidebar: Rect | null;
  readonly log: Rect;
  readonly status: Rect;
}

/**
 * `algorithms/compositor.md` § Layout: `sidebarCols = open ? SIDEBAR_COLS : 0`;
 * `mapCols = cols − sidebarCols`; `mapRows = rows − STATUS_ROWS − LOG_ROWS`. The log strip and the
 * status bar span the full width (24 § Fortress screen layout).
 */
export function computeLayout(cols: number, rows: number, sidebarOpen: boolean): Layout {
  const sidebarCols = sidebarOpen ? Math.min(SIDEBAR_COLS, cols) : 0;
  const mapCols = Math.max(0, cols - sidebarCols);
  const mapRows = Math.max(0, rows - STATUS_ROWS - LOG_ROWS);
  return {
    cols,
    rows,
    map: { col: 0, row: 0, cols: mapCols, rows: mapRows },
    sidebar: sidebarOpen ? { col: mapCols, row: 0, cols: sidebarCols, rows: mapRows } : null,
    log: { col: 0, row: mapRows, cols, rows: Math.min(LOG_ROWS, Math.max(0, rows - STATUS_ROWS)) },
    status: { col: 0, row: Math.max(0, rows - STATUS_ROWS), cols, rows: Math.min(STATUS_ROWS, rows) },
  };
}

/** What a canvas of a given pixel size can show at the zoom that fits. */
export interface ViewportFit {
  /** One of `ZOOM_LEVELS`. */
  readonly zoom: number;
  /** `CELL_PX_ZOOM_1 × zoom`. */
  readonly cellPx: number;
  readonly cols: number;
  readonly rows: number;
  /**
   * 1 normally. "Below the smallest zoom the canvas is scaled with CSS (blurry but complete)":
   * the grid stays `MIN_VIEW_COLS × MIN_VIEW_ROWS` and the canvas element is drawn smaller.
   */
  readonly cssScale: number;
}

export function cellPxFor(zoom: number): number {
  return Math.round(CELL_PX_ZOOM_1 * zoom);
}

/**
 * `23` § Canvas and cells: "`cols = floor(canvasWidth / cellPx)`, `rows = floor(canvasHeight /
 * cellPx)`. If `cols < MIN_VIEW_COLS` or `rows < MIN_VIEW_ROWS`, the zoom steps down to the next
 * available level; below the smallest zoom the canvas is scaled with CSS".
 *
 * The test is over the canvas grid, not the map rectangle; see DECISIONS.md D-031.
 */
export function computeViewport(widthPx: number, heightPx: number, requestedZoom: number): ViewportFit {
  const levels = ZOOM_LEVELS;
  let at = levels.indexOf(requestedZoom as (typeof ZOOM_LEVELS)[number]);
  if (at < 0) at = levels.indexOf(1);
  for (;;) {
    const zoom = levels[at] as number;
    const cellPx = cellPxFor(zoom);
    const cols = Math.floor(widthPx / cellPx);
    const rows = Math.floor(heightPx / cellPx);
    if (cols >= MIN_VIEW_COLS && rows >= MIN_VIEW_ROWS) {
      return { zoom, cellPx, cols, rows, cssScale: 1 };
    }
    if (at === 0) {
      const cssScale = Math.min(
        widthPx / (MIN_VIEW_COLS * cellPx),
        heightPx / (MIN_VIEW_ROWS * cellPx),
        1,
      );
      return { zoom, cellPx, cols: MIN_VIEW_COLS, rows: MIN_VIEW_ROWS, cssScale };
    }
    at -= 1;
  }
}
