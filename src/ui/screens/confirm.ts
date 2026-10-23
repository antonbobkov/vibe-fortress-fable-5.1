/**
 * The confirmation dialog: `02-systems/24-ui-and-input.md` § Confirmations ("Modal `confirm`
 * dialogs with `Yes`/`No` (keys `y`/`n`, `Enter` for the default which is always the safe
 * option)") with the texts and defaults of `03-content/ui-keymap-and-screens.md` § Confirmations
 * (the `confirmations` content table). `Esc` answers the safe way too.
 */

import type { KeyPress } from '@platform/input';
import type { Registry } from '@core/registry';
import { clickHit, type CellPointer, type Screen } from '../screen';
import { fill, type Strings } from '../strings';
import type { KeyContext } from '../keymap';
import type { Surface } from '../surface';
import { button } from '../widgets';

export interface ConfirmRow {
  readonly id: string;
  readonly text: string;
  readonly default: 'yes' | 'no';
}

export class ConfirmScreen implements Screen {
  readonly id = 'confirm' as const;

  /** `y`, `n` and `Enter` (§ Confirmation); `Esc` is fixed. */
  translatedKeys(): readonly KeyContext[] { return ['confirm']; }
  captionKeys(): readonly KeyContext[] { return ['confirm']; }
  readonly text: string;
  readonly defaultYes: boolean;
  private last: Surface | null = null;

  constructor(
    registry: Registry,
    private readonly strings: Strings,
    readonly confirmId: string,
    params: Readonly<Record<string, string | number>>,
    private readonly answer: (yes: boolean) => void,
  ) {
    const row = registry.table<ConfirmRow & { id: string }>('confirmations').byId(confirmId);
    const key = `confirm.${confirmId}`;
    const template = strings.has(key) ? strings.get(key) : (row?.text ?? confirmId);
    this.text = fill(template, params);
    this.defaultYes = row?.default === 'yes';
  }

  /** Answer once; the host pops the dialog. */
  choose(yes: boolean): void {
    this.answer(yes);
  }

  draw(surface: Surface): void {
    this.last = surface;
    const width = Math.min(surface.cols - 4, 60);
    const words = this.text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      if (line.length > 0 && line.length + 1 + word.length > width - 4) {
        lines.push(line);
        line = word;
      } else line = line.length === 0 ? word : `${line} ${word}`;
    }
    if (line.length > 0) lines.push(line);
    const col = Math.max(0, Math.floor((surface.cols - width) / 2));
    const row = Math.max(0, Math.floor((surface.rows - lines.length - 4) / 2));
    surface.fill({ col, row, cols: width, rows: lines.length + 4 }, surface.theme.panelBg);
    lines.forEach((l, k) => surface.text(col + 2, row + 1 + k, l, surface.theme.text, surface.theme.panelBg));
    const r = row + lines.length + 2;
    const yes = this.strings.get('ui.confirm.yes');
    const no = this.strings.get('ui.confirm.no');
    const n = button(surface, col + 2, r, 'y', yes, () => this.choose(true), { focused: this.defaultYes });
    button(surface, col + 4 + n, r, 'n', no, () => this.choose(false), { focused: !this.defaultYes });
  }

  key(press: KeyPress): boolean {
    const k = press.key.toLowerCase();
    if (k === 'y') this.choose(true);
    else if (k === 'n' || press.key === 'Esc') this.choose(false);
    else if (press.key === 'Enter') this.choose(this.defaultYes);
    else return false;
    return true;
  }

  pointerDown(p: CellPointer): void {
    clickHit(this.last, p);
  }
}
