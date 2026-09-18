/**
 * `Number` (24 § Concepts › Widget): `[-] n [+]`, as the embark screen draws skills and quantities
 * (`ui-screens/embark.md`: "`▶ Mining [-] 5 [+]`", "`Iron pick 108 ☼ [-] 2 [+] = 216`"). "The
 * `max` per entry disables `[+]` at the limit": a control at its bound is drawn dim and does
 * nothing.
 */

import type { Surface } from '../surface';
import { label } from './label';

export interface NumberOptions {
  readonly min?: number;
  readonly max?: number;
  /** Cells the value is right-aligned in; the value's own width by default. */
  readonly width?: number;
}

/** Draw `[-] n [+]`; returns the cells written. `onChange` gets −1 or +1. */
export function numberField(
  s: Surface,
  col: number,
  row: number,
  value: number,
  onChange: (delta: number) => void,
  options: NumberOptions = {},
): number {
  const t = s.theme;
  const canDown = options.min === undefined || value > options.min;
  const canUp = options.max === undefined || value < options.max;
  let c = col;
  const minus = canDown ? label(s, c, row, '[-]') : s.text(c, row, '[-]', t.dim);
  if (canDown) s.hit({ col: c, row, cols: 3, rows: 1 }, () => onChange(-1));
  c += minus + 1;
  const text = String(value);
  const width = Math.max(options.width ?? text.length, text.length);
  c += s.text(c + width - text.length, row, text, t.value) + (width - text.length) + 1;
  const plus = canUp ? label(s, c, row, '[+]') : s.text(c, row, '[+]', t.dim);
  if (canUp) s.hit({ col: c, row, cols: 3, rows: 1 }, () => onChange(1));
  c += plus;
  return c - col;
}
