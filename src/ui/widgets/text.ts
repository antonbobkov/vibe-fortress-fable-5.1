/**
 * `Text` (24 § Concepts › Widget): a single-line text field drawn `[ value________ ]`
 * (`Seed  [ coldmere-4471________ ]`, `Fortress name [ Emberhall__________ ]`). A focused field
 * shows the caret as an inverted cell after the text. Editing is by key: printable characters
 * append, `Backspace` deletes.
 */

import type { KeyPress } from '@platform/input';
import type { Surface } from '../surface';

export interface TextFieldState {
  value: string;
  focused: boolean;
  readonly maxLength: number;
}

/** A key press on a focused field; returns whether it was consumed. */
export function editText(state: TextFieldState, key: KeyPress): boolean {
  if (!state.focused) return false;
  if (key.key === 'Backspace') {
    state.value = Array.from(state.value).slice(0, -1).join('');
    return true;
  }
  if (key.ctrl || key.alt || key.meta) return false;
  if (Array.from(key.key).length !== 1) return false;
  if (Array.from(state.value).length >= state.maxLength) return true;
  state.value += key.key;
  return true;
}

/** Draw `[ value___ ]` in `width` cells of content; returns the cells written. */
export function textField(s: Surface, col: number, row: number, width: number, state: TextFieldState, onFocus?: () => void): number {
  const t = s.theme;
  s.text(col, row, '[ ', t.border);
  const chars = Array.from(state.value);
  const shown = chars.slice(Math.max(0, chars.length - width + 1));
  for (let k = 0; k < width; k += 1) {
    const ch = shown[k];
    s.put(col + 2 + k, row, s.glyphs.index(ch ?? '_'), ch === undefined ? t.dim : t.value, t.black);
  }
  s.text(col + 2 + width, row, ' ]', t.border);
  if (state.focused) {
    const caret = Math.min(shown.length, width - 1);
    s.invert({ col: col + 2 + caret, row, cols: 1, rows: 1 });
  }
  const total = width + 4;
  if (onFocus !== undefined) s.hit({ col, row, cols: total, rows: 1 }, onFocus);
  return total;
}
