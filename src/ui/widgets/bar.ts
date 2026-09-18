/**
 * `Bar` (24 § Concepts › Widget): a meter of `▓` filled and `░` empty cells, as the wireframes
 * draw ratings (`Wealth ▓▓▓░░ 3`), attributes (`Str ▓▓▓▓░ 61`) and progress
 * (`▓▓▓▓▓▓░░░░ 62%`). `filled = floor(value × width / max)`, clamped to the width.
 */

import type { Rgb } from '@render/palette';
import type { Surface } from '../surface';

const FULL = '▓';
const EMPTY = '░';

export function barCells(value: number, max: number, width: number): number {
  if (max <= 0 || width <= 0) return 0;
  return Math.max(0, Math.min(width, Math.floor((value * width) / max)));
}

export function bar(s: Surface, col: number, row: number, value: number, max: number, width: number, fg: Rgb = s.theme.value): void {
  const filled = barCells(value, max, width);
  const full = s.glyphs.index(FULL);
  const empty = s.glyphs.index(EMPTY);
  for (let k = 0; k < width; k += 1) {
    s.put(col + k, row, k < filled ? full : empty, k < filled ? fg : s.theme.dim, s.theme.black);
  }
}
