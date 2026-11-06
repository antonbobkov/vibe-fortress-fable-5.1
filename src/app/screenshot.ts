/**
 * Pictures of a game without a browser (`tooling.md` § Screenshots).
 *
 * The compositor fills a cell buffer (glyph, foreground, background per cell) whatever draws it,
 * and the atlas draws a glyph as its 8 × 8 design mask in the foreground colour over the cell's
 * background. A picture does the same on a pixel buffer: each cell's mask, read from the bundled
 * font by `fontGlyphMasks`, stamped at a whole scale, then written as a PNG. Two sources:
 *
 * - {@link mapPicture}: the map of a running headless game, as the fortress screen draws it with
 *   the sidebar shut (what a test's `snapshot` and the script's default mode write);
 * - {@link screenOfSave}: a save loaded into a whole {@link Game} on a canvas that draws nothing,
 *   so the log, the status bar and a panel opened by keys and clicks are there too.
 *
 * Nothing here touches the file system: the callers pass the font's bytes and Node's deflate.
 */

import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { CanvasFactory, CanvasLike, Ctx2D, ImageDataLike } from '@platform/canvas';
import { glyphChars, type GlyphMask } from '@render/atlas';
import { CellBuffer, isBlankGlyph, type Rect } from '@render/cellbuffer';
import { Compositor } from '@render/compositor';
import { ATLAS_FONT_DESIGN_PX, LOG_ROWS } from '@render/constants';
import { blue, green, Palette, red } from '@render/palette';
import { fontGlyphMasks } from '@render/font-masks';
import { STATUS_ROWS } from '@core/constants';
import { Game } from './game';

/** A rectangle of the map: its top-left tile, its level and its size in tiles. */
export interface PictureView {
  readonly camX: number;
  readonly camY: number;
  readonly z: number;
  readonly cols: number;
  readonly rows: number;
}

/** The view of `cols × rows` tiles centred on (x, y), kept on the map where it fits. */
export function viewAround(readers: ReaderSet, x: number, y: number, z: number, cols: number, rows: number): PictureView {
  const map = readers.map;
  const w = Math.min(cols, map.w);
  const h = Math.min(rows, map.h);
  return {
    camX: Math.max(0, Math.min(map.w - w, x - Math.floor(w / 2))),
    camY: Math.max(0, Math.min(map.h - h, y - Math.floor(h / 2))),
    z,
    cols: w,
    rows: h,
  };
}

/** The cells of a rectangle of a buffer. */
export function cropCells(cells: CellBuffer, rect: Rect): CellBuffer {
  const out = new CellBuffer(rect.cols, rect.rows);
  for (let row = 0; row < rect.rows; row += 1) {
    for (let col = 0; col < rect.cols; col += 1) out.setCell(col, row, cells.get(rect.col + col, rect.row + row));
  }
  return out;
}

/** Buffers stacked top to bottom, each at the left; what a narrower one leaves is black. */
export function stackCells(parts: readonly CellBuffer[]): CellBuffer {
  const out = new CellBuffer(Math.max(0, ...parts.map((p) => p.cols)), parts.reduce((n, p) => n + p.rows, 0));
  let top = 0;
  for (const part of parts) {
    for (let row = 0; row < part.rows; row += 1) {
      for (let col = 0; col < part.cols; col += 1) out.setCell(col, top + row, part.get(col, row));
    }
    top += part.rows;
  }
  return out;
}

/**
 * The map of a view as the fortress screen composes it with the sidebar shut, the default
 * overlays and reduced motion (as every test build draws): the same compositor, cell for cell.
 */
export function mapCells(readers: ReaderSet, registry: Registry, view: PictureView, compositor?: Compositor): CellBuffer {
  const c = compositor ?? new Compositor({ registry, palette: new Palette(registry) });
  const full = c.compose(readers, { camX: view.camX, camY: view.camY, z: view.z, sidebarOpen: false, cursor: null, reducedMotion: true }, view.cols, view.rows + LOG_ROWS + STATUS_ROWS);
  return cropCells(full, c.layout.map);
}

/** An RGB picture: three bytes a pixel, row by row. */
export interface Picture {
  readonly width: number;
  readonly height: number;
  readonly rgb: Uint8Array;
}

/**
 * Stamp each cell's glyph mask in its foreground over its background, `scale` pixels a design
 * pixel (a cell is `8 × scale` pixels square), as the atlas lays out a sheet at that cell size.
 */
export function rasterize(cells: CellBuffer, masks: readonly GlyphMask[], scale = 2): Picture {
  if (!Number.isInteger(scale) || scale < 1) throw new RangeError(`screenshot: bad scale ${scale}`);
  const design = ATLAS_FONT_DESIGN_PX;
  const cellPx = design * scale;
  const width = cells.cols * cellPx;
  const height = cells.rows * cellPx;
  const rgb = new Uint8Array(width * height * 3);
  for (let row = 0; row < cells.rows; row += 1) {
    for (let col = 0; col < cells.cols; col += 1) {
      const i = row * cells.cols + col;
      const glyph = cells.glyph[i] as number;
      const fg = cells.fg[i] as number;
      const bg = cells.bg[i] as number;
      const mask = isBlankGlyph(glyph) ? undefined : masks[glyph];
      for (let py = 0; py < cellPx; py += 1) {
        const dy = Math.floor(py / scale);
        let at = ((row * cellPx + py) * width + col * cellPx) * 3;
        for (let px = 0; px < cellPx; px += 1) {
          const color = mask !== undefined && mask[dy * design + Math.floor(px / scale)] === 1 ? fg : bg;
          rgb[at] = red(color);
          rgb[at + 1] = green(color);
          rgb[at + 2] = blue(color);
          at += 3;
        }
      }
    }
  }
  return { width, height, rgb };
}

/** Raw deflate as zlib wraps it (Node's `zlib.deflateSync`). */
export type Deflate = (data: Uint8Array) => Uint8Array;

const CRC_TABLE = ((): Uint32Array => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = (CRC_TABLE[(c ^ (bytes[i] as number)) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let k = 0; k < 4; k += 1) out[4 + k] = type.charCodeAt(k);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/**
 * A PNG of a picture: indexed colour when it has at most 256 colours (a cell picture nearly always
 * does, and it compresses best), else 8-bit RGB. No filtering: runs of one index deflate well.
 */
export function encodePng(picture: Picture, deflate: Deflate): Uint8Array {
  const { width, height, rgb } = picture;
  const colors = new Map<number, number>();
  for (let i = 0; i < rgb.length && colors.size <= 256; i += 3) {
    const c = ((rgb[i] as number) << 16) | ((rgb[i + 1] as number) << 8) | (rgb[i + 2] as number);
    if (!colors.has(c)) colors.set(c, colors.size);
  }
  const indexed = colors.size <= 256;
  const stride = indexed ? width : width * 3;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    const line = y * (stride + 1);
    if (indexed) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 3;
        raw[line + 1 + x] = colors.get(((rgb[i] as number) << 16) | ((rgb[i + 1] as number) << 8) | (rgb[i + 2] as number)) as number;
      }
    } else raw.set(rgb.subarray(y * stride, (y + 1) * stride), line + 1);
  }
  const ihdr = new Uint8Array(13);
  const header = new DataView(ihdr.buffer);
  header.setUint32(0, width);
  header.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = indexed ? 3 : 2;
  const parts: Uint8Array[] = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr)];
  if (indexed) {
    const plte = new Uint8Array(colors.size * 3);
    for (const [c, k] of [...colors.entries()]) {
      plte[k * 3] = (c >> 16) & 0xff;
      plte[k * 3 + 1] = (c >> 8) & 0xff;
      plte[k * 3 + 2] = c & 0xff;
    }
    parts.push(chunk('PLTE', plte));
  }
  parts.push(chunk('IDAT', deflate(raw)), chunk('IEND', new Uint8Array(0)));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** The glyph masks of the game's glyph set from the bundled font's bytes. */
export function gameGlyphMasks(font: Uint8Array, registry: Registry): GlyphMask[] {
  return fontGlyphMasks(font, glyphChars(registry));
}

/** A PNG of the map of a view (see {@link mapCells}). */
export function mapPicture(readers: ReaderSet, registry: Registry, view: PictureView, masks: readonly GlyphMask[], deflate: Deflate, scale = 2): Uint8Array {
  return encodePng(rasterize(mapCells(readers, registry, view), masks, scale), deflate);
}

// ---------- a whole screen, from a save ----------

/** A 2D context that draws nothing: the {@link Game}'s own renderer is not what a picture reads. */
class NullCtx implements Ctx2D {
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  globalCompositeOperation = 'source-over';
  font = '';
  textAlign = 'start';
  textBaseline = 'alphabetic';
  imageSmoothingEnabled = false;
  clearRect(): void {}
  fillRect(): void {}
  fillText(): void {}
  measureText(text: string): { width: number } {
    return { width: text.length * ATLAS_FONT_DESIGN_PX };
  }
  getImageData(_sx: number, _sy: number, sw: number, sh: number): ImageDataLike {
    return { width: sw, height: sh, data: new Uint8ClampedArray(sw * sh * 4) };
  }
  createImageData(sw: number, sh: number): ImageDataLike {
    return { width: sw, height: sh, data: new Uint8ClampedArray(sw * sh * 4) };
  }
  putImageData(): void {}
  drawImage(): void {}
}

class NullCanvas implements CanvasLike {
  width: number;
  height: number;
  readonly style = { width: '', height: '' };
  private readonly ctx = new NullCtx();
  constructor(width = 0, height = 0) {
    this.width = width;
    this.height = height;
  }
  getContext(): Ctx2D {
    return this.ctx;
  }
}

const nullCanvasFactory: CanvasFactory = (width, height) => new NullCanvas(width, height);

export interface ScreenOptions {
  readonly registry?: Registry;
  /** The window in CSS pixels; 1280 × 800 (80 × 50 cells) by default, as the e2e tests use. */
  readonly width?: number;
  readonly height?: number;
  /** Ticks played after the load, so the log fills with what happens. */
  readonly steps?: number;
  /** Where the camera is centred (a tile and its level) before the keys and clicks. */
  readonly centre?: { readonly x: number; readonly y: number; readonly z: number };
  /** Keys pressed in order, in the keymap's spelling (`z`, `Esc`, `S-a` as `{ key: 'a', shift: true }`). */
  readonly keys?: readonly (string | { readonly key: string; readonly shift?: boolean })[];
  /** Map tiles left-clicked after the keys, on the level in view. */
  readonly clicks?: readonly { readonly x: number; readonly y: number }[];
}

/** The screen a save shows: loaded paused into a whole game, played, centred, keys and clicks. */
export async function screenOfSave(blob: Uint8Array, options: ScreenOptions = {}): Promise<{ cells: CellBuffer; map: Rect; game: Game }> {
  const game = new Game({
    canvas: new NullCanvas(),
    seed: 'screenshot',
    ...(options.registry === undefined ? {} : { registry: options.registry }),
    createCanvas: nullCanvasFactory,
    devicePixelRatio: 1,
    width: options.width ?? 1280,
    height: options.height ?? 800,
    reducedMotion: true,
  });
  game.enterLoaded(await game.host.load(blob));
  if ((options.steps ?? 0) > 0) game.host.step(options.steps as number);
  if (options.centre !== undefined) game.centerOn(options.centre.x, options.centre.y, options.centre.z);
  game.render();
  for (const k of options.keys ?? []) {
    const press = typeof k === 'string' ? { key: k, shift: false } : { key: k.key, shift: k.shift === true };
    game.handleKey({ key: press.key, repeat: false, shift: press.shift, ctrl: false, alt: false, meta: false });
  }
  for (const tile of options.clicks ?? []) {
    const at = game.cellCenter(tile.x - game.ui.camX, tile.y - game.ui.camY);
    const action = { x: at.x, y: at.y, button: 0, shift: false, ctrl: false, alt: false, meta: false };
    game.pointerDown(action);
    game.pointerUp(action);
  }
  game.render();
  const cells = game.cellBuffer();
  if (cells === null) throw new Error('screenshot: the game drew no screen');
  return { cells, map: game.compositor.layout.map, game };
}
