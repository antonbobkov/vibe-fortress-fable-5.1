/**
 * The main menu: `04-implementation/ui-screens/menus-and-world.md` § Main menu and
 * `02-systems/24-ui-and-input.md` § Screens outside the fortress ("`New world`, `Continue` (loads
 * the newest save), `Load`, `Legends`, `Settings`, `About`, `Intro`. Arrow keys and mouse").
 *
 * "`Continue` loads the newest save of any kind; hidden when none exists." The screens behind
 * `Load`, `Legends`, `Settings` and `About` belong to later milestones (save/load T-M2-11, the rest
 * M7); until the host offers them their entries are drawn dim and cannot be chosen
 * (docs/archive/decisions-archive.md D-061).
 */

import type { KeyPress } from '@platform/input';
import type { KeyContext, Keymap } from '../keymap';
import { clickHit, type CellPointer, type Screen } from '../screen';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { label, menu, moveSelection, type MenuItem } from '../widgets';

export interface MainMenuHost {
  /** The newest save's summary (`Emberhall · Year 2`), or `null` when there is no save. */
  newestSave(): string | null;
  newWorld(): void;
  continueGame(): void;
  /** Which of `load`, `legends`, `settings`, `about`, `intro` the app can open yet. */
  available(entry: string): boolean;
  open(entry: string): void;
}

export class MainMenuScreen implements Screen {
  readonly id = 'main_menu' as const;

  translatedKeys(): readonly KeyContext[] { return ['main_menu']; }
  captionKeys(): readonly KeyContext[] { return ['main_menu', 'panel']; }
  selected = 'new_world';
  private last: Surface | null = null;

  constructor(
    private readonly host: MainMenuHost,
    private readonly keymap: Keymap,
    private readonly strings: Strings,
  ) {}

  items(): MenuItem[] {
    const s = this.strings;
    const save = this.host.newestSave();
    const entry = (id: string, key: string): MenuItem => ({
      id,
      key,
      label: s.get(`ui.menu.${id}`),
      enabled: this.host.available(id),
    });
    const cont: MenuItem =
      save === null
        ? { id: 'continue', key: 'c', label: s.get('ui.menu.continue'), hidden: true }
        : { id: 'continue', key: 'c', label: s.get('ui.menu.continue'), detail: `(${save})` };
    return [
      { id: 'new_world', key: 'n', label: s.get('ui.menu.new_world') },
      cont,
      entry('load', 'l'),
      entry('legends', 'g'),
      entry('settings', 'o'),
      entry('about', 'a'),
      entry('intro', 'i'),
    ];
  }

  draw(surface: Surface): void {
    this.last = surface;
    const cols = surface.cols;
    const title = this.strings.get('ui.menu.title');
    const subtitle = this.strings.get('ui.menu.subtitle');
    const top = Math.max(1, Math.floor(surface.rows / 2) - 8);
    label(surface, Math.floor((cols - Array.from(title).length) / 2), top, title, { fg: surface.theme.key });
    label(surface, Math.floor((cols - Array.from(subtitle).length) / 2), top + 1, subtitle, { fg: surface.theme.dim });
    menu(surface, Math.floor(cols / 2) - 10, top + 3, this.items(), this.selected, (id) => this.choose(id));
  }

  choose(id: string): void {
    const item = this.items().find((i) => i.id === id);
    if (item === undefined || item.hidden === true || item.enabled === false) return;
    this.selected = id;
    if (id === 'new_world') this.host.newWorld();
    else if (id === 'continue') this.host.continueGame();
    else this.host.open(id);
  }

  key(press: KeyPress): boolean {
    const action = this.keymap.resolve('panel', press);
    if (action?.id === 'select') {
      this.selected = moveSelection(this.items(), this.selected, action.arg === '↑' ? -1 : 1);
      return true;
    }
    if (action?.id === 'activate') {
      this.choose(this.selected);
      return true;
    }
    if (action?.id === 'accelerator') {
      const item = this.items().find((i) => i.key === action.arg && i.hidden !== true);
      if (item === undefined) return false;
      this.choose(item.id);
      return true;
    }
    return false;
  }

  pointerDown(p: CellPointer): void {
    clickHit(this.last, p);
  }
}
