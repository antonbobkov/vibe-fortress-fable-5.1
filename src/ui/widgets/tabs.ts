/**
 * `Tabs` (24 § Concepts › Widget): a row of `[k] Label` captions separated by three spaces, the
 * active one inverted (`[1] Dwarves   [2] Supplies   [3] Animals`, `ui-screens/embark.md`).
 */

import type { Surface } from '../surface';
import { label } from './label';
import { UI_NORMAL_SPACING } from '../constants';

export interface TabSpec {
  readonly key: string;
  readonly label: string;
}

/** Draw the tabs; returns the cells written. */
export function tabs(
  s: Surface,
  col: number,
  row: number,
  items: readonly TabSpec[],
  active: number,
  onChoose: (index: number) => void,
  spacing = UI_NORMAL_SPACING,
): number {
  let c = col;
  items.forEach((item, index) => {
    if (index > 0) c += spacing;
    const n = label(s, c, row, `[${item.key}] ${item.label}`);
    const rect = { col: c, row, cols: n, rows: 1 };
    if (index === active) s.invert(rect);
    s.hit(rect, () => onChoose(index));
    c += n;
  });
  return c - col;
}
