/**
 * T-592: a selection or drag box shows over unexplored rock. `Surface.invert` swaps a cell's
 * colours; a cell drawn in one colour (unexplored rock, open sky, a black floor) would not change,
 * so it takes the text colour as its background instead.
 */
import { describe, expect, it } from 'vitest';
import { CellBuffer } from '@render/cellbuffer';
import { Palette } from '@render/palette';
import { Surface, themeOf } from '@ui/surface';
import { glyphs, registry } from './ui-fixture';

describe('T-592: an inverted cell always changes', () => {
  const palette = new Palette(registry);
  const theme = themeOf(palette);
  const fresh = (): Surface => new Surface(new CellBuffer(4, 2), glyphs, theme, palette);

  it('a one-colour cell takes the text colour as its background', () => {
    const s = fresh();
    s.put(0, 0, 32, 0x101010, 0x101010);
    s.invert({ col: 0, row: 0, cols: 1, rows: 1 });
    const c = s.cells.get(0, 0);
    expect(c.bg).toBe(theme.text);
    expect(c.fg).toBe(theme.black);
  });

  it('a cell with contrast still swaps its colours', () => {
    const s = fresh();
    s.put(1, 0, 35, 0xc0c0c0, 0x000000);
    s.invert({ col: 1, row: 0, cols: 1, rows: 1 });
    const c = s.cells.get(1, 0);
    expect(c.fg).toBe(0x000000);
    expect(c.bg).toBe(0xc0c0c0);
  });
});
