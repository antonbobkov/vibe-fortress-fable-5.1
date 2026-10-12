/** Text filtering shared by Jobs and Stocks (panels.md). */
import type { KeyPress } from '@platform/input';
import type { Surface } from '../surface';
import { label, textField, typedChar } from '../widgets';
import type { PanelContext } from './context';

export class PanelFilter {
  value = '';
  focused = false;

  key(press: KeyPress): boolean {
    if (!this.focused) return false;
    if (press.key === 'Enter' || press.key === 'Esc' || press.key === 'Escape') { this.focused = false; return true; }
    if (press.ctrl || press.alt || press.meta) return false;
    if (press.key === 'Backspace') this.value = Array.from(this.value).slice(0, -1).join('');
    else {
      const ch = typedChar(press.key);
      if (ch === null) return false;
      this.value += ch;
    }
    return true;
  }
}

export function drawPanelFilter(s: Surface, col: number, row: number, width: number, filter: PanelFilter, ctx: PanelContext): void {
  const caption = ctx.strings.get('ui.panel.filter');
  const n = label(s, col, row, caption, { width });
  textField(s, col + n + 1, row, Math.max(1, width - n - 5), { value: filter.value, focused: filter.focused, maxLength: width }, () => { filter.focused = true; });
  s.hit({ col, row, cols: Math.min(n + 1, width), rows: 1 }, () => { filter.focused = true; });
}
