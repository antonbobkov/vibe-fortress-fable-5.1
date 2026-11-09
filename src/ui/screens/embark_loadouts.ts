/**
 * The embark screen's saved loadouts panel: `04-implementation/ui-screens/embark.md` § Saved
 * loadouts and `02-systems/02-embark-and-loadout.md` § Loadouts. It lists the saved loadouts with
 * what each costs at today's prices, and saves the current loadout under a name, loads, renames and
 * deletes one. The panel is modal over the embark screen: while it is open it takes every key.
 */

import type { KeyPress } from '@platform/input';
import { sameLoadoutName, type Loadout, type SavedLoadout } from '@systems/embark';
import { EMBARK_LOADOUT_NAME_MAX } from '../constants';
import type { Keymap } from '../keymap';
import { wrapText } from '../messages';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { button, clampList, label, type ListState } from '../widgets';
import type { TextInputSpec } from './text_input';

/** Where saved loadouts live: the app keeps them in the settings store (`persistence.md` § Storage). */
export interface LoadoutLibrary {
  /** Every saved loadout, sorted by name. */
  list(): readonly SavedLoadout[];
  /** Save under the loadout's name, replacing a loadout of the same name (without case). */
  put(loadout: SavedLoadout): void;
  rename(from: string, to: string): void;
  remove(name: string): void;
}

/** What the panel needs of the embark screen and the app. */
export interface LoadoutsPanelHost {
  readonly library: LoadoutLibrary;
  /** The screen's loadout now. */
  current(): Loadout;
  /** Load a saved loadout into the screen; the screen asks first when it was edited. */
  load(loadout: SavedLoadout): void;
  /** What a loadout costs at today's prices, and the site's budget. */
  total(loadout: Loadout): number;
  budget(): number;
  prompt?(spec: TextInputSpec, answer: (text: string | null) => void): void;
  confirm?(id: string, params: Readonly<Record<string, string | number>>, answer: (yes: boolean) => void): void;
}

export class LoadoutsPanel {
  open = false;
  readonly list: ListState = { selected: 0, scroll: 0 };
  /** What the last action did ("Saved Deep start."), or what a load left out. */
  note: string | null = null;

  constructor(
    private readonly host: LoadoutsPanelHost,
    private readonly keymap: Keymap,
    private readonly strings: Strings,
  ) {}

  toggle(): void {
    this.open = !this.open;
    this.note = null;
  }

  close(): void {
    this.open = false;
    this.note = null;
  }

  selected(): SavedLoadout | null {
    return this.host.library.list()[this.list.selected] ?? null;
  }

  private select(name: string): void {
    const at = this.host.library.list().findIndex((l) => sameLoadoutName(l.name, name));
    if (at >= 0) this.list.selected = at;
  }

  /** "Loadout 3": the first such name not taken. */
  defaultName(): string {
    const taken = this.host.library.list();
    for (let n = 1; ; n += 1) {
      const name = this.strings.get('ui.embark.loadouts.default_name', { n });
      if (!taken.some((l) => sameLoadoutName(l.name, name))) return name;
    }
  }

  /** `s`: save the current loadout under a name; a taken name asks before it is replaced. */
  save(): void {
    const write = (name: string): void => {
      this.host.library.put({ name, ...this.host.current() });
      this.select(name);
      this.note = this.strings.get('ui.embark.loadouts.saved', { loadout: name });
    };
    const named = (name: string | null): void => {
      if (name === null) return;
      const existing = this.host.library.list().find((l) => sameLoadoutName(l.name, name));
      if (existing === undefined || this.host.confirm === undefined) {
        write(name);
        return;
      }
      this.host.confirm('c_overwrite_loadout', { loadout: existing.name }, (yes) => {
        if (yes) write(name);
      });
    };
    const spec = { title: this.strings.get('ui.embark.loadouts.save_title'), value: this.defaultName(), maxLength: EMBARK_LOADOUT_NAME_MAX };
    if (this.host.prompt === undefined) named(spec.value);
    else this.host.prompt(spec, named);
  }

  /** `Enter`: load the selected loadout. */
  load(): void {
    const loadout = this.selected();
    if (loadout !== null) this.host.load(loadout);
  }

  /** `n`: rename the selected loadout; a name another loadout has is refused. */
  rename(): void {
    const loadout = this.selected();
    if (loadout === null) return;
    const named = (name: string | null): void => {
      if (name === null || name === loadout.name) return;
      if (this.host.library.list().some((l) => l !== loadout && sameLoadoutName(l.name, name))) {
        this.note = this.strings.get('ui.embark.loadouts.taken', { loadout: name });
        return;
      }
      this.host.library.rename(loadout.name, name);
      this.select(name);
      this.note = this.strings.get('ui.embark.loadouts.renamed', { loadout: name });
    };
    if (this.host.prompt === undefined) return;
    this.host.prompt({ title: this.strings.get('ui.embark.loadouts.rename_title', { loadout: loadout.name }), value: loadout.name, maxLength: EMBARK_LOADOUT_NAME_MAX }, named);
  }

  /** `x`: delete the selected loadout, after the `c_delete_loadout` confirmation. */
  remove(): void {
    const loadout = this.selected();
    if (loadout === null) return;
    const drop = (): void => {
      this.host.library.remove(loadout.name);
      this.note = this.strings.get('ui.embark.loadouts.deleted', { loadout: loadout.name });
    };
    if (this.host.confirm === undefined) drop();
    else this.host.confirm('c_delete_loadout', { loadout: loadout.name }, (yes) => {
      if (yes) drop();
    });
  }

  /** Every key while open: the list keys of § Panels, `Esc` closes. */
  key(press: KeyPress): boolean {
    if (press.key === 'Esc') {
      this.close();
      return true;
    }
    const action = this.keymap.resolve('panel', press);
    if (action?.id === 'select') {
      const count = this.host.library.list().length;
      if (count > 0) this.list.selected = (this.list.selected + (action.arg === '↑' ? -1 : 1) + count) % count;
    } else if (action?.id === 'activate') this.load();
    else if (action?.id === 'accelerator') {
      if (action.arg === 's') this.save();
      else if (action.arg === 'n') this.rename();
      else if (action.arg === 'x') this.remove();
    }
    return true;
  }

  /** The panel over the screen's body, between its header (row 1) and the footer (`bottom`). */
  draw(surface: Surface, bottom: number): void {
    const s = this.strings;
    const t = surface.theme;
    const loadouts = this.host.library.list();
    const col = 2;
    const width = Math.max(20, surface.cols - 4);
    const inner = width - 4;
    const notes = this.note === null ? [] : wrapText(this.note, inner, 3);
    const listHeight = Math.max(1, Math.min(Math.max(1, loadouts.length), bottom - 2 - 6 - notes.length));
    const height = listHeight + 4 + notes.length;
    const top = Math.max(2, bottom - height);
    surface.fill({ col, row: top, cols: width, rows: height }, t.panelBg);
    label(surface, col + 2, top, s.get('ui.embark.loadouts.title'), { fg: t.key, bg: t.panelBg });
    clampList(this.list, loadouts.length, listHeight);
    if (loadouts.length === 0) label(surface, col + 2, top + 1, s.get('ui.embark.loadouts.none'), { fg: t.dim, bg: t.panelBg, width: inner });
    const budget = this.host.budget();
    for (let r = 0; r < listHeight; r += 1) {
      const index = this.list.scroll + r;
      const loadout = loadouts[index];
      if (loadout === undefined) break;
      const row = top + 1 + r;
      const selected = index === this.list.selected;
      label(surface, col + 2, row, `${selected ? '▶ ' : '  '}${loadout.name}`, { bg: t.panelBg, width: EMBARK_LOADOUT_NAME_MAX + 2, keys: false });
      const total = this.host.total(loadout);
      const cost = `${String(total).replace(/\B(?=(\d{3})+(?!\d))/g, ',').padStart(6)} ☼`;
      label(surface, col + EMBARK_LOADOUT_NAME_MAX + 5, row, cost, { fg: t.value, bg: t.panelBg });
      if (total > budget) label(surface, col + EMBARK_LOADOUT_NAME_MAX + 15, row, s.get('ui.embark.loadouts.row_over'), { fg: t.bad, bg: t.panelBg, width: Math.max(1, width - EMBARK_LOADOUT_NAME_MAX - 17) });
      surface.hit({ col: col + 2, row, cols: inner, rows: 1 }, () => {
        if (this.list.selected === index) this.load();
        else this.list.selected = index;
      });
    }
    notes.forEach((line, k) => label(surface, col + 2, top + 2 + listHeight + k, line, { fg: t.text, bg: t.panelBg, width: inner, keys: false }));
    const any = loadouts.length > 0;
    const row = top + height - 2;
    let c = col + 2;
    c += button(surface, c, row, 's', s.get('ui.embark.loadouts.save'), () => this.save()) + 2;
    c += button(surface, c, row, 'Enter', s.get('ui.embark.loadouts.load'), () => this.load(), { enabled: any }) + 2;
    c += button(surface, c, row, 'n', s.get('ui.embark.loadouts.rename'), () => this.rename(), { enabled: any && this.host.prompt !== undefined }) + 2;
    c += button(surface, c, row, 'x', s.get('ui.embark.loadouts.delete'), () => this.remove(), { enabled: any }) + 2;
    button(surface, c, row, 'Esc', s.get('ui.embark.loadouts.close'), () => this.close());
  }
}
