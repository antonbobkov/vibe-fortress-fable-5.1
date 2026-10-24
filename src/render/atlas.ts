/**
 * The glyph atlas.
 *
 * Implements `02-systems/23-rendering.md` § Atlas and `algorithms/compositor.md`'s
 * `atlas(fg): LRU get or build`. One sheet per foreground color, `glyphCount` sprites wide and
 * one cell tall, cached in an LRU of `ATLAS_COLOR_CACHE` colors.
 *
 * Glyphs are crisp: every pixel of a sheet is either the color, fully opaque, or empty. The font's
 * shapes are read once, as its `ATLAS_FONT_DESIGN_PX`-square design bitmaps, and each sheet is laid
 * out from them pixel by pixel: most glyphs at the largest whole multiple of the design size that
 * fits the cell, centred at whole-pixel offsets; the blocks, shades and box-drawing glyphs across
 * the whole cell, so they join edge to edge. Nothing a slot holds reaches another slot.
 */

import type { CanvasFactory, CanvasLike, Ctx2D } from '@platform/canvas';
import type { Registry } from '@core/registry';
import { CP437, CP437_COUNT } from './cp437';
import { ATLAS_COLOR_CACHE, ATLAS_FONT_DESIGN_PX, ATLAS_FONT_SAMPLE } from './constants';
import { blue, green, red, type Rgb } from './palette';

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
   * The app passes its bundled bitmap font. Standalone canvases may supply another family;
   * their default remains generic monospace (D-032, superseded for the app by D-223).
   */
  readonly fontFamily?: string;
  /** Colors kept; defaults to `ATLAS_COLOR_CACHE`. */
  readonly cacheSize?: number;
}

export const DEFAULT_FONT_FAMILY = 'monospace';

/**
 * Whether a glyph is drawn across its whole cell: the full and half blocks, the shades and the
 * box-drawing lines, which must meet their neighbours edge to edge.
 */
export function fillsCell(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (code >= 0x2500 && code <= 0x259f);
}

/** A glyph's design bitmap: `ATLAS_FONT_DESIGN_PX` rows of as many on/off pixels, row by row. */
export type GlyphMask = Uint8Array;

/**
 * Read the font's design bitmaps. Each glyph is drawn at `ATLAS_FONT_SAMPLE` times its design size
 * (where the full block fills its square exactly), and a design pixel is on when at least half of
 * its sample square is covered: an anti-aliased edge never makes a pixel of its own.
 */
export function readGlyphMasks(createCanvas: CanvasFactory, chars: readonly string[], fontFamily: string): GlyphMask[] {
  const design = ATLAS_FONT_DESIGN_PX;
  const size = design * ATLAS_FONT_SAMPLE;
  const canvas = createCanvas(chars.length * size, size);
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('atlas: no 2D context');
  ctx.font = `${size}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  for (let g = 0; g < chars.length; g += 1) ctx.fillText(chars[g] as string, g * size + size / 2, size / 2);
  const alpha = ctx.getImageData(0, 0, chars.length * size, size).data;
  const rowStride = chars.length * size * 4;
  const half = (ATLAS_FONT_SAMPLE * ATLAS_FONT_SAMPLE * 255) / 2;
  return chars.map((_, g) => {
    const mask = new Uint8Array(design * design);
    for (let y = 0; y < design; y += 1) {
      for (let x = 0; x < design; x += 1) {
        let sum = 0;
        for (let sy = 0; sy < ATLAS_FONT_SAMPLE; sy += 1) {
          for (let sx = 0; sx < ATLAS_FONT_SAMPLE; sx += 1) {
            const px = g * size + x * ATLAS_FONT_SAMPLE + sx;
            const py = y * ATLAS_FONT_SAMPLE + sy;
            sum += alpha[py * rowStride + px * 4 + 3] as number;
          }
        }
        mask[y * design + x] = sum >= half ? 1 : 0;
      }
    }
    return mask;
  });
}

/** How a glyph sits in its cell: its scale (cell pixels per design pixel) and its offset. */
export function glyphPlacement(cellPx: number): { scale: number; offset: number } {
  const scale = Math.max(1, Math.floor(cellPx / ATLAS_FONT_DESIGN_PX));
  return { scale, offset: Math.floor((cellPx - scale * ATLAS_FONT_DESIGN_PX) / 2) };
}

/**
 * Lay out a sheet: RGBA pixels `chars.length × cellPx` wide and `cellPx` tall, every pixel the
 * color at full opacity or empty. A glyph that {@link fillsCell} covers its whole cell, each cell
 * pixel taking the design pixel under it; any other is drawn at {@link glyphPlacement}.
 */
export function layoutSheet(masks: readonly GlyphMask[], chars: readonly string[], cellPx: number, color: Rgb): Uint8ClampedArray {
  const design = ATLAS_FONT_DESIGN_PX;
  const width = chars.length * cellPx;
  const out = new Uint8ClampedArray(width * cellPx * 4);
  const r = red(color);
  const gr = green(color);
  const b = blue(color);
  const { scale, offset } = glyphPlacement(cellPx);
  const on = (x: number, y: number): void => {
    const at = (y * width + x) * 4;
    out[at] = r;
    out[at + 1] = gr;
    out[at + 2] = b;
    out[at + 3] = 255;
  };
  masks.forEach((mask, g) => {
    const left = g * cellPx;
    if (fillsCell(chars[g] ?? ' ')) {
      for (let y = 0; y < cellPx; y += 1) {
        const dy = Math.floor((y * design) / cellPx);
        for (let x = 0; x < cellPx; x += 1) {
          if (mask[dy * design + Math.floor((x * design) / cellPx)] === 1) on(left + x, y);
        }
      }
      return;
    }
    for (let dy = 0; dy < design; dy += 1) {
      for (let dx = 0; dx < design; dx += 1) {
        if (mask[dy * design + dx] !== 1) continue;
        for (let sy = 0; sy < scale; sy += 1) {
          for (let sx = 0; sx < scale; sx += 1) {
            const x = offset + dx * scale + sx;
            const y = offset + dy * scale + sy;
            if (x < cellPx && y < cellPx) on(left + x, y);
          }
        }
      }
    }
  });
  return out;
}

export class GlyphAtlas {
  readonly cellPx: number;
  readonly glyphCount: number;
  readonly fontFamily: string;
  readonly cacheSize: number;
  private readonly chars: readonly string[];
  private readonly createCanvas: CanvasFactory;
  /** Insertion-ordered: the first key is the least recently used. */
  private readonly sheets = new Map<Rgb, CanvasLike>();
  private masks: GlyphMask[] | null = null;
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

  /** The glyph shapes, read from the font once and shared by every color. */
  glyphMasks(): readonly GlyphMask[] {
    this.masks ??= readGlyphMasks(this.createCanvas, this.chars, this.fontFamily);
    return this.masks;
  }

  private build(color: Rgb): CanvasLike {
    const width = this.glyphCount * this.cellPx;
    const canvas = this.createCanvas(width, this.cellPx);
    const ctx: Ctx2D | null = canvas.getContext('2d');
    if (ctx === null) throw new Error('atlas: no 2D context');
    const image = ctx.createImageData(width, this.cellPx);
    image.data.set(layoutSheet(this.glyphMasks(), this.chars, this.cellPx, color));
    ctx.putImageData(image, 0, 0);
    this.builds += 1;
    return canvas;
  }
}
