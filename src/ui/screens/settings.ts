/**
 * Player preferences and the keybinding editor (T-M7-07, `ui-screens/menus-and-world.md` § Settings).
 *
 * The editor lists every binding under its context's heading, in the order of
 * `ui-keymap-and-screens.md` § Keymap (the fortress screen and its panels, the screens over it, the
 * screens before it). Its own keys are fixed (§ Fixed keys), so it works whatever the bindings are.
 */
import type { KeyPress } from '@platform/input';
import { browserReserved, keyLabel, KEY_CONTEXTS, MODIFIER_KEYS, type Binding, type Keymap, type KeySpec } from '../keymap';
import { actionText, contextTitle } from '../panels/help';
import { clickHit, type CellPointer, type Screen } from '../screen';
import type { UserSettings } from '../settings';
import type { Surface } from '../surface';
import type { Strings } from '../strings';
import { bindingConflict, bindingReset, browserBinding, fixedBinding, invalidBindingModifiers } from '../messages';
import { captionButtons, label, type ListState } from '../widgets';
import { SETTINGS_COMBAT_LOG_OPTIONS, SETTINGS_INTRO_OPTIONS, SETTINGS_INTRO_STYLE_OPTIONS, SETTINGS_SNAPSHOT_OPTIONS, SETTINGS_VOLUME_STEP, SETTINGS_ZOOM_OPTIONS } from '../constants';

export interface SettingsHost {
  readonly keymap: Keymap;
  readonly strings: Strings;
  settings(): Readonly<UserSettings>;
  /** The zoom the setting asks for (`Auto` resolved) and the zoom the window shows. */
  zoomView?(): { requested: number; shown: number };
  change(patch: Partial<UserSettings>): void;
  /** The keymap changed: save it with the preferences. */
  bindingsChanged(): void;
  resetDefaults(): void;
  back(): void;
}

const SETTING_NAMES = [
  'Auto-pause on danger', 'Auto-pause on alert', 'Hints', 'Colorblind palette', 'Zoom',
  'Edge scrolling', 'Autosave each season', 'Snapshots kept', 'Combat log', 'Keybindings ▸',
  'Music volume', 'Music', 'Intro at launch', 'Intro style',
] as const;

/** The row of {@link SETTING_NAMES} that opens the keybinding editor, and has no value. */
const KEYBINDINGS_ROW = 9;

/** The music volumes, 0 to 100. */
const VOLUME_OPTIONS: readonly number[] = Array.from({ length: 100 / SETTINGS_VOLUME_STEP + 1 }, (_, k) => k * SETTINGS_VOLUME_STEP);

/** The editor's columns: the action from here, the key from {@link KEY_COL}. */
const ACTION_COL = 4;
const KEY_COL = 50;

/** A row of the editor's list: a context heading, or a binding by its index in the keymap. */
type EditorRow = { readonly heading: string } | { readonly index: number };

export class SettingsScreen implements Screen {
  readonly id = 'settings' as const;
  selected = 0;
  keybindings = false;
  /** `selected`: the keymap index of the binding the cursor is on; `scroll`: the first editor row shown. */
  readonly bindingList: ListState = { selected: 0, scroll: 0 };
  capturing = false;
  /** The last refusal or reset, shown under the list (a conflict in the bad colour). */
  conflict: string | null = null;
  /** The binding a refused key belongs to, drawn in the bad colour. */
  conflictWith: Binding | null = null;
  /** Whether {@link conflict} is a refusal (the bad colour) and not a done reset. */
  private refused = false;
  private last: Surface | null = null;

  constructor(private readonly host: SettingsHost) {}

  private value(index: number): string {
    const settings = this.host.settings();
    switch (index) {
      case 0: return settings.autoPauseDanger ? 'on' : 'off';
      case 1: return settings.autoPauseAlert ? 'on' : 'off';
      case 2: return settings.hints ? 'on' : 'off';
      case 3: return settings.colorblind ? 'on' : 'off';
      case 4: return settings.zoom === 'auto' ? 'Auto' : `${settings.zoom}×`;
      case 5: return settings.edgeScrolling ? 'on' : 'off';
      case 6: return settings.autosave ? 'on' : 'off';
      case 7: return String(settings.snapshotsKept);
      case 8: return settings.combatLog;
      case 10: return `${settings.musicVolume}%`;
      case 11: return settings.music ? 'on' : 'off';
      case 12: return settings.intro;
      case 13: return settings.introStyle;
      default: return '';
    }
  }

  private change(index: number, delta = 1): void {
    const current = this.host.settings();
    const cycle = <T>(options: readonly T[], value: T): T => options[(options.indexOf(value) + delta + options.length) % options.length] as T;
    switch (index) {
      case 0: this.host.change({ autoPauseDanger: !current.autoPauseDanger }); break;
      case 1: this.host.change({ autoPauseAlert: !current.autoPauseAlert }); break;
      case 2: this.host.change({ hints: !current.hints }); break;
      case 3: this.host.change({ colorblind: !current.colorblind }); break;
      case 4: this.host.change({ zoom: cycle(SETTINGS_ZOOM_OPTIONS, current.zoom) }); break;
      case 5: this.host.change({ edgeScrolling: !current.edgeScrolling }); break;
      case 6: this.host.change({ autosave: !current.autosave }); break;
      case 7: this.host.change({ snapshotsKept: cycle(SETTINGS_SNAPSHOT_OPTIONS, current.snapshotsKept) }); break;
      case 8: this.host.change({ combatLog: cycle(SETTINGS_COMBAT_LOG_OPTIONS, current.combatLog) }); break;
      case 9: this.openKeybindings(); break;
      case 10: this.host.change({ musicVolume: cycle(VOLUME_OPTIONS, current.musicVolume) }); break;
      case 11: this.host.change({ music: !current.music }); break;
      case 12: this.host.change({ intro: cycle(SETTINGS_INTRO_OPTIONS, current.intro) }); break;
      case 13: this.host.change({ introStyle: cycle(SETTINGS_INTRO_STYLE_OPTIONS, current.introStyle) }); break;
      default: break;
    }
  }

  private openKeybindings(): void {
    this.keybindings = true;
    this.bindingList.selected = this.order()[0] ?? 0;
    this.bindingList.scroll = 0;
    this.clearMessage();
  }

  private clearMessage(): void {
    this.conflict = null;
    this.conflictWith = null;
    this.refused = false;
  }

  /** Say why a key was refused; `owner` is the binding that has it. */
  private refuse(text: string, owner: Binding | null = null): void {
    this.conflict = text;
    this.conflictWith = owner;
    this.refused = true;
  }

  /** Say what a reset did. */
  private tell(text: string): void {
    this.conflict = text;
    this.conflictWith = null;
    this.refused = false;
  }

  /** The editor's rows: each context's heading, then its bindings in table order. */
  rows(): EditorRow[] {
    const keymap = this.host.keymap;
    const out: EditorRow[] = [];
    for (const context of KEY_CONTEXTS) {
      const indices = keymap.bindings.flatMap((binding, index) => (binding.context === context ? [index] : []));
      if (indices.length === 0) continue;
      out.push({ heading: contextTitle(context) });
      for (const index of indices) out.push({ index });
    }
    return out;
  }

  /** The bindings in the order the editor lists them. */
  private order(): number[] {
    return this.rows().flatMap((row) => ('index' in row ? [row.index] : []));
  }

  /** Move the cursor `delta` bindings along the list. */
  private move(delta: number): void {
    const order = this.order();
    const at = Math.max(0, order.indexOf(this.bindingList.selected));
    this.bindingList.selected = order[Math.max(0, Math.min(order.length - 1, at + delta))] ?? 0;
  }

  /** Start capturing a key for the binding at `index`; a fixed key says so instead. */
  private startCapture(index: number): void {
    this.bindingList.selected = index;
    const keymap = this.host.keymap;
    const binding = keymap.bindings[index];
    this.clearMessage();
    if (binding === undefined) return;
    if (keymap.fixed(index)) {
      this.capturing = false;
      this.refuse(fixedBinding(this.host.strings, this.keyText(binding.spec)));
      return;
    }
    this.capturing = true;
  }

  private keyText(spec: KeySpec): string {
    return spec.key === 'any-letter' ? '[letter]' : this.host.keymap.label(spec);
  }

  private capture(press: KeyPress): void {
    if (MODIFIER_KEYS.has(press.key)) return;
    if (press.alt || press.meta) { this.refuse(invalidBindingModifiers(this.host.strings)); return; }
    const key = press.key === ' ' ? 'Space' : press.key;
    const spec: KeySpec = { key, ctrl: press.ctrl, shift: press.shift };
    if (browserReserved(spec)) { this.refuse(browserBinding(this.host.strings, keyLabel({ ...spec, key: key.length === 1 ? key.toUpperCase() : key }))); return; }
    const conflict = this.host.keymap.rebind(this.bindingList.selected, spec);
    if (conflict) { this.refuse(bindingConflict(this.host.strings, conflict), conflict); return; }
    this.capturing = false;
    this.clearMessage();
    this.host.bindingsChanged();
  }

  /** `Delete` or `Backspace`: the binding under the cursor back to its default. */
  private resetSelected(): void {
    const keymap = this.host.keymap;
    const index = this.bindingList.selected;
    const binding = keymap.bindings[index];
    if (binding === undefined || keymap.fixed(index)) return;
    const conflict = keymap.resetOne(index);
    if (conflict) { this.refuse(bindingConflict(this.host.strings, conflict), conflict); return; }
    this.tell(bindingReset(this.host.strings, binding, this.keyText((keymap.bindings[index] as Binding).spec)));
    this.host.bindingsChanged();
  }

  /** `[d]` in the editor: every binding back to its default. */
  private resetAll(): void {
    this.host.keymap.reset();
    this.tell(this.host.strings.get('ui.settings.bindings_reset'));
    this.host.bindingsChanged();
  }

  key(press: KeyPress): boolean {
    const k = press.key;
    if (k === 'Esc' || k === 'Escape') {
      if (this.capturing) { this.capturing = false; this.clearMessage(); }
      else if (this.keybindings) { this.keybindings = false; this.clearMessage(); }
      else this.host.back();
      return true;
    }
    if (this.capturing) { this.capture(press); return true; }
    if (k === 'ArrowUp' || k === '↑') {
      if (this.keybindings) this.move(-1);
      else this.selected = Math.max(0, this.selected - 1);
      return true;
    }
    if (k === 'ArrowDown' || k === '↓') {
      if (this.keybindings) this.move(1);
      else this.selected = Math.min(SETTING_NAMES.length - 1, this.selected + 1);
      return true;
    }
    if (this.keybindings) {
      if (k === 'Enter') { this.startCapture(this.bindingList.selected); return true; }
      if (k === 'PageUp' || k === 'PageDown') { this.move(k === 'PageUp' ? -10 : 10); return true; }
      if (k === 'Delete' || k === 'Backspace') { this.resetSelected(); return true; }
      if (k.toLowerCase() === 'd' && !press.ctrl && !press.alt && !press.meta) { this.resetAll(); return true; }
      return false;
    }
    if (k.toLowerCase() === 'd' && !press.ctrl && !press.alt && !press.meta) { this.host.resetDefaults(); return true; }
    if (k === 'Enter' || k === ' ' || k === 'Space' || k === 'ArrowRight' || k === '→' || k === 'ArrowLeft' || k === '←') {
      this.change(this.selected, k === 'ArrowLeft' || k === '←' ? -1 : 1);
      return true;
    }
    return false;
  }

  draw(surface: Surface): void {
    this.last = surface;
    const t = surface.theme;
    label(surface, 2, 1, this.keybindings ? 'Settings · Keybindings' : 'Settings', { fg: t.key });
    if (!this.keybindings) {
      for (let index = 0; index < SETTING_NAMES.length; index += 1) {
        const row = 3 + index;
        const prefix = index === this.selected ? '▶' : ' ';
        label(surface, 2, row, `${prefix} ${SETTING_NAMES[index]}`, { fg: index === this.selected ? t.key : t.text, width: 29 });
        if (index !== KEYBINDINGS_ROW) label(surface, 32, row, `[${this.value(index)}]`, { fg: t.value, width: 18 });
        surface.hit({ col: 2, row, cols: 48, rows: 1 }, () => { this.selected = index; this.change(index); });
      }
      const below = 3 + SETTING_NAMES.length;
      label(surface, 2, below, this.host.strings.get('ui.settings.zoom_hint'), { fg: t.dim });
      const view = this.host.zoomView?.();
      if (view !== undefined && view.shown < view.requested) {
        const zoom = this.host.settings().zoom === 'auto' ? 'Auto' : String(view.requested);
        label(surface, 2, below + 1, this.host.strings.get('ui.settings.zoom_shown', { zoom, shown: view.shown }), { fg: t.alert });
      }
      captionButtons(surface, 2, below + 2, '[d] Reset to defaults    [Esc] Back', [() => this.host.resetDefaults(), () => this.host.back()], { fg: t.dim });
      return;
    }
    this.drawKeybindings(surface);
  }

  private drawKeybindings(surface: Surface): void {
    const t = surface.theme;
    const keymap = this.host.keymap;
    const rows = this.rows();
    const height = Math.max(1, surface.rows - 6);
    // Keep the cursor's row in view, with its context's heading when it fits.
    const at = Math.max(0, rows.findIndex((row) => 'index' in row && row.index === this.bindingList.selected));
    const maxScroll = Math.max(0, rows.length - height);
    if (at - 1 < this.bindingList.scroll) this.bindingList.scroll = Math.max(0, at - 1);
    if (at >= this.bindingList.scroll + height) this.bindingList.scroll = at - height + 1;
    this.bindingList.scroll = Math.max(0, Math.min(maxScroll, this.bindingList.scroll));
    const keyWidth = Math.max(4, surface.cols - KEY_COL - 2);
    label(surface, 2, 2, `${'Action'.padEnd(KEY_COL - ACTION_COL)}Key`, { fg: t.key, keys: false });
    const clashing = new Set<Binding>(KEY_CONTEXTS.flatMap((context) => keymap.conflicts(context)));
    for (let k = this.bindingList.scroll; k < Math.min(rows.length, this.bindingList.scroll + height); k += 1) {
      const entry = rows[k] as EditorRow;
      const row = 3 + k - this.bindingList.scroll;
      if ('heading' in entry) {
        label(surface, 2, row, entry.heading, { fg: t.key, width: surface.cols - 4, keys: false });
        continue;
      }
      const index = entry.index;
      const binding = keymap.bindings[index] as Binding;
      const selected = this.bindingList.selected === index;
      const bad = binding === this.conflictWith || clashing.has(binding);
      const fixed = keymap.fixed(index);
      const fg = bad ? t.bad : selected ? t.key : fixed ? t.dim : t.text;
      label(surface, 2, row, selected ? '▶' : ' ', { fg, keys: false });
      label(surface, ACTION_COL, row, actionText(binding), { fg, width: KEY_COL - ACTION_COL - 1, keys: false });
      // The key as it is now; a changed one says what it was, a fixed one says so.
      const was = keymap.defaultOf(index);
      const note = fixed ? '  fixed' : keymap.rebound(index) && was !== undefined ? `  (default ${this.keyText(was.spec)})` : '';
      label(surface, KEY_COL, row, `${this.keyText(binding.spec)}${note}`, { fg: bad ? t.bad : keymap.rebound(index) ? t.value : fg, width: keyWidth, keys: false });
      surface.hit({ col: 2, row, cols: surface.cols - 4, rows: 1 }, () => this.startCapture(index));
    }
    label(surface, 2, surface.rows - 2, this.capturing ? 'Press a key · [Esc] cancel' : '[Enter] rebind  [Del] default  [d] all defaults  [Esc] Back', { fg: t.dim, keys: false });
    if (this.conflict) label(surface, 2, surface.rows - 1, this.conflict, { fg: this.refused ? t.bad : t.value, width: surface.cols - 4, keys: false });
  }

  pointerDown(p: CellPointer): void { clickHit(this.last, p); }
}
