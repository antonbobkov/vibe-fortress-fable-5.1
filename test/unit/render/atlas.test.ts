import { describe, it, expect } from 'vitest';
import { loadContent } from '@content/loader';
import { ATLAS_COLOR_CACHE, ATLAS_FONT_DESIGN_PX, ATLAS_FONT_SAMPLE } from '@render/constants';
import { CP437, CP437_COUNT } from '@render/cp437';
import { GlyphAtlas, glyphChars, DEFAULT_FONT_FAMILY, fillsCell, glyphPlacement, layoutSheet } from '@render/atlas';
import { mockCanvasFactory, type MockCanvas } from './canvas-mock';

const registry = loadContent();
const chars = glyphChars(registry);

describe('T-M0-12 atlas: the glyph set', () => {
  it('is CP437 at 0-255 followed by the content extras', () => {
    expect(CP437).toHaveLength(CP437_COUNT);
    expect(CP437[1]).toBe('☺');
    expect(CP437[15]).toBe('☼');
    expect(CP437[19]).toBe('‼');
    expect(CP437[65]).toBe('A');
    expect(CP437[176]).toBe('░');
    expect(CP437[219]).toBe('█');
    expect(CP437[247]).toBe('≈');
    expect(CP437[254]).toBe('■');

    // The extras of `glyphs-and-colors.md` § Glyph set sit at their own indices.
    expect(chars).toHaveLength(280);
    expect(chars[256]).toBe('♥');
    expect(chars[262]).toBe('Ξ');
    expect(chars[274]).toBe('τ');
    expect(chars[279]).toBe('▓');
    for (let i = 0; i < CP437_COUNT; i += 1) expect(chars[i]).toBe(CP437[i]);
  });
});

describe('T-M0-12 atlas: sheets and the LRU', () => {
  it('builds glyphCount sprites per color, written pixel by pixel in that color', () => {
    const factory = mockCanvasFactory();
    const atlas = new GlyphAtlas({ cellPx: 16, chars, createCanvas: factory });
    expect(atlas.glyphCount).toBe(chars.length);

    const sheet = atlas.sheet(0x8c8c8c) as MockCanvas;
    expect(sheet.width).toBe(chars.length * 16);
    expect(sheet.height).toBe(16);
    // One image over the whole sheet; every lit pixel is the color, fully opaque.
    expect(sheet.ctx.of('putImageData').map((c) => c.args)).toEqual([[0, 0, chars.length * 16, 16]]);
    const data = sheet.ctx.image?.data as Uint8ClampedArray;
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      lit += 1;
      expect([data[i], data[i + 1], data[i + 2], data[i + 3]]).toEqual([0x8c, 0x8c, 0x8c, 255]);
    }
    expect(lit).toBeGreaterThan(0);
  });

  it('reads the font once, at four times its eight-pixel design size, and shares the shapes between colors', () => {
    const factory = mockCanvasFactory();
    const atlas = new GlyphAtlas({ cellPx: 16, chars, createCanvas: factory });
    atlas.sheet(0xffffff);
    atlas.sheet(0x123456);
    const reads = factory.made.filter((c) => c.ctx.of('fillText').length > 0);
    expect(reads).toHaveLength(1);
    const read = reads[0] as MockCanvas;
    expect(read.width).toBe(chars.length * ATLAS_FONT_DESIGN_PX * ATLAS_FONT_SAMPLE);
    expect(read.ctx.font).toBe(`${ATLAS_FONT_DESIGN_PX * ATLAS_FONT_SAMPLE}px ${DEFAULT_FONT_FAMILY}`);
    expect(read.ctx.of('fillText')).toHaveLength(chars.length);
    expect(read.ctx.of('fillText')[219]?.args).toEqual(['█', 219 * 32 + 16, 16]);
  });

  it('caches per color and rebuilds nothing on a hit', () => {
    const factory = mockCanvasFactory();
    const atlas = new GlyphAtlas({ cellPx: 12, chars, createCanvas: factory });
    const first = atlas.sheet(0x112233);
    expect(atlas.sheet(0x112233)).toBe(first);
    expect(atlas.buildCount).toBe(1);
    expect(atlas.size).toBe(1);
    atlas.sheet(0x445566);
    expect(atlas.buildCount).toBe(2);
    atlas.clear();
    expect(atlas.size).toBe(0);
  });

  it('evicts the least recently used color at ATLAS_COLOR_CACHE', () => {
    const factory = mockCanvasFactory();
    const atlas = new GlyphAtlas({ cellPx: 8, chars, createCanvas: factory, cacheSize: 4 });
    expect(new GlyphAtlas({ cellPx: 8, chars, createCanvas: factory }).cacheSize).toBe(
      ATLAS_COLOR_CACHE,
    );
    for (const color of [1, 2, 3, 4]) atlas.sheet(color);
    expect(atlas.size).toBe(4);
    // Touch 1 so that 2 is the oldest, then overflow.
    atlas.sheet(1);
    atlas.sheet(5);
    expect(atlas.size).toBe(4);
    expect(atlas.has(2)).toBe(false);
    expect(atlas.has(1)).toBe(true);
    expect(atlas.has(5)).toBe(true);
  });

  it('maps a glyph to its x offset and refuses one outside the set', () => {
    const atlas = new GlyphAtlas({ cellPx: 16, chars, createCanvas: mockCanvasFactory() });
    expect(atlas.sourceX(0)).toBe(0);
    expect(atlas.sourceX(279)).toBe(279 * 16);
    expect(() => atlas.sourceX(chars.length)).toThrow(RangeError);
    expect(() => new GlyphAtlas({ cellPx: 0, chars, createCanvas: mockCanvasFactory() })).toThrow(
      RangeError,
    );
  });
});

describe('T-435 atlas: crisp glyphs', () => {
  const SIZES = [16, 18, 20, 24, 30];
  const BLOCK = 219;

  /** The alpha of a sheet pixel. */
  const alphaAt = (data: Uint8ClampedArray, cellPx: number, x: number, y: number): number => data[(y * chars.length * cellPx + x) * 4 + 3] as number;

  it('keeps every atlas pixel fully on or fully off at cell sizes 16, 18, 20, 24 and 30, and fills the full block\'s cell', () => {
    for (const cellPx of SIZES) {
      const atlas = new GlyphAtlas({ cellPx, chars, createCanvas: mockCanvasFactory() });
      const data = (atlas.sheet(0xffffff) as MockCanvas).ctx.image?.data as Uint8ClampedArray;
      expect(data.length, `${cellPx}`).toBe(chars.length * cellPx * cellPx * 4);
      const alphas = new Set<number>();
      for (let i = 3; i < data.length; i += 4) alphas.add(data[i] as number);
      expect([...alphas].sort((a, b) => a - b), `${cellPx}`).toEqual([0, 255]);
      for (let y = 0; y < cellPx; y += 1) {
        for (let x = 0; x < cellPx; x += 1) expect(alphaAt(data, cellPx, BLOCK * cellPx + x, y), `${cellPx}: ${x},${y}`).toBe(255);
      }
    }
  });

  it('reads design pixels on at half coverage or more, so no anti-aliased fringe survives', () => {
    const masks = new GlyphAtlas({ cellPx: 16, chars, createCanvas: mockCanvasFactory() }).glyphMasks();
    expect(masks).toHaveLength(chars.length);
    for (const mask of masks) {
      expect(mask).toHaveLength(ATLAS_FONT_DESIGN_PX * ATLAS_FONT_DESIGN_PX);
      for (const bit of mask) expect([0, 1]).toContain(bit);
    }
    expect([...(masks[BLOCK] as Uint8Array)].every((bit) => bit === 1)).toBe(true);
    expect([...(masks[32] as Uint8Array)].every((bit) => bit === 0)).toBe(true);
  });

  it('draws a glyph at the largest whole multiple of eight that fits, centred at whole pixels', () => {
    expect(SIZES.map((cellPx) => glyphPlacement(cellPx))).toEqual([
      { scale: 2, offset: 0 }, { scale: 2, offset: 1 }, { scale: 2, offset: 2 }, { scale: 3, offset: 0 }, { scale: 3, offset: 3 },
    ]);
    // A letter-like glyph whose design is all on, at 18: a 16-pixel square with a one-pixel margin.
    const full = new Uint8Array(ATLAS_FONT_DESIGN_PX * ATLAS_FONT_DESIGN_PX).fill(1);
    const two = ['A', '▒'];
    const data = layoutSheet([full, full], two, 18, 0xffffff);
    const at = (x: number, y: number): number => data[(y * 36 + x) * 4 + 3] as number;
    expect(at(0, 0)).toBe(0);
    expect(at(1, 1)).toBe(255);
    expect(at(16, 16)).toBe(255);
    expect(at(17, 17)).toBe(0);
    // A shade glyph covers its whole cell, edge to edge.
    expect(at(18, 0)).toBe(255);
    expect(at(35, 17)).toBe(255);
    expect(fillsCell('█')).toBe(true);
    expect(fillsCell('░')).toBe(true);
    expect(fillsCell('─')).toBe(true);
    expect(fillsCell('╬')).toBe(true);
    expect(fillsCell('A')).toBe(false);
    expect(fillsCell('☺')).toBe(false);

  });

  it('keeps each slot\'s pixels inside its slot', () => {
    const full = new Uint8Array(ATLAS_FONT_DESIGN_PX * ATLAS_FONT_DESIGN_PX).fill(1);
    const empty = new Uint8Array(ATLAS_FONT_DESIGN_PX * ATLAS_FONT_DESIGN_PX);
    for (const cellPx of SIZES) {
      for (const g of [65, BLOCK, 196, 257]) {
        const masks = chars.map((_, k) => (k === g ? full : empty));
        const data = layoutSheet(masks, chars, cellPx, 0xffffff);
        for (let y = 0; y < cellPx; y += 1) {
          for (const x of [(g - 1) * cellPx + cellPx - 1, (g + 1) * cellPx]) {
            if (x >= 0 && x < chars.length * cellPx) expect(alphaAt(data, cellPx, x, y), `${cellPx} glyph ${g}`).toBe(0);
          }
        }
        let lit = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] === 255) lit += 1;
        const inSlot = (() => {
          let n = 0;
          for (let y = 0; y < cellPx; y += 1) for (let x = 0; x < cellPx; x += 1) if (alphaAt(data, cellPx, g * cellPx + x, y) === 255) n += 1;
          return n;
        })();
        expect(inSlot, `${cellPx} glyph ${g}`).toBe(lit);
      }
    }
  });
});
