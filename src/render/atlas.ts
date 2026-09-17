/**
 * The glyph atlas.
 *
 * Implements `02-systems/23-rendering.md` § Atlas and `algorithms/compositor.md`'s
 * `atlas(fg): LRU get or build: offscreen canvas glyphCount × cell; for each glyph: fillText in
 * white centered; then globalCompositeOperation 'source-in' fillRect with fg`.
 *
 * One sheet per foreground color, `glyphCount` sprites wide and one cell tall, cached in an LRU of
 * `ATLAS_COLOR_CACHE` colors. Glyph shapes are identical for every color, so the shapes are drawn
 * white and colorized at build time.
 */

import type { CanvasFactory, CanvasLike, Ctx2D } from '@platform/canvas';
import type { Registry } from '@core/registry';
import { CP437, CP437_COUNT } from './cp437';
import { ATLAS_COLOR_CACHE } from './constants';
import { toHex, type Rgb } from './palette';

/** One row of the `glyphs` list: the extras beyond CP437. */
interface GlyphRow {
  readonly index: number;
  readonly char: string;
  readonly codePoint: number;
}

/**
 * The glyph set of `03-content/glyphs-and-colors.md` § Glyph set: CP437 at 0-255 followed by the
 * content extras at their own indices.
 */
export function glyphChars(registry: Registry): string[] {
  const extras = registry.derived<readonly GlyphRow[]>('glyphs');
  let highest = CP437_COUNT - 1;
  for (const row of extras) highest = Math.max(highest, row.index);
  const chars: string[] = new Array<string>(highest + 1).fill(' ');
  for (let i = 0; i < CP437_COUNT; i += 1) chars[i] = CP437[i] as string;
  for (const row of extras) chars[row.index] = row.char;
  return chars;
}

export interface AtlasOptions {
  readonly cellPx: number;
  readonly chars: readonly string[];
  readonly createCanvas: CanvasFactory;
  /**
   * `tech-stack.md` § Font asks for a bundled bitmap-style monospace font. No font asset exists in
   * the repository yet, so the default is the platform's generic `monospace`; see DECISIONS.md
   * D-032.
   */
  readonly fontFamily?: string;
  /** Colors kept; defaults to `ATLAS_COLOR_CACHE`. */
  readonly cacheSize?: number;
}

export const DEFAULT_FONT_FAMILY = 'monospace';

/** The widest glyph; the font size is chosen so that it fills the cell exactly (23 § Atlas). */
const WIDEST_GLYPH = '█';

export class GlyphAtlas {
  readonly cellPx: number;
  readonly glyphCount: number;
  readonly fontFamily: string;
  readonly cacheSize: number;
  private readonly chars: readonly string[];
  private readonly createCanvas: CanvasFactory;
  /** Insertion-ordered: the first key is the least recently used. */
  private readonly sheets = new Map<Rgb, CanvasLike>();
  private builds = 0;

  constructor(options: AtlasOptions) {
    if (!Number.isInteger(options.cellPx) || options.cellPx <= 0) {
      throw new RangeError(`atlas: bad cell size ${options.cellPx}`);
    }
    this.cellPx = options.cellPx;
    this.chars = options.chars;
    this.glyphCount = options.chars.length;
    this.createCanvas = options.createCanvas;
    this.fontFamily = options.fontFamily ?? DEFAULT_FONT_FAMILY;
    this.cacheSize = options.cacheSize ?? ATLAS_COLOR_CACHE;
  }

  /** Colors currently cached. */
  get size(): number {
    return this.sheets.size;
  }

  /** How many sheets have been rendered; the LRU test reads it. */
  get buildCount(): number {
    return this.builds;
  }

  has(color: Rgb): boolean {
    return this.sheets.has(color);
  }

  /** The sheet for a foreground color, built on demand and moved to the front of the LRU. */
  sheet(color: Rgb): CanvasLike {
    const cached = this.sheets.get(color);
    if (cached !== undefined) {
      this.sheets.delete(color);
      this.sheets.set(color, cached);
      return cached;
    }
    const built = this.build(color);
    this.sheets.set(color, built);
    while (this.sheets.size > this.cacheSize) {
      const oldest = this.sheets.keys().next();
      if (oldest.done === true) break;
      this.sheets.delete(oldest.value);
    }
    return built;
  }

  /** Pixel offset of a glyph in every sheet. */
  sourceX(glyph: number): number {
    if (glyph < 0 || glyph >= this.glyphCount) throw new RangeError(`atlas: no glyph ${glyph}`);
    return glyph * this.cellPx;
  }

  clear(): void {
    this.sheets.clear();
  }

  private build(color: Rgb): CanvasLike {
    const width = this.glyphCount * this.cellPx;
    const canvas = this.createCanvas(width, this.cellPx);
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('atlas: no 2D context');
    const fontPx = this.fitFontPx(ctx);
    ctx.font = `${fontPx}px ${this.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    const half = this.cellPx / 2;
    for (let g = 0; g < this.glyphCount; g += 1) {
      ctx.fillText(this.chars[g] as string, g * this.cellPx + half, half);
    }
    // Colorize: the shapes are the alpha mask, the color is painted through it.
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = toHex(color);
    ctx.fillRect(0, 0, width, this.cellPx);
    ctx.globalCompositeOperation = 'source-over';
    this.builds += 1;
    return canvas;
  }

  /** "the font size is chosen so the widest glyph (`█`) fills the cell exactly". */
  private fitFontPx(ctx: Ctx2D): number {
    const probe = this.cellPx;
    ctx.font = `${probe}px ${this.fontFamily}`;
    const measured = ctx.measureText(WIDEST_GLYPH).width;
    if (!Number.isFinite(measured) || measured <= 0) return probe;
    return Math.max(1, Math.floor((probe * this.cellPx) / measured));
  }
}
