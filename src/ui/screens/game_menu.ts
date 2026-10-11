/**
 * The fortress's Esc menu: `02-systems/24-ui-and-input.md` § Game menu ("`Resume`, `Save`, `Load`,
 * `Settings`, `Retire fortress` (confirm), `Main menu` (confirm if unsaved changes since the last
 * save)") laid out as `ui-screens/fortress-screen.md` § Game menu draws it, with the fortress name
 * in the title row and `[x]` on Retire (T-M7-09).
 */
import type { KeyPress } from '@platform/input';
import { clickHit, type CellPointer, type Screen } from '../screen';
import type { Surface } from '../surface';
import { UI_STRINGS, type Strings } from '../strings';
import { label, menu, moveSelection, type MenuItem } from '../widgets';

export interface GameMenuHost {
  /** The title row: `Deepholm · <fortress>`. */
  fortressName(): string;
  resume(): void;
  save(): void;
  load(): void;
  settings(): void;
  rename?(): void;
  retire(): void;
  mainMenu(): void;
  viewOnly(): boolean;
}

export class GameMenuScreen implements Screen {
  readonly id = 'game_menu' as const;
  selected = 'resume';
  private last: Surface | null = null;
  constructor(private readonly host: GameMenuHost, private readonly strings?: Strings) {}

  items(): MenuItem[] {
    const enabled = !this.host.viewOnly();
    return [
      { id: 'resume', key: 'r', label: 'Resume' },
      { id: 'save', key: 's', label: 'Save', enabled },
      { id: 'load', key: 'l', label: 'Load' },
      { id: 'settings', key: 'o', label: 'Settings' },
      { id: 'rename', key: 'n', label: this.strings?.get('ui.menu.rename') ?? UI_STRINGS['ui.menu.rename'] ?? '', enabled },
      { id: 'retire', key: 'x', label: 'Retire fortress', enabled },
      { id: 'main_menu', key: 'm', label: 'Main menu' },
    ];
  }

  draw(surface: Surface): void {
    this.last = surface;
    const col = Math.max(2, Math.floor(surface.cols / 2) - 12);
    const row = Math.max(1, Math.floor(surface.rows / 2) - 5);
    label(surface, col, row, `Deepholm · ${this.host.fortressName()}`, { fg: surface.theme.key });
    menu(surface, col, row + 2, this.items(), this.selected, (id) => this.choose(id));
  }

  choose(id: string): void {
    const item = this.items().find((row) => row.id === id);
    if (item === undefined || item.enabled === false) return;
    this.selected = id;
    switch (id) {
      case 'resume': this.host.resume(); break;
      case 'save': this.host.save(); break;
      case 'load': this.host.load(); break;
      case 'settings': this.host.settings(); break;
      case 'rename': this.host.rename?.(); break;
      case 'retire': this.host.retire(); break;
      case 'main_menu': this.host.mainMenu(); break;
      default: break;
    }
  }

  key(press: KeyPress): boolean {
    if (press.key === 'Esc' || press.key === 'Escape') { this.host.resume(); return true; }
    if (press.key === 'ArrowUp' || press.key === '↑') { this.selected = moveSelection(this.items(), this.selected, -1); return true; }
    if (press.key === 'ArrowDown' || press.key === '↓') { this.selected = moveSelection(this.items(), this.selected, 1); return true; }
    if (press.key === 'Enter') { this.choose(this.selected); return true; }
    const item = this.items().find((row) => row.key === press.key.toLowerCase());
    if (item !== undefined) { this.choose(item.id); return true; }
    return false;
  }

  pointerDown(p: CellPointer): void { clickHit(this.last, p); }
}
