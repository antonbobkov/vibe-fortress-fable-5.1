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
    // A title that does not fit ends with `»` and has the whole as its tooltip, as any cut label.
    const chars = Array.from(title);
    const room = width - 5;
    if (chars.length <= room) s.text(col + 3, row, ` ${title} `, s.theme.text, bg, width - 4);
    else {
      s.text(col + 3, row, ` ${chars.slice(0, Math.max(0, room - 1)).join('')}» `, s.theme.text, bg, width - 4);
      s.tooltip({ col, row, cols: width, rows: 1 }, title);
    }
  }
}
