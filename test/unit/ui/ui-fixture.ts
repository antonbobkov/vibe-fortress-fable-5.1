/**
 * Shared fixtures for the `ui/` tests: a surface over a fresh cell buffer, the keymap, the
 * strings, and key presses.
 */

import { loadContent } from '@content/loader';
import type { Registry } from '@core/registry';
import type { KeyPress } from '@platform/input';
import { CellBuffer } from '@render/cellbuffer';
import { Palette, toHex } from '@render/palette';
import { Keymap, type KeymapRow } from '@ui/keymap';
import { Strings } from '@ui/strings';
import { GlyphMap, Surface, themeOf } from '@ui/surface';

export const registry: Registry = loadContent();
export const palette = new Palette(registry);
export const glyphs = GlyphMap.of(registry);
export const theme = themeOf(palette);
export const keymap = Keymap.fromRows(registry.derived<readonly KeymapRow[]>('keymap'));
export const strings = new Strings(registry);

export function surface(cols: number, rows: number): Surface {
  const cells = new CellBuffer(cols, rows);
  cells.fill(0, theme.black, theme.black);
  return new Surface(cells, glyphs, theme, palette);
}

export function press(key: string, mods: Partial<Omit<KeyPress, 'key'>> = {}): KeyPress {
  return { key, repeat: false, shift: false, ctrl: false, alt: false, meta: false, ...mods };
}

/** Every cell as `glyph:fg:bg`, row by row: the golden form of a buffer. */
export function cellRows(s: Surface): string[][] {
  const rows: string[][] = [];
  for (let row = 0; row < s.rows; row += 1) {
    const out: string[] = [];
    for (let col = 0; col < s.cols; col += 1) {
      const cell = s.cells.get(col, row);
      out.push(`${cell.glyph}:${toHex(cell.fg)}:${toHex(cell.bg)}`);
    }
    rows.push(out);
  }
  return rows;
}

/** The foreground colour (as `#rrggbb`) of the cell where `text` starts on a row, or null when the row lacks it. */
export function fgOfText(s: Surface, row: number, text: string): string | null {
  const at = s.lines()[row]?.indexOf(text) ?? -1;
  return at < 0 ? null : toHex(s.cells.get(at, row).fg);
}

/** A theme colour as `#rrggbb`, to compare with {@link fgOfText}. */
export function hexOf(color: Parameters<typeof toHex>[0]): string {
  return toHex(color);
}
