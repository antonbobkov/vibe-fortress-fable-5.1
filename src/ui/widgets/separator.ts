/**
 * `Separator` (24 § Concepts › Widget): a box-drawing rule across a width, optionally titled
 * (`── Skills (points left: 0) ─────`, `ui-screens/embark.md`). "Panel borders use box-drawing
 * glyphs" (23 § Text cells).
 */

import type { Surface } from '../surface';

const RULE = '─';

export function separator(s: Surface, col: number, row: number, width: number, title?: string): void {
  const fg = s.theme.border;
  const bg = s.theme.black;
  const rule = s.glyphs.index(RULE);
  for (let k = 0; k < width; k += 1) s.put(col + k, row, rule, fg, bg);
  if (title !== undefined && title.length > 0 && width > 4) {
    s.text(col + 3, row, ` ${title} `, s.theme.text, bg, width - 4);
  }
}
