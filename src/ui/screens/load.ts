/**
 * The Load screen: `04-implementation/ui-screens/menus-and-world.md` § Load and
 * `02-systems/24-ui-and-input.md` § Screens outside the fortress ("**Load**: manual saves and
 * autosaves with thumbnails; `Load`, `Delete` (confirm), `Export`, `Import`"), grouped by kind as
 * `save-format.md` § Snapshots and ids says ("The Load screen groups by kind"). The list is read
 * from the save headers only; no body is inflated to draw it (`persistence.md` § Storage). A save
 * whose header cannot be read is listed as unreadable (`persistence.md` § Failure handling).
 */

import type { KeyPress } from '@platform/input';
import { formatDate } from '@core/calendar';
import { base64ToBytes } from '@core/serialize';
import { clickHit, type CellPointer, type Screen } from '../screen';
import type { Keymap } from '../keymap';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { button, label } from '../widgets';

/** What the screen shows of one save: its id and the fields of its header it draws. */
export interface SaveListing {
  readonly id: string;
  readonly kind: 'manual' | 'auto' | 'snapshot' | 'final';
  readonly fortress: string;
  readonly tick: number;
  readonly population: number;
  readonly wealth: number;
  readonly thumbnail?: { readonly cols: number; readonly rows: number; readonly cells: string };
  /** Set when the header could not be read; the save cannot be loaded. */
  readonly unreadable?: string;
}

export interface LoadHost {
  saves(): readonly SaveListing[];
  load(id: string): void;
  /** Delete after the `c_delete_save` confirmation (the host asks). */
  remove(id: string): void;
  exportSave(id: string): void;
  importSave(): void;
  back(): void;
}

/** `menus-and-world.md` § Load: the group order. */
const GROUPS: readonly { kind: SaveListing['kind']; key: string }[] = [
  { kind: 'manual', key: 'ui.load.manual' },
  { kind: 'auto', key: 'ui.load.auto' },
  { kind: 'snapshot', key: 'ui.load.snapshots' },
  { kind: 'final', key: 'ui.load.finished' },
];

/** Decode the thumbnail's base64 `glyph, fg, bg` cells (u16 glyph, i32 fg, i32 bg, little-endian). */
export function decodeThumbnail(cells: string): { glyph: number; fg: number; bg: number }[] {
  const bytes = base64ToBytes(cells);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: { glyph: number; fg: number; bg: number }[] = [];
  for (let at = 0; at + 10 <= bytes.length; at += 10) {
    out.push({ glyph: view.getUint16(at, true), fg: view.getInt32(at + 2, true), bg: view.getInt32(at + 6, true) });
  }
  return out;
}

export class LoadScreen implements Screen {
  readonly id = 'load' as const;
  selected: string | null = null;
  private last: Surface | null = null;

  constructor(
    private readonly host: LoadHost,
    private readonly keymap: Keymap,
    private readonly strings: Strings,
  ) {}

  /** The saves in drawing order: by group, newest first inside a group. */
  ordered(): SaveListing[] {
    const all = this.host.saves();
    const out: SaveListing[] = [];
    for (const g of GROUPS) {
      out.push(...all.filter((s) => s.kind === g.kind).sort((a, b) => b.tick - a.tick || (a.id < b.id ? 1 : -1)));
    }
    return out;
  }

  private current(): SaveListing | null {
    const list = this.ordered();
    const found = list.find((s) => s.id === this.selected) ?? list[0] ?? null;
    this.selected = found?.id ?? null;
    return found;
  }

  /** "Emberhall · Day 12 of Summer, Year 2 · 23 dwarves · 18,450 ☼". */
  line(s: SaveListing): string {
    if (s.unreadable !== undefined) return this.strings.get('ui.load.unreadable', { id: s.id, reason: s.unreadable });
    const date = s.kind === 'auto' ? formatDate(s.tick).replace(/^Day \d+ of /, '') : formatDate(s.tick);
    const auto = s.kind === 'auto' ? ` ${this.strings.get('ui.load.auto_mark')}` : '';
    return `${s.fortress} · ${date}${auto} · ${this.strings.get('ui.load.dwarves', { n: s.population })} · ${s.wealth.toLocaleString('en-US')} ☼`;
  }

  draw(surface: Surface): void {
    this.last = surface;
    const t = surface.theme;
    const current = this.current();
    let row = 1;
    label(surface, 2, row, this.strings.get('ui.load.title'), { fg: t.key });
    row += 1;
    for (const g of GROUPS) {
      const saves = this.ordered().filter((s) => s.kind === g.kind);
      if (saves.length === 0 && (g.kind === 'snapshot' || g.kind === 'final')) continue;
      surface.text(2, row, this.strings.get(g.key), t.dim);
      row += 1;
      if (saves.length === 0) {
        surface.text(4, row, this.strings.get('ui.load.none'), t.dim);
        row += 1;
      }
      for (const s of saves) {
        if (row >= surface.rows - 2) break;
        const selected = current !== null && s.id === current.id;
        if (selected) surface.text(2, row, '▶', t.key);
        const n = surface.text(4, row, this.line(s), s.unreadable === undefined ? t.text : t.dim);
        surface.hit({ col: 2, row, cols: n + 2, rows: 1 }, () => {
          this.selected = s.id;
        });
        row += 1;
        if (selected && s.thumbnail !== undefined && row + s.thumbnail.rows < surface.rows - 2) {
          const cells = decodeThumbnail(s.thumbnail.cells);
          for (let r = 0; r < s.thumbnail.rows; r += 1) {
            for (let c = 0; c < s.thumbnail.cols; c += 1) {
              const cell = cells[r * s.thumbnail.cols + c];
              if (cell !== undefined) surface.put(4 + c, row + r, cell.glyph, cell.fg, cell.bg);
            }
          }
          row += s.thumbnail.rows;
        }
      }
    }
    const r = surface.rows - 1;
    let c = 2;
    const readable = current !== null && current.unreadable === undefined;
    c += button(surface, c, r, 'Enter', this.strings.get('ui.load.load'), () => this.activate(), { enabled: readable }) + 2;
    c += button(surface, c, r, 'x', this.strings.get('ui.load.delete'), () => this.remove(), { enabled: current !== null }) + 2;
    c += button(surface, c, r, 'e', this.strings.get('ui.load.export'), () => this.exportSelected(), { enabled: readable }) + 2;
    c += button(surface, c, r, 'i', this.strings.get('ui.load.import'), () => this.host.importSave()) + 2;
    button(surface, c, r, 'Esc', this.strings.get('ui.load.back'), () => this.host.back());
  }

  activate(): void {
    const s = this.current();
    if (s !== null && s.unreadable === undefined) this.host.load(s.id);
  }

  remove(): void {
    const s = this.current();
    if (s !== null) this.host.remove(s.id);
  }

  exportSelected(): void {
    const s = this.current();
    if (s !== null && s.unreadable === undefined) this.host.exportSave(s.id);
  }

  move(delta: number): void {
    const list = this.ordered();
    if (list.length === 0) return;
    const at = Math.max(0, list.findIndex((s) => s.id === this.selected));
    this.selected = (list[(at + delta + list.length) % list.length] as SaveListing).id;
  }

  key(press: KeyPress): boolean {
    if (press.key === 'Esc') {
      this.host.back();
      return true;
    }
    const action = this.keymap.resolve('panel', press);
    if (action === null) return false;
    switch (action.id) {
      case 'select':
        this.move(action.arg === '↑' ? -1 : 1);
        return true;
      case 'activate':
        this.activate();
        return true;
      case 'accelerator':
        if (action.arg === 'x') this.remove();
        else if (action.arg === 'e') this.exportSelected();
        else if (action.arg === 'i') this.host.importSave();
        else return false;
        return true;
      default:
        return false;
    }
  }

  pointerDown(p: CellPointer): void {
    clickHit(this.last, p);
  }
}
