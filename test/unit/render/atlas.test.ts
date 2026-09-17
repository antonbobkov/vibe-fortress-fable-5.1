import { describe, it, expect } from 'vitest';
import { loadContent } from '@content/loader';
import { ATLAS_COLOR_CACHE } from '@render/constants';
import { CP437, CP437_COUNT } from '@render/cp437';
import { GlyphAtlas, glyphChars, DEFAULT_FONT_FAMILY } from '@render/atlas';
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
  it('builds glyphCount sprites per color, colorized through source-in', () => {
    const factory = mockCanvasFactory();
    const atlas = new GlyphAtlas({ cellPx: 16, chars, createCanvas: factory });
    expect(atlas.glyphCount).toBe(chars.length);

    const sheet = atlas.sheet(0x8c8c8c) as MockCanvas;
    expect(sheet.width).toBe(chars.length * 16);
    expect(sheet.height).toBe(16);
    const ctx = sheet.ctx;
    expect(ctx.of('fillText')).toHaveLength(chars.length);
    expect(ctx.of('fillText')[0]?.fillStyle).toBe('#ffffff');
    expect(ctx.of('fillText')[0]?.args[1]).toBe(8);
    expect(ctx.of('fillText')[219]?.args[1]).toBe(219 * 16 + 8);
    expect(ctx.font).toContain(DEFAULT_FONT_FAMILY);
    // One colorizing fillRect over the whole sheet, in the requested color.
    const fills = ctx.of('fillRect');
    expect(fills).toHaveLength(1);
    expect(fills[0]?.fillStyle).toBe('#8c8c8c');
    expect(fills[0]?.args).toEqual([0, 0, chars.length * 16, 16]);
    expect(ctx.globalCompositeOperation).toBe('source-over');
  });

  it('fits the font so the widest glyph fills the cell', () => {
    const factory = mockCanvasFactory();
    const atlas = new GlyphAtlas({ cellPx: 16, chars, createCanvas: factory });
    // The mock reports 10 px for a one-character string at any font size, so 16 px of cell needs
    // a font of floor(16 * 16 / 10) = 25 px.
    atlas.sheet(0xffffff);
    expect((factory.made[0] as MockCanvas).ctx.font).toBe(`25px ${DEFAULT_FONT_FAMILY}`);
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
