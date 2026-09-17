import { describe, it, expect } from 'vitest';
import { loadContent } from '@content/loader';
import { CanvasSurface } from '@platform/canvas';
import { GlyphAtlas, glyphChars } from '@render/atlas';
import { CellBuffer } from '@render/cellbuffer';
import { Palette } from '@render/palette';
import { Renderer } from '@render/renderer';
import { MockCanvas, mockCanvasFactory } from './canvas-mock';

const registry = loadContent();
const chars = glyphChars(registry);

function setup(cols: number, rows: number): {
  renderer: Renderer;
  cells: CellBuffer;
  canvas: MockCanvas;
} {
  const canvas = new MockCanvas();
  const surface = new CanvasSurface(canvas);
  surface.resize(cols * 16, rows * 16, 1);
  const atlas = new GlyphAtlas({ cellPx: 16, chars, createCanvas: mockCanvasFactory() });
  const renderer = new Renderer({ surface, atlas, palette: new Palette(registry) });
  return { renderer, cells: new CellBuffer(cols, rows), canvas };
}

describe('T-M0-12 renderer: one fillRect per background run', () => {
  it('fills a whole row of one background as a single rect', () => {
    const { renderer, cells, canvas } = setup(8, 1);
    cells.fill(0, 0xffffff, 0x000000);
    renderer.draw(cells);
    const fills = canvas.ctx.of('fillRect');
    expect(fills).toHaveLength(1);
    expect(fills[0]?.args).toEqual([0, 0, 8 * 16, 16]);
    expect(fills[0]?.fillStyle).toBe('#000000');
    expect(canvas.ctx.of('clearRect')[0]?.args).toEqual([0, 0, 8 * 16, 16]);
  });

  it('breaks the run where the background changes, and starts fresh on each row', () => {
    const { renderer, cells, canvas } = setup(4, 2);
    cells.fill(0, 0xffffff, 0x000000);
    cells.set(1, 0, 0, 0xffffff, 0x1e3a8a);
    cells.set(2, 0, 0, 0xffffff, 0x1e3a8a);
    renderer.draw(cells);
    const fills = canvas.ctx.of('fillRect');
    // Row 0: [0], [1..2], [3]; row 1: one run.
    expect(fills.map((f) => f.args)).toEqual([
      [0, 0, 16, 16],
      [16, 0, 32, 16],
      [48, 0, 16, 16],
      [0, 16, 64, 16],
    ]);
    expect(fills[1]?.fillStyle).toBe('#1e3a8a');
  });
});

describe('T-M0-12 renderer: glyphs from the atlas', () => {
  it('blits one sprite per non-blank cell, from the sheet of its foreground', () => {
    const { renderer, cells, canvas } = setup(3, 1);
    cells.fill(32, 0xffffff, 0x000000);
    cells.set(0, 0, 219, 0x8c8c8c, 0x000000);
    cells.set(2, 0, 46, 0x6b4e2e, 0x000000);
    renderer.draw(cells);
    const blits = canvas.ctx.of('drawImage');
    expect(blits).toHaveLength(2);
    expect(blits[0]?.args.slice(1)).toEqual([219 * 16, 0, 16, 16, 0, 0, 16, 16]);
    expect(blits[1]?.args.slice(1)).toEqual([46 * 16, 0, 16, 16, 2 * 16, 0, 16, 16]);
    expect(renderer.atlas.size).toBe(2);
    expect(renderer.frameCount).toBe(1);
  });

  it('draws nothing for blank glyphs and reuses one sheet for one color', () => {
    const { renderer, cells, canvas } = setup(4, 1);
    cells.fill(0, 0xffffff, 0x000000);
    renderer.draw(cells);
    expect(canvas.ctx.of('drawImage')).toHaveLength(0);
    cells.fill(46, 0x8c8c8c, 0x000000);
    renderer.draw(cells);
    expect(canvas.ctx.of('drawImage')).toHaveLength(4);
    expect(renderer.atlas.buildCount).toBe(1);
    expect(renderer.frameCount).toBe(2);
  });
});
