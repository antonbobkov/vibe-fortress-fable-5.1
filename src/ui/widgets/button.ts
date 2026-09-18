/**
 * `Button` (24 § Concepts › Widget): `[k] Label`, the accelerator in `text_key`, clickable. A
 * disabled button is drawn in `text_dim` and does nothing ("the Embark button is dim with a reason
 * line", `ui-screens/embark.md`).
 */

import type { Surface } from '../surface';
import { label } from './label';

export interface ButtonOptions {
  readonly enabled?: boolean;
  /** Draw inverted (the focused field of a form). */
  readonly focused?: boolean;
}

/** Draw `[key] text`; returns the cells written. */
export function button(
  s: Surface,
  col: number,
  row: number,
  key: string,
  text: string,
  onPress: () => void,
  options: ButtonOptions = {},
): number {
  const enabled = options.enabled !== false;
  const caption = key.length > 0 ? `[${key}] ${text}` : text;
  const n = enabled ? label(s, col, row, caption) : s.text(col, row, caption, s.theme.dim);
  const rect = { col, row, cols: n, rows: 1 };
  if (options.focused === true) s.invert(rect);
  if (enabled) s.hit(rect, onPress);
  return n;
}
