/**
 * The text input dialog: `03-content/ui-keymap-and-screens.md` § Screens (`text_input`: "A single
 * text field | rename, save name") and 24 § Concepts ("`text_input` (modal)"). One `Text` field
 * under a prompt; `Enter` (or the Accept button) answers with the trimmed text, `Esc` (or Cancel)
 * with null. An answer shorter than `minLength` is not accepted and the dialog says why (D-U4).
 */

import type { KeyPress } from '@platform/input';
import { clickHit, type CellPointer, type Screen } from '../screen';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { button, editText, normalizeName, textField, type TextFieldState } from '../widgets';

export interface TextInputSpec {
  /** The prompt above the field ("Rename Ketil Ironvein"). */
  readonly title: string;
  readonly value: string;
  readonly maxLength: number;
  readonly minLength?: number;
}

export class TextInputScreen implements Screen {
  readonly id = 'text_input' as const;
  readonly field: TextFieldState;
  readonly title: string;
  readonly minLength: number;
  /** Why the last `Enter` was not accepted. */
  message: string | null = null;
  private last: Surface | null = null;

  constructor(
    spec: TextInputSpec,
    private readonly strings: Strings,
    private readonly answer: (text: string | null) => void,
  ) {
    this.title = spec.title;
    this.minLength = spec.minLength ?? 1;
    this.field = { value: Array.from(spec.value).slice(0, spec.maxLength).join(''), focused: true, maxLength: spec.maxLength };
  }

  accept(): void {
    const text = normalizeName(this.field.value);
    if (Array.from(text).length < this.minLength) {
      this.message = this.strings.get('ui.text_input.too_short', { min: this.minLength });
      return;
    }
    this.answer(text);
  }

  cancel(): void {
    this.answer(null);
  }

  draw(surface: Surface): void {
    this.last = surface;
    const t = surface.theme;
    const inner = Math.max(12, Math.min(surface.cols - 8, Math.max(this.field.maxLength + 1, Array.from(this.title).length, 30)));
    const width = inner + 4;
    const rows = 7;
    const col = Math.max(0, Math.floor((surface.cols - width) / 2));
    const row = Math.max(0, Math.floor((surface.rows - rows) / 2));
    surface.fill({ col, row, cols: width, rows }, t.panelBg);
    surface.text(col + 2, row + 1, this.title, t.text, t.panelBg, inner);
    textField(surface, col + 2, row + 3, inner - 4, this.field);
    const count = `${Array.from(this.field.value).length}/${this.field.maxLength}`;
    surface.text(col + 2, row + 4, this.message ?? count, this.message === null ? t.dim : t.alert, t.panelBg, inner);
    const n = button(surface, col + 2, row + 5, 'Enter', this.strings.get('ui.text_input.accept'), () => this.accept());
    button(surface, col + 4 + n, row + 5, 'Esc', this.strings.get('ui.text_input.cancel'), () => this.cancel());
  }

  key(press: KeyPress): boolean {
    if (press.key === 'Enter') {
      this.accept();
      return true;
    }
    if (press.key === 'Esc' || press.key === 'Escape') {
      this.cancel();
      return true;
    }
    if (editText(this.field, press)) {
      this.message = null;
      return true;
    }
    // A modal dialog: no key falls through to the screen below.
    return true;
  }

  pointerDown(p: CellPointer): void {
    clickHit(this.last, p);
  }
}
