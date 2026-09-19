/**
 * `Toggle` (24 § Concepts › Widget): a check box `[■]`/`[□]` with its caption, as the standing
 * orders and labor cells of `ui-screens/panels.md` draw them. A click toggles.
 */

import type { Surface } from '../surface';
import { label } from './label';

export function toggleGlyph(on: boolean): string {
  return on ? '■' : '□';
}

/** Draw `[■] caption`; returns the cells written. */
export function toggle(s: Surface, col: number, row: number, on: boolean, caption: string, onClick?: () => void): number {
  label(s, col, row, `[${toggleGlyph(on)}]`, { fg: s.theme.value, keys: false });
  const n = caption === '' ? 3 : 4 + label(s, col + 4, row, caption);
  if (onClick !== undefined) s.hit({ col, row, cols: n, rows: 1 }, onClick);
  return n;
}
