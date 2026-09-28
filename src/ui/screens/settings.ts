/** Player preferences and keybinding editor (T-M7-07, menus-and-world.md § Settings). */
import type { KeyPress } from '@platform/input';
import { keyLabel, type Binding, type Keymap, type KeySpec } from '../keymap';
import { clickHit, type CellPointer, type Screen } from '../screen';
import type { UserSettings } from '../settings';
import type { Surface } from '../surface';
import { clampList, label, type ListState } from '../widgets';
import { SETTINGS_COMBAT_LOG_OPTIONS, SETTINGS_SNAPSHOT_OPTIONS, SETTINGS_ZOOM_OPTIONS } from '../constants';

export interface SettingsHost {
  readonly keymap: Keymap;
  settings(): Readonly<UserSettings>;
  change(patch: Partial<UserSettings>): void;
  bindingsChanged(): void;
  resetDefaults(): void;
  back(): void;
}

const SETTING_NAMES = [
  'Auto-pause on danger', 'Auto-pause on alert', 'Hints', 'Colorblind palette', 'Zoom',
  'Edge scrolling', 'Autosave each season', 'Snapshots kept', 'Combat log', 'Keybindings ▸',
] as const;

export class SettingsScreen implements Screen {
  readonly id = 'settings' as const;
  selected = 0;
  keybindings = false;
  readonly bindingList: ListState = { selected: 0, scroll: 0 };
  capturing = false;
  conflict: string | null = null;
  private last: Surface | null = null;

  constructor(private readonly host: SettingsHost) {}

  private value(index: number): string {
    const settings = this.host.settings();
    switch (index) {
      case 0: return settings.autoPauseDanger ? 'on' : 'off';
      case 1: return settings.autoPauseAlert ? 'on' : 'off';
      case 2: return settings.hints ? 'on' : 'off';
      case 3: return settings.colorblind ? 'on' : 'off';
      case 4: return `${settings.zoom}×`;
      case 5: return settings.edgeScrolling ? 'on' : 'off';
      case 6: return settings.autosave ? 'on' : 'off';
      case 7: return String(settings.snapshotsKept);
      case 8: return settings.combatLog;
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
      case 4: this.host.change({ zoom: cycle(SETTINGS_ZOOM_OPTIONS, current.zoom as typeof SETTINGS_ZOOM_OPTIONS[number]) }); break;
      case 5: this.host.change({ edgeScrolling: !current.edgeScrolling }); break;
      case 6: this.host.change({ autosave: !current.autosave }); break;
      case 7: this.host.change({ snapshotsKept: cycle(SETTINGS_SNAPSHOT_OPTIONS, current.snapshotsKept) }); break;
      case 8: this.host.change({ combatLog: cycle(SETTINGS_COMBAT_LOG_OPTIONS, current.combatLog) }); break;
      case 9: this.keybindings = true; this.bindingList.selected = 0; this.bindingList.scroll = 0; break;
      default: break;
    }
  }

  private capture(press: KeyPress): void {
    if (press.alt || press.meta) { this.conflict = 'Use a key with optional Ctrl or Shift.'; return; }
    const spec: KeySpec = { key: press.key, ctrl: press.ctrl, shift: press.shift };
    const conflict = this.host.keymap.rebind(this.bindingList.selected, spec);
    if (conflict) { this.conflict = `Conflicts with ${conflict.context}: ${conflict.id}`; return; }
    this.capturing = false;
    this.conflict = null;
    this.host.bindingsChanged();
  }

  key(press: KeyPress): boolean {
    const k = press.key;
    if (k === 'Esc' || k === 'Escape') {
      if (this.capturing) { this.capturing = false; this.conflict = null; }
      else if (this.keybindings) this.keybindings = false;
      else this.host.back();
      return true;
    }
    if (this.capturing) { this.capture(press); return true; }
    if (k === 'ArrowUp' || k === '↑') {
      if (this.keybindings) this.bindingList.selected = Math.max(0, this.bindingList.selected - 1);
      else this.selected = Math.max(0, this.selected - 1);
      return true;
    }
    if (k === 'ArrowDown' || k === '↓') {
      if (this.keybindings) this.bindingList.selected = Math.min(this.host.keymap.bindings.length - 1, this.bindingList.selected + 1);
      else this.selected = Math.min(SETTING_NAMES.length - 1, this.selected + 1);
      return true;
    }
    if (this.keybindings) {
      if (k === 'Enter') { this.capturing = true; this.conflict = null; return true; }
      if (k === 'PageUp' || k === 'PageDown') { this.bindingList.selected = Math.max(0, Math.min(this.host.keymap.bindings.length - 1, this.bindingList.selected + (k === 'PageUp' ? -10 : 10))); return true; }
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
        if (index < 9) label(surface, 32, row, `[${this.value(index)}]`, { fg: t.value, width: 18 });
        surface.hit({ col: 2, row, cols: 48, rows: 1 }, () => { this.selected = index; this.change(index); });
      }
      label(surface, 2, 15, '[d] Reset to defaults    [Esc] Back', { fg: t.dim });
      surface.hit({ col: 2, row: 15, cols: 21, rows: 1 }, () => this.host.resetDefaults());
      surface.hit({ col: 28, row: 15, cols: 10, rows: 1 }, () => this.host.back());
      return;
    }
    const rows = this.host.keymap.bindings;
    const height = Math.max(1, surface.rows - 6);
    clampList(this.bindingList, rows.length, height);
    label(surface, 2, 2, 'Context         Action                    Key', { fg: t.key });
    for (let index = this.bindingList.scroll; index < Math.min(rows.length, this.bindingList.scroll + height); index += 1) {
      const binding = rows[index] as Binding;
      const row = 3 + index - this.bindingList.scroll;
      const prefix = this.bindingList.selected === index ? '▶' : ' ';
      label(surface, 2, row, `${prefix} ${binding.context.padEnd(14)} ${binding.id.padEnd(25)} ${keyLabel(binding.spec)}`, { fg: this.bindingList.selected === index ? t.key : t.text, width: surface.cols - 4 });
      surface.hit({ col: 2, row, cols: surface.cols - 4, rows: 1 }, () => { this.bindingList.selected = index; this.capturing = true; this.conflict = null; });
    }
    label(surface, 2, surface.rows - 2, this.capturing ? 'Press a key · [Esc] cancel' : '[Enter] rebind  [Esc] Back', { fg: t.dim });
    if (this.conflict) label(surface, 2, surface.rows - 1, this.conflict, { fg: t.bad });
  }

  pointerDown(p: CellPointer): void { clickHit(this.last, p); }
}
