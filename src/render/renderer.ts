/**
 * The renderer: a cell buffer onto a canvas.
 *
 * Implements `02-systems/23-rendering.md` § Canvas and cells ("The frame draws every cell from the
 * cell buffer: fill `bg` rect, then draw the glyph from the atlas for `fg`. Cells with the same
 * `bg` in a run are filled as one rect") and `algorithms/compositor.md`'s
 * `draw(cells): ctx.clearRect; for each run of equal bg in a row: fillRect; for each cell with
 * glyph != ' ': ctx.drawImage(atlas(fg).canvas, sx, sy, cell, cell, dx, dy, cell, cell)`.
 *
 * It knows nothing about the world; `render.draw(cellBuffer)` is its whole interface (23 §
 * Interfaces).
 */

import type { CanvasSurface } from '@platform/canvas';
import { isBlankGlyph, type CellBuffer } from './cellbuffer';
import type { GlyphAtlas } from './atlas';
import type { Palette, Rgb } from './palette';

export interface RendererOptions {
  readonly surface: CanvasSurface;
  readonly atlas: GlyphAtlas;
  readonly palette: Palette;
}

export class Renderer {
  readonly surface: CanvasSurface;
  readonly atlas: GlyphAtlas;
  readonly palette: Palette;
  private frames = 0;

  constructor(options: RendererOptions) {
    this.surface = options.surface;
    this.atlas = options.atlas;
    this.palette = options.palette;
  }

  /** Frames drawn since construction; the status bar and the tests read it. */
  get frameCount(): number {
    return this.frames;
  }

  /** `render.draw(cellBuffer)`. */
  draw(cells: CellBuffer): void {
    const ctx = this.surface.ctx;
    const cell = this.atlas.cellPx;
    ctx.clearRect(0, 0, this.surface.widthPx, this.surface.heightPx);

    for (let row = 0; row < cells.rows; row += 1) {
      const base = row * cells.cols;
      const y = row * cell;

      // One fillRect per run of equal backgrounds.
      let runStart = 0;
      let runColor = cells.bg[base] as Rgb;
      for (let col = 1; col <= cells.cols; col += 1) {
        const color = col < cells.cols ? (cells.bg[base + col] as Rgb) : null;
        if (color === runColor && col < cells.cols) continue;
        ctx.fillStyle = this.palette.hex(runColor);
        ctx.fillRect(runStart * cell, y, (col - runStart) * cell, cell);
        runStart = col;
        if (color !== null) runColor = color;
      }

      // Then the glyphs, one atlas blit each.
      for (let col = 0; col < cells.cols; col += 1) {
        const glyph = cells.glyph[base + col] as number;
        if (isBlankGlyph(glyph)) continue;
        const sheet = this.atlas.sheet(cells.fg[base + col] as Rgb);
        ctx.drawImage(sheet, this.atlas.sourceX(glyph), 0, cell, cell, col * cell, y, cell, cell);
      }
    }
    this.frames += 1;
  }
}
