/**
 * T-758: below the smallest zoom the backing store keeps the whole `MIN_VIEW_COLS × MIN_VIEW_ROWS`
 * grid and the element is shrunk to fit the window (23 § Canvas and cells), so the status bar, the
 * key bar and the hover line are drawn in a small window too.
 */

import { describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import { MIN_VIEW_COLS, MIN_VIEW_ROWS } from '@core/constants';
import { CanvasSurface } from '@platform/canvas';
import { computeViewport } from '@render/cellbuffer';
import { MockCanvas, mockCanvasFactory } from './render/canvas-mock';

const registry = loadContent();

/** What the game does on a resize: fit, then size the surface (the grid only when scaled). */
function fitSurface(cssW: number, cssH: number, dpr: number): { canvas: MockCanvas; cssScale: number } {
  const canvas = new MockCanvas();
  const surface = new CanvasSurface(canvas, { devicePixelRatio: dpr });
  const fit = computeViewport(cssW * dpr, cssH * dpr, 0.75);
  surface.resize(cssW, cssH, dpr, fit.cssScale < 1 ? { widthPx: fit.cols * fit.cellPx, heightPx: fit.rows * fit.cellPx, cssScale: fit.cssScale } : undefined);
  return { canvas, cssScale: fit.cssScale };
}

function px(style: string): number {
  return Number(style.replace('px', ''));
}

describe('T-758 the step-down rule keeps the whole grid in the backing store', () => {
  it.each([
    [960, 480, 1],
    [960, 360, 1],
    [480, 240, 2],
    [480, 180, 2],
  ])('a %i x %i window at dpr %i has a 960 x 540 device-pixel grid and an element that fits', (w, h, dpr) => {
    const { canvas, cssScale } = fitSurface(w, h, dpr);
    expect(cssScale).toBeLessThan(1);
    expect([canvas.width, canvas.height]).toEqual([MIN_VIEW_COLS * 12, MIN_VIEW_ROWS * 12]);
    expect(px(canvas.style.width)).toBeLessThanOrEqual(w);
    expect(px(canvas.style.height)).toBeLessThanOrEqual(h);
    // One side fills the window; the other leaves a strip of the page's background.
    expect(px(canvas.style.width) === Math.floor(w) || px(canvas.style.height) === Math.floor(h)).toBe(true);
  });

  it('leaves a window at or above the smallest zoom as it was: the backing store is the window', () => {
    const { canvas, cssScale } = fitSurface(1280, 800, 1);
    expect(cssScale).toBe(1);
    expect([canvas.width, canvas.height, canvas.style.width, canvas.style.height]).toEqual([1280, 800, '1280px', '800px']);
    const retina = fitSurface(960, 480, 2);
    expect(retina.cssScale).toBe(1);
    expect([retina.canvas.width, retina.canvas.height]).toEqual([1920, 960]);
  });
});

describe('T-758 a game in a 960 x 480 window draws its status rows', () => {
  it('composes and draws status row 1 and the key bar, and a click on row 44 lands on row 44', async () => {
    const canvas = new MockCanvas();
    const game = new Game({
      canvas,
      seed: 't758',
      registry,
      createCanvas: mockCanvasFactory(),
      devicePixelRatio: 1,
      width: 960,
      height: 480,
    });
    await game.start();
    game.render();
    expect([game.viewCols, game.viewRows, game.ui.zoom]).toEqual([MIN_VIEW_COLS, MIN_VIEW_ROWS, 0.75]);
    expect([canvas.width, canvas.height]).toEqual([960, 540]);
    const rows = game.textRows();
    expect(rows).toHaveLength(MIN_VIEW_ROWS);
    expect(rows.join('\n')).toContain('[?] help');
    expect(rows.join('\n')).toContain('[d] dig');

    // The renderer's cells reach the bottom row, inside the backing store.
    const bottom = (MIN_VIEW_ROWS - 1) * 12;
    const fills = canvas.ctx.of('fillRect').map((call) => call.args[1] as number);
    expect(fills).toContain(bottom);
    expect(bottom + 12).toBeLessThanOrEqual(canvas.height);

    const at = game.cellCenter(0, MIN_VIEW_ROWS - 1);
    expect(at.y).toBeLessThan(px(canvas.style.height));
    expect(at.x).toBeLessThan(px(canvas.style.width));
    expect(px(canvas.style.height)).toBeLessThanOrEqual(480);
    expect(game.cellAt(at.x, at.y)).toEqual({ col: 0, row: MIN_VIEW_ROWS - 1 });
    const corner = game.cellCenter(MIN_VIEW_COLS - 1, MIN_VIEW_ROWS - 1);
    expect(game.cellAt(corner.x, corner.y)).toEqual({ col: MIN_VIEW_COLS - 1, row: MIN_VIEW_ROWS - 1 });
  });
});
