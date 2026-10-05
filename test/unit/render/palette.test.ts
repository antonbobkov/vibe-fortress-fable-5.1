import { describe, it, expect } from 'vitest';
import { loadContent } from '@content/loader';
import { DIM_FACTOR } from '@render/constants';
import { Palette, blend, blue, green, parseHex, red, rgb, toHex, ciede2000, rgbToLab } from '@render/palette';

const registry = loadContent();

describe('T-M0-12 palette: the named colors of glyphs-and-colors.md', () => {
  it('carries the base 16, the state colors, the ramps and the material colors', () => {
    const palette = new Palette(registry);
    // Base 16.
    expect(toHex(palette.color('black'))).toBe('#000000');
    expect(toHex(palette.color('white'))).toBe('#ffffff');
    expect(toHex(palette.color('brown'))).toBe('#aa5500');
    // State and UI.
    expect(toHex(palette.color('dwarf_normal'))).toBe('#ffffff');
    expect(toHex(palette.color('undiscovered'))).toBe('#0a0a0a');
    expect(toHex(palette.color('sky_day'))).toBe('#1e2e4a');
    expect(toHex(palette.color('abyss'))).toBe('#000000');
    // Fluid ramps, designation tints, material colors.
    expect(toHex(palette.color('water_7'))).toBe('#0c1c60');
    expect(toHex(palette.color('magma_bg'))).toBe('#3a0800');
    expect(toHex(palette.color('des_dig'))).toBe('#1e3a8a');
    expect(toHex(palette.color('granite_gray'))).toBe('#8c8c8c');
    expect(toHex(palette.color('loam_brown'))).toBe('#6b4e2e');
  });

  it('every material row names a color the palette carries', () => {
    const palette = new Palette(registry);
    const materials = registry.table<{ id: string; color: string }>('materials');
    for (const id of materials.ids()) {
      const row = materials.byId(id) as { id: string; color: string };
      expect(palette.has(row.color), `${row.id} -> ${row.color}`).toBe(true);
    }
  });

  it('refuses an id the table does not carry, and skips the non-color rows', () => {
    const palette = new Palette(registry);
    expect(() => palette.color('no_such_color')).toThrow(RangeError);
    // `cursor` is documented as "inverted": a rule, not a color.
    expect(palette.has('cursor')).toBe(false);
    expect(palette.ids().length).toBeGreaterThan(200);
  });

  it('the colorblind palette takes the alternate where the table gives one', () => {
    const plain = new Palette(registry);
    const alt = new Palette(registry, { colorblind: true });
    expect(toHex(alt.color('dwarf_need'))).toBe('#ffb000');
    expect(toHex(alt.color('hostile'))).toBe('#e65100');
    expect(toHex(alt.color('water_1'))).toBe('#68d0ff');
    expect(toHex(plain.color('dwarf_need'))).toBe('#ffd34d');
    // Rows without an alternate are the same in both.
    expect(alt.color('granite_gray')).toBe(plain.color('granite_gray'));
    expect(alt.colorblind).toBe(true);
  });
});

describe('T-M0-12 palette: dim() and its cache', () => {
  it('multiplies every channel by DIM_FACTOR^level', () => {
    const palette = new Palette(registry);
    const color = rgb(200, 100, 50);
    const once = palette.dim(color, 1);
    expect(red(once)).toBe(Math.floor(200 * DIM_FACTOR));
    expect(green(once)).toBe(Math.floor(100 * DIM_FACTOR));
    expect(blue(once)).toBe(Math.floor(50 * DIM_FACTOR));
    const twice = palette.dim(color, 2);
    expect(red(twice)).toBe(Math.floor(200 * DIM_FACTOR ** 2));
    expect(twice).not.toBe(once);
    expect(palette.dim(color, 0)).toBe(color);
  });

  it('is computed once per color and level', () => {
    const palette = new Palette(registry);
    expect(palette.dimCacheSize).toBe(0);
    const color = palette.color('granite_gray');
    const first = palette.dim(color, 1);
    expect(palette.dimCacheSize).toBe(1);
    expect(palette.dim(color, 1)).toBe(first);
    expect(palette.dimCacheSize).toBe(1);
    palette.dim(color, 2);
    expect(palette.dimCacheSize).toBe(2);
    // Level 0 is the identity and is not cached.
    palette.dim(color, 0);
    expect(palette.dimCacheSize).toBe(2);
  });

  it('hex() is cached and round-trips', () => {
    const palette = new Palette(registry);
    const color = palette.color('hearth_orange');
    expect(palette.hex(color)).toBe('#ff9a2e');
    expect(palette.hex(color)).toBe(palette.hex(color));
    expect(parseHex(palette.hex(color))).toBe(color);
  });
});

describe('T-M0-12 palette: color arithmetic', () => {
  it('parses, packs and unpacks', () => {
    expect(parseHex('#0A1840')).toBe(0x0a1840);
    expect(parseHex('0A1840')).toBe(0x0a1840);
    expect(() => parseHex('#xyz')).toThrow(RangeError);
    expect(rgb(0x0a, 0x18, 0x40)).toBe(0x0a1840);
    expect(red(0x0a1840)).toBe(0x0a);
    expect(green(0x0a1840)).toBe(0x18);
    expect(blue(0x0a1840)).toBe(0x40);
  });

  it('blends a tint over a background at an alpha', () => {
    expect(blend(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(blend(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(blend(0x000000, 0x646464, 0.25)).toBe(rgb(25, 25, 25));
  });
});

describe('U-08: perceptual color distance (CIEDE2000) (D-U10, M12)', () => {
  it('ciede2000 returns 0 for identical colors', () => {
    expect(ciede2000(0xff0000, 0xff0000)).toBe(0);
    expect(ciede2000(0x123456, 0x123456)).toBe(0);
  });

  it('rgbToLab transforms black and white to expected Lab coordinates', () => {
    const black = rgbToLab(0x000000);
    expect(black.L).toBeCloseTo(0, 1);
    expect(black.a).toBeCloseTo(0, 1);
    expect(black.b).toBeCloseTo(0, 1);

    const white = rgbToLab(0xffffff);
    expect(white.L).toBeCloseTo(100, 1);
    expect(white.a).toBeCloseTo(0, 1);
    expect(white.b).toBeCloseTo(0, 1);
  });

  it('ciede2000 computes perceptual distance between black and white close to 100', () => {
    const de = ciede2000(0x000000, 0xffffff);
    expect(de).toBeCloseTo(100, 0);
  });
});

