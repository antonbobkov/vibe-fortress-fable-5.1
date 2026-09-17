import { describe, it, expect } from 'vitest';
import {
  CELL_PX_ZOOM_1,
  MIN_VIEW_COLS,
  MIN_VIEW_ROWS,
  SIDEBAR_COLS,
  STATUS_ROWS,
} from '@core/constants';
import { LOG_ROWS } from '@render/constants';
import {
  CellBuffer,
  cellPxFor,
  computeLayout,
  computeViewport,
  isBlankGlyph,
} from '@render/cellbuffer';

describe('T-M0-12 cell buffer', () => {
  it('stores glyph, fg and bg per cell and refuses coordinates outside it', () => {
    const cells = new CellBuffer(4, 3);
    expect(cells.length).toBe(12);
    cells.set(1, 2, 219, 0x8c8c8c, 0x000000);
    expect(cells.get(1, 2)).toEqual({ glyph: 219, fg: 0x8c8c8c, bg: 0x000000 });
    expect(cells.get(0, 0)).toEqual({ glyph: 0, fg: 0, bg: 0 });
    expect(cells.index(3, 2)).toBe(11);
    expect(() => cells.get(4, 0)).toThrow(RangeError);
    expect(() => cells.get(0, -1)).toThrow(RangeError);
    expect(() => new CellBuffer(-1, 2)).toThrow(RangeError);
  });

  it('fills, copies by value and compares cell for cell', () => {
    const a = new CellBuffer(2, 2);
    const b = new CellBuffer(2, 2);
    a.fill(46, 0x111111, 0x222222);
    b.fill(46, 0x111111, 0x222222);
    expect(a.equals(b)).toBe(true);
    b.setCell(1, 1, { glyph: 47, fg: 0x111111, bg: 0x222222 });
    expect(a.equals(b)).toBe(false);
    expect(a.equals(new CellBuffer(2, 3))).toBe(false);
  });

  it('knows which glyphs draw nothing', () => {
    expect(isBlankGlyph(0)).toBe(true);
    expect(isBlankGlyph(32)).toBe(true);
    expect(isBlankGlyph(46)).toBe(false);
  });
});

describe('T-M0-12 layout: the fortress screen regions', () => {
  it('gives the map what the sidebar, log strip and status bar do not take', () => {
    const layout = computeLayout(120, 50, true);
    expect(layout.map).toEqual({
      col: 0,
      row: 0,
      cols: 120 - SIDEBAR_COLS,
      rows: 50 - STATUS_ROWS - LOG_ROWS,
    });
    expect(layout.sidebar).toEqual({
      col: 120 - SIDEBAR_COLS,
      row: 0,
      cols: SIDEBAR_COLS,
      rows: 50 - STATUS_ROWS - LOG_ROWS,
    });
    expect(layout.log).toEqual({ col: 0, row: 45, cols: 120, rows: LOG_ROWS });
    expect(layout.status).toEqual({ col: 0, row: 48, cols: 120, rows: STATUS_ROWS });
  });

  it('gives the whole width to the map when the sidebar is closed', () => {
    const layout = computeLayout(100, 40, false);
    expect(layout.sidebar).toBeNull();
    expect(layout.map.cols).toBe(100);
    expect(layout.map.rows).toBe(40 - STATUS_ROWS - LOG_ROWS);
  });

  it('never produces a negative region on a tiny grid', () => {
    const layout = computeLayout(10, 3, true);
    expect(layout.map.rows).toBe(0);
    expect(layout.map.cols).toBe(0);
    expect(layout.status.rows).toBe(2);
    expect(layout.log.rows).toBe(1);
  });
});

describe('T-M0-12 layout: the zoom step-down rule', () => {
  it('cell size is CELL_PX_ZOOM_1 x zoom', () => {
    expect(cellPxFor(0.75)).toBe(12);
    expect(cellPxFor(1)).toBe(CELL_PX_ZOOM_1);
    expect(cellPxFor(1.5)).toBe(24);
  });

  it('keeps the requested zoom when the grid is big enough', () => {
    const fit = computeViewport(1920, 1080, 1);
    expect(fit).toEqual({ zoom: 1, cellPx: 16, cols: 120, rows: 67, cssScale: 1 });
    expect(computeViewport(1280, 800, 1).cols).toBe(80);
    expect(computeViewport(1280, 800, 1).rows).toBe(50);
  });

  it('steps down to the next zoom when a dimension falls below the minimum', () => {
    // 1.5 would give 53x33 cells; 1 gives 80x50, which clears both minimums.
    const fit = computeViewport(1280, 800, 1.5);
    expect(fit.zoom).toBe(1);
    expect(fit.cellPx).toBe(16);
    expect(fit.cols).toBe(80);
    expect(fit.rows).toBe(50);
    expect(fit.cssScale).toBe(1);
    // 1 would give 60x37 here; 0.75 gives 80x50.
    expect(computeViewport(960, 600, 1).zoom).toBe(0.75);
    expect(computeViewport(960, 600, 1).cols).toBe(80);
  });

  it('scales with CSS below the smallest zoom, keeping the whole grid', () => {
    const fit = computeViewport(800, 500, 1);
    expect(fit.zoom).toBe(0.75);
    expect(fit.cols).toBe(MIN_VIEW_COLS);
    expect(fit.rows).toBe(MIN_VIEW_ROWS);
    expect(fit.cssScale).toBeLessThan(1);
    expect(fit.cssScale).toBeCloseTo(Math.min(800 / (80 * 12), 500 / (45 * 12)), 10);
  });

  it('falls back to zoom 1 when asked for a zoom that is not a level', () => {
    expect(computeViewport(1920, 1080, 3).zoom).toBe(1);
  });
});
