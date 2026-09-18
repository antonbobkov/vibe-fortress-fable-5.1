/**
 * `Dropdown` (24 § Concepts › Widget): a closed field `[ value ▼ ]` that opens into a list of
 * options below it, the highlighted one marked `▶` (the presets menu of `ui-screens/embark.md`:
 * "Balanced, Miner's Guild, Farmstead, Warband, each with its one-line description and total").
 */

import type { KeyPress } from '@platform/input';
import type { Surface } from '../surface';
import { label } from './label';

export interface DropdownOption {
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
}

export interface DropdownState {
  open: boolean;
  highlighted: number;
}

/**
 * A key on an open dropdown: `↑`/`↓` move, `Enter` chooses, `Esc` closes. Returns the chosen id,
 * `'handled'` for a key it used, or `null`.
 */
export function dropdownKey(state: DropdownState, options: readonly DropdownOption[], key: KeyPress): string | 'handled' | null {
  if (!state.open) return null;
  if (key.key === '↑' || key.key === '↓') {
    const d = key.key === '↑' ? -1 : 1;
    state.highlighted = (state.highlighted + d + options.length) % Math.max(1, options.length);
    return 'handled';
  }
  if (key.key === 'Esc') {
    state.open = false;
    return 'handled';
  }
  if (key.key === 'Enter') {
    const chosen = options[state.highlighted];
    state.open = false;
    return chosen === undefined ? 'handled' : chosen.id;
  }
  return null;
}

/** Draw the dropdown; returns the rows used (1 closed, 1 + options open). */
export function dropdown(
  s: Surface,
  col: number,
  row: number,
  width: number,
  value: string,
  options: readonly DropdownOption[],
  state: DropdownState,
  onChoose: (id: string) => void,
  onToggle: () => void,
): number {
  const t = s.theme;
  const inner = Math.max(1, width - 6);
  const shown = Array.from(value).slice(0, inner).join('').padEnd(inner);
  s.text(col, row, `[ ${shown} ▼ ]`, t.value);
  s.hit({ col, row, cols: width, rows: 1 }, onToggle);
  if (!state.open) return 1;
  options.forEach((option, index) => {
    const r = row + 1 + index;
    s.fill({ col, row: r, cols: width, rows: 1 }, t.panelBg);
    const mark = index === state.highlighted ? '▶ ' : '  ';
    const n = label(s, col, r, `${mark}${option.label}`, { bg: t.panelBg, width });
    if (option.detail !== undefined) s.text(col + n + 1, r, option.detail, t.dim, t.panelBg, Math.max(0, width - n - 1));
    s.hit({ col, row: r, cols: width, rows: 1 }, () => onChoose(option.id));
  });
  return 1 + options.length;
}
