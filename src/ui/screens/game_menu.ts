/**
 * The fortress's Esc menu: `02-systems/24-ui-and-input.md` § Game menu ("`Resume`, `Save`, `Load`,
 * `Settings`, `Retire fortress` (confirm), `Main menu` (confirm if unsaved changes since the last
 * save)") laid out as `ui-screens/fortress-screen.md` § Game menu draws it, with the fortress name
 * in the title row (T-M7-09). `Abandon fortress` (confirm) ends the fortress and
 * goes back to the world map of the same world for a new embark (T-672). Every row but Resume keeps
 * its letter on `Shift`, and a bare panel letter opens its panel (`ui-keymap-and-screens.md` § Game menu).
 */
import type { KeyPress } from '@platform/input';
import { clickHit, type CellPointer, type Screen } from '../screen';
import { acceleratorOf, type KeyContext } from '../keymap';
import type { Surface } from '../surface';
import { UI_STRINGS, type Strings } from '../strings';
import { label, menu, moveSelection, type MenuItem } from '../widgets';
import { GAME_MENU_MESSAGE_MS } from '../constants';

export interface GameMenuHost {
  /** The title row: `Deepholm · <fortress>`. */
  fortressName(): string;
  resume(): void;
  save(): void;
  load(): void;
  settings(): void;
  rename?(): void;
  retire(): void;
  /** Abandon the fortress for a new embark on the same world; absent or `canAbandon` false: disabled. */
  abandon?(): void;
  /** Whether the running fortress has a world map to go back to. */
  canAbandon?(): boolean;
  mainMenu(): void;
  /**
   * A bare letter that is none of the menu's own: a fortress panel letter closes the menu and opens
   * its panel, as on the fortress screen. Returns whether the letter did; absent: nothing does.
   */
  panelLetter?(press: KeyPress): boolean;
  viewOnly(): boolean;
  /** The clock of the three seconds a message stays up; absent in a bare test host. */
  now?(): number;
}

/**
 * The letters of the menu's actions that are kept on `Shift` (`[S-a]`): every one but Resume's, so a
 * bare letter pressed after one `Esc` too many opens its panel and never saves, loads or ends the
 * fortress (`ui-keymap-and-screens.md` § Game menu).
 */
const SHIFT_ONLY: ReadonlySet<string> = new Set(['s', 'l', 'o', 'n', 'x', 'a', 'm']);

export class GameMenuScreen implements Screen {
  readonly id = 'game_menu' as const;

  /** The entries' letters and the list keys; `Esc` is fixed. */
  translatedKeys(): readonly KeyContext[] { return ['game_menu', 'panel']; }
  captionKeys(): readonly KeyContext[] { return ['game_menu', 'panel']; }
  selected = 'resume';
  private last: Surface | null = null;
  private flashed: { text: string; until: number } | null = null;
  constructor(private readonly host: GameMenuHost, private readonly strings?: Strings) {}

  /** A line under the title for `GAME_MENU_MESSAGE_MS`: what saving did. */
  flash(text: string): void {
    this.flashed = { text, until: (this.host.now?.() ?? 0) + GAME_MENU_MESSAGE_MS };
  }

  /** The message while it shows, or null. */
  get message(): string | null {
    return this.flashed !== null && (this.host.now?.() ?? 0) < this.flashed.until ? this.flashed.text : null;
  }

  items(): MenuItem[] {
    const enabled = !this.host.viewOnly();
    return [
      { id: 'resume', key: 'r', label: 'Resume' },
      { id: 'save', key: 'S-s', label: 'Save', enabled },
      { id: 'load', key: 'S-l', label: 'Load' },
      { id: 'settings', key: 'S-o', label: 'Settings' },
      { id: 'rename', key: 'S-n', label: this.strings?.get('ui.menu.rename') ?? UI_STRINGS['ui.menu.rename'] ?? '', enabled },
      { id: 'retire', key: 'S-x', label: 'Retire fortress', enabled },
      { id: 'abandon', key: 'S-a', label: this.strings?.get('ui.menu.abandon') ?? UI_STRINGS['ui.menu.abandon'] ?? '', enabled: enabled && this.host.abandon !== undefined && this.host.canAbandon?.() !== false },
      { id: 'main_menu', key: 'S-m', label: 'Main menu' },
    ];
  }

  draw(surface: Surface): void {
    this.last = surface;
    const col = Math.max(2, Math.floor(surface.cols / 2) - 12);
    const row = Math.max(1, Math.floor(surface.rows / 2) - 5);
    label(surface, col, row, `Deepholm · ${this.host.fortressName()}`, { fg: surface.theme.key });
    const message = this.message;
    if (message !== null) label(surface, col, row + 1, message, { fg: surface.theme.good, width: Math.max(1, surface.cols - col - 1) });
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
      case 'abandon': this.host.abandon?.(); break;
      case 'main_menu': this.host.mainMenu(); break;
      default: break;
    }
  }

  key(press: KeyPress): boolean {
    if (press.key === 'Esc' || press.key === 'Escape') { this.host.resume(); return true; }
    if (press.key === 'ArrowUp' || press.key === '↑') { this.selected = moveSelection(this.items(), this.selected, -1); return true; }
    if (press.key === 'ArrowDown' || press.key === '↓') { this.selected = moveSelection(this.items(), this.selected, 1); return true; }
    if (press.key === 'Enter') { this.choose(this.selected); return true; }
    // The menu's own letters first; then a bare letter goes on to the panels (D-253).
    const letter = acceleratorOf(press, SHIFT_ONLY);
    const own = letter === '' ? undefined : this.items().find((row) => row.key === (SHIFT_ONLY.has(letter) ? `S-${letter}` : letter));
    if (own !== undefined) { this.choose(own.id); return true; }
    if (press.shift || acceleratorOf(press) === '') return false;
    return this.host.panelLetter?.(press) ?? false;
  }

  pointerDown(p: CellPointer): void { clickHit(this.last, p); }
}
