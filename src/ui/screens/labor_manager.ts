/**
 * The labor manager: `ui-screens/panels.md` § Labor manager and `11` § Player-facing behavior
 * ("Labor grid: rows are dwarves, columns are labors; click to toggle; shift-click toggles a
 * column for everyone; a number row above sets labor priorities"). A full-window screen over the
 * fortress, like the trade session (UI audit M5, § 3 "Set many dwarves' labors").
 *
 * - Every dwarf is a row and the rows scroll; every labor is a column under its name written
 *   downward, and the line under the title names the dwarf and the labor at the cursor or under
 *   the mouse in full.
 * - `Space` marks a row, `Shift`-click a range, `*` all. An action on a marked row applies to
 *   every marked dwarf; a template applies to the marked dwarves, or to the cursor's when none is.
 * - The priority row sends `SetLaborPriority`; the cells and the templates send `SetLabor`.
 *
 * Commands apply at the next command phase, so the screen shows what it asked for until the
 * simulation answers: a pending value is dropped as soon as the reader agrees with it or a tick
 * has passed. Children take no labors (`SetLabor` → `child_labor`): their rows are dim and
 * skipped, and the status line says so.
 */

import type { Command } from '@core/commands';
import { PRIORITY_MAX, PRIORITY_MIN } from '@core/constants';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId } from '@core/types';
import type { KeyPress } from '@platform/input';
import type { DwarvesReader } from '@systems/dwarves';
import type { JobsReader } from '@systems/jobs';
import {
  LABOR_CELL_COLS_MAX,
  LABOR_CELL_COLS_MIN,
  LABOR_HEADER_ROWS,
  LABOR_NAME_COLS_MAX,
  LABOR_NAME_COLS_MIN,
  LABOR_TEMPLATES,
} from '../constants';
import type { PanelContext } from '../panels/context';
import { nameOf, professionOf } from '../panels/units';
import { clickHit, type CellPointer, type CellWheel, type Screen } from '../screen';
import { Strings } from '../strings';
import type { Surface } from '../surface';
import { button, clampList, drawTooltip, label, Marks, separator } from '../widgets';

export interface LaborManagerHost {
  readonly readers: ReaderSet;
  readonly registry: Registry;
  /** The strings table; the defaults when absent. */
  readonly strings?: Strings;
  submit(command: Command): void;
  back(): void;
}

export interface LaborManagerOpen {
  /** The dwarves marked when the screen opens (the units panel's selection). */
  readonly marked?: readonly EntityId[];
  /** The dwarf the cursor starts on. */
  readonly focus?: EntityId | undefined;
}

interface LaborRow {
  readonly id: string;
  readonly name: string;
}

interface Grid {
  readonly nameCols: number;
  readonly cellCols: number;
  /** Labor columns that fit. */
  readonly fit: number;
  /** The first cell column of the grid. */
  readonly gridCol: number;
  readonly headerRow: number;
  readonly priorityRow: number;
  readonly dataRow: number;
  /** Dwarf rows that fit. */
  readonly height: number;
}

/** Rows above the grid (title, info) and below it (rule, two key rows, status). */
const TOP_ROWS = 2;
const BOTTOM_ROWS = 4;

export class LaborManagerScreen implements Screen {
  readonly id = 'labor_manager' as const;
  readonly marks = new Marks();
  cursorRow = 0;
  cursorCol = 0;
  firstRow = 0;
  firstCol = 0;
  /** The template menu's selection while it is open. */
  templateMenu: number | null = null;
  /** The status line: what the last action did, or why it did nothing. */
  notice: string | null = null;
  private readonly pending = new Map<string, { on: boolean; tick: number }>();
  private readonly pendingPriority = new Map<string, { value: number; tick: number }>();
  private pointer: { col: number; row: number } | null = null;
  private clickShift = false;
  private last: Surface | null = null;
  private lastGrid: Grid | null = null;
  private readonly strings: Strings;

  constructor(private readonly host: LaborManagerHost, open: LaborManagerOpen = {}) {
    this.strings = host.strings ?? new Strings(host.registry);
    const dwarves = this.dwarves();
    for (const id of open.marked ?? []) if (dwarves.includes(id)) this.marks.ids.add(id);
    const focus = open.focus ?? this.marks.list(dwarves)[0];
    const at = focus === undefined ? -1 : dwarves.indexOf(focus);
    if (at >= 0) this.cursorRow = at;
  }

  // ---------- what it shows ----------

  dwarves(): EntityId[] {
    return this.host.readers.has('10') ? this.host.readers.of<DwarvesReader>('10').list() : [];
  }

  labors(): LaborRow[] {
    const table = this.host.registry.table<LaborRow>('labors');
    return table.ids().map((id) => table.byId(id) as LaborRow);
  }

  isChild(dwarf: EntityId): boolean {
    return this.host.readers.has('10') && this.host.readers.of<DwarvesReader>('10').isChild(dwarf);
  }

  private jobs(): JobsReader | null {
    return this.host.readers.has('11') ? this.host.readers.of<JobsReader>('11') : null;
  }

  /** The cell as the player last set it, or as the simulation has it. */
  enabled(dwarf: EntityId, labor: string): boolean {
    const asked = this.pending.get(`${dwarf}:${labor}`);
    if (asked !== undefined) return asked.on;
    return this.jobs()?.laborEnabled(dwarf, labor) ?? false;
  }

  priority(labor: string): number {
    return this.pendingPriority.get(labor)?.value ?? this.jobs()?.laborPriority(labor) ?? PRIORITY_MIN;
  }

  cursorDwarf(): EntityId | undefined {
    return this.dwarves()[this.cursorRow];
  }

  cursorLabor(): LaborRow | undefined {
    return this.labors()[this.cursorCol];
  }

  /** Forget what was asked once the simulation agrees, or a tick has passed (a refusal). */
  private settle(): void {
    const tick = this.host.readers.calendar.tick;
    const jobs = this.jobs();
    for (const [key, asked] of Array.from(this.pending)) {
      const [dwarf, labor] = key.split(':') as [string, string];
      if (tick > asked.tick || jobs?.laborEnabled(Number(dwarf), labor) === asked.on) this.pending.delete(key);
    }
    for (const [labor, asked] of Array.from(this.pendingPriority)) {
      if (tick > asked.tick || jobs?.laborPriority(labor) === asked.value) this.pendingPriority.delete(labor);
    }
  }

  // ---------- actions ----------

  /** The dwarves an action on `row` reaches: the marked ones when it is marked, else it alone. */
  targets(row: EntityId | undefined): EntityId[] {
    return this.marks.targets(this.dwarves(), row);
  }

  /** The marked dwarves, or the cursor's when none is marked: what a template applies to. */
  selection(): EntityId[] {
    const dwarves = this.dwarves();
    if (this.marks.size > 0) return this.marks.list(dwarves);
    const at = dwarves[this.cursorRow];
    return at === undefined ? [] : [at];
  }

  /**
   * Send the `SetLabor` commands that bring `targets` to `want(labor)`; only the cells that
   * differ. Children are skipped. Returns the commands sent.
   */
  private apply(targets: readonly EntityId[], labors: readonly string[], want: (labor: string) => boolean): Command[] {
    const tick = this.host.readers.calendar.tick;
    const sent: Command[] = [];
    let children = 0;
    let adults = 0;
    for (const dwarf of targets) {
      if (this.isChild(dwarf)) {
        children += 1;
        continue;
      }
      adults += 1;
      for (const labor of labors) {
        const on = want(labor);
        if (this.enabled(dwarf, labor) === on) continue;
        const command: Command = { type: 'SetLabor', dwarfId: dwarf, labor, on };
        this.pending.set(`${dwarf}:${labor}`, { on, tick });
        this.host.submit(command);
        sent.push(command);
      }
    }
    const s = this.strings;
    if (targets.length === 0) this.notice = s.get('ui.labor_manager.no_dwarves');
    else if (adults === 0) this.notice = s.get('ui.labor_manager.children_only');
    else if (children > 0) this.notice = s.get('ui.labor_manager.changed_skipped', { n: sent.length, dwarves: adults, skipped: children });
    else if (sent.length === 0) this.notice = s.get('ui.labor_manager.unchanged');
    else this.notice = s.get('ui.labor_manager.changed', { n: sent.length, dwarves: adults });
    return sent;
  }

  /** `Enter` or a click: the cell of `dwarf`, and the same value for every marked dwarf when it is marked. */
  toggleCell(dwarf: EntityId, labor: string): Command[] {
    const on = !this.enabled(dwarf, labor);
    return this.apply(this.targets(dwarf), [labor], () => on);
  }

  /** `[c]` or a shift-click on a head: the column for the marked dwarves, or for everyone. */
  toggleColumn(labor: string): Command[] {
    const dwarves = this.dwarves();
    const targets = this.marks.size > 0 ? this.marks.list(dwarves) : dwarves;
    const adults = targets.filter((d) => !this.isChild(d));
    const on = !adults.every((d) => this.enabled(d, labor));
    return this.apply(targets, [labor], () => on);
  }

  /** `[a]`: every labor of the cursor's dwarf (and of the marked ones when it is marked). */
  toggleRow(): Command[] {
    const dwarf = this.cursorDwarf();
    if (dwarf === undefined) return this.apply([], [], () => false);
    const labors = this.labors().map((l) => l.id);
    const on = !labors.every((l) => this.enabled(dwarf, l));
    return this.apply(this.targets(dwarf), labors, () => on);
  }

  /** A profession template: exactly its labors on, for the selection. */
  applyTemplate(id: string): Command[] {
    const template = LABOR_TEMPLATES.find((t) => t.id === id);
    if (template === undefined) return [];
    const sent = this.apply(this.selection(), this.labors().map((l) => l.id), (labor) => template.labors.includes(labor));
    // The outcome names the template ("Miner: 12 changes for 5 dwarves").
    if (this.notice !== null) this.notice = `${this.strings.get(`ui.labor_manager.template.${id}`)}: ${this.notice}`;
    return sent;
  }

  /** The priority row: `SetLaborPriority` within 1–9, or the reason it stays. */
  setPriority(labor: string, value: number): Command | null {
    const s = this.strings;
    const name = this.labors().find((l) => l.id === labor)?.name ?? labor;
    if (value < PRIORITY_MIN || value > PRIORITY_MAX) {
      this.notice = s.get('ui.labor_manager.priority_range', { labor: name, min: PRIORITY_MIN, max: PRIORITY_MAX });
      return null;
    }
    if (value === this.priority(labor)) return null;
    const command: Command = { type: 'SetLaborPriority', labor, priority: value };
    this.pendingPriority.set(labor, { value, tick: this.host.readers.calendar.tick });
    this.host.submit(command);
    this.notice = s.get('ui.labor_manager.priority_set', { labor: name, priority: value });
    return command;
  }

  changePriority(labor: string, delta: number): Command | null {
    return this.setPriority(labor, this.priority(labor) + delta);
  }

  move(dRow: number, dCol: number): void {
    const rows = this.dwarves().length;
    const cols = this.labors().length;
    this.cursorRow = Math.max(0, Math.min(Math.max(0, rows - 1), this.cursorRow + dRow));
    this.cursorCol = Math.max(0, Math.min(Math.max(0, cols - 1), this.cursorCol + dCol));
  }

  // ---------- layout ----------

  grid(cols: number, rows: number): Grid {
    const count = Math.max(1, this.labors().length);
    // One column for the mark, the name, one for the scrollbar.
    const room = cols - 2;
    // The name column gets its full width before the labor columns widen.
    let cellCols = Math.floor((room - LABOR_NAME_COLS_MAX) / count);
    cellCols = Math.max(LABOR_CELL_COLS_MIN, Math.min(LABOR_CELL_COLS_MAX, cellCols));
    const fit = Math.max(1, Math.min(count, Math.floor((room - LABOR_NAME_COLS_MIN) / cellCols)));
    const nameCols = Math.max(LABOR_NAME_COLS_MIN, Math.min(LABOR_NAME_COLS_MAX, room - fit * cellCols));
    const headerRow = TOP_ROWS;
    const priorityRow = headerRow + LABOR_HEADER_ROWS;
    const dataRow = priorityRow + 1;
    return { nameCols, cellCols, fit, gridCol: 1 + nameCols, headerRow, priorityRow, dataRow, height: Math.max(1, rows - dataRow - BOTTOM_ROWS) };
  }

  /** Keep the cursor inside the rows and columns shown. */
  private clamp(g: Grid): void {
    const rows = { selected: this.cursorRow, scroll: this.firstRow };
    clampList(rows, this.dwarves().length, g.height);
    this.cursorRow = rows.selected;
    this.firstRow = rows.scroll;
    const cols = { selected: this.cursorCol, scroll: this.firstCol };
    clampList(cols, this.labors().length, g.fit);
    this.cursorCol = cols.selected;
    this.firstCol = cols.scroll;
  }

  /** The dwarf row and labor column under a screen cell, or -1 outside the grid. */
  private cellUnder(g: Grid, col: number, row: number): { row: number; col: number } {
    const r = row >= g.dataRow && row < g.dataRow + g.height ? this.firstRow + row - g.dataRow : -1;
    const k = col >= g.gridCol ? Math.floor((col - g.gridCol) / g.cellCols) : -1;
    return { row: r >= 0 && r < this.dwarves().length ? r : -1, col: k >= 0 && k < g.fit && this.firstCol + k < this.labors().length ? this.firstCol + k : -1 };
  }

  private get ctx(): PanelContext {
    return {
      readers: this.host.readers,
      registry: this.host.registry,
      strings: this.strings,
      submit: (c) => this.host.submit(c),
      focusOn: () => {},
      look: () => {},
      openPanel: () => {},
      shiftClick: () => this.clickShift,
    };
  }

  // ---------- drawing ----------

  draw(s: Surface): void {
    this.last = s;
    this.settle();
    const t = s.theme;
    const strings = this.strings;
    const dwarves = this.dwarves();
    const labors = this.labors();
    this.marks.prune(dwarves);
    const g = this.grid(s.cols, s.rows);
    this.lastGrid = g;
    this.clamp(g);
    const ctx = this.ctx;

    // Title and close.
    label(s, 1, 0, strings.get('ui.labor_manager.title'), { fg: t.key, keys: false });
    const close = `[Esc] ${strings.get('ui.labor_manager.close')}`;
    button(s, Math.max(1, s.cols - close.length - 1), 0, 'Esc', strings.get('ui.labor_manager.close'), () => this.host.back());

    // The dwarf and the labor at the cursor, or under the mouse, in full.
    const under = this.pointer === null ? { row: -1, col: -1 } : this.cellUnder(g, this.pointer.col, this.pointer.row);
    const infoDwarf = dwarves[under.row >= 0 ? under.row : this.cursorRow];
    const infoLabor = labors[under.col >= 0 ? under.col : this.cursorCol];
    if (infoDwarf !== undefined && infoLabor !== undefined) {
      const child = this.isChild(infoDwarf);
      const info = strings.get(child ? 'ui.labor_manager.info_child' : 'ui.labor_manager.info', {
        dwarf: nameOf(ctx, infoDwarf),
        profession: professionOf(ctx, infoDwarf),
        labor: infoLabor.name,
        state: strings.get(this.enabled(infoDwarf, infoLabor.id) ? 'ui.labor_manager.on' : 'ui.labor_manager.off'),
        priority: this.priority(infoLabor.id),
      });
      label(s, 1, 1, info, { fg: t.value, width: s.cols - 2, keys: false });
    } else if (dwarves.length === 0) {
      label(s, 1, 1, strings.get('ui.labor_manager.no_dwarves'), { fg: t.dim, width: s.cols - 2 });
    }

    // The left of the head: how many are marked, and the column titles.
    label(s, 1, g.headerRow, strings.get('ui.labor_manager.marked', { n: this.marks.size, total: dwarves.length }), { fg: this.marks.size > 0 ? t.value : t.dim, width: g.nameCols - 1, keys: false });
    label(s, 3, g.headerRow + LABOR_HEADER_ROWS - 1, strings.get('ui.labor_manager.dwarf'), { fg: t.key, width: g.nameCols - 3, keys: false });
    label(s, 3, g.priorityRow, strings.get('ui.labor_manager.priority'), { fg: t.key, width: g.nameCols - 3, keys: false });
    if (this.firstCol > 0) label(s, g.gridCol - 1, g.headerRow, '«', { fg: t.dim, keys: false });
    if (this.firstCol + g.fit < labors.length) label(s, g.gridCol + g.fit * g.cellCols - 1, g.headerRow, '»', { fg: t.dim, keys: false });

    // The labor names written downward, and the priority row under them.
    for (let k = 0; k < g.fit && this.firstCol + k < labors.length; k += 1) {
      const index = this.firstCol + k;
      const labor = labors[index] as LaborRow;
      const col = g.gridCol + k * g.cellCols;
      const chars = Array.from(labor.name);
      const here = index === this.cursorCol;
      for (let r = 0; r < LABOR_HEADER_ROWS; r += 1) {
        const ch = chars[r];
        if (ch !== undefined) s.put(col, g.headerRow + r, s.glyphs.index(ch), here ? t.value : t.text, t.black);
      }
      const head = { col, row: g.headerRow, cols: g.cellCols, rows: LABOR_HEADER_ROWS };
      s.tooltip(head, labor.name);
      s.hit(head, () => {
        this.cursorCol = index;
        if (this.clickShift) this.toggleColumn(labor.id);
      });
      const cell = { col, row: g.priorityRow, cols: 1, rows: 1 };
      s.put(col, g.priorityRow, s.glyphs.index(String(this.priority(labor.id))), t.value, t.black);
      if (here) s.invert(cell);
      s.tooltip({ ...cell, cols: g.cellCols }, strings.get('ui.labor_manager.priority_tip', { labor: labor.name, priority: this.priority(labor.id) }));
      s.hit({ ...cell, cols: g.cellCols }, () => {
        this.cursorCol = index;
        this.changePriority(labor.id, this.clickShift ? -1 : 1);
      });
    }

    // The dwarves.
    const on = s.glyphs.index('■');
    const off = s.glyphs.index('∙');
    const mark = s.glyphs.index('•');
    for (let r = 0; r < g.height && this.firstRow + r < dwarves.length; r += 1) {
      const index = this.firstRow + r;
      const dwarf = dwarves[index] as EntityId;
      const row = g.dataRow + r;
      const child = this.isChild(dwarf);
      const marked = this.marks.has(dwarf);
      if (marked) s.put(1, row, mark, t.value, t.black);
      s.hit({ col: 0, row, cols: 3, rows: 1 }, () => {
        this.cursorRow = index;
        this.marks.toggle(dwarf);
      });
      const name = { col: 3, row, cols: g.nameCols - 3, rows: 1 };
      label(s, name.col, row, nameOf(ctx, dwarf), { fg: child ? t.dim : marked ? t.value : t.text, width: name.cols, keys: false });
      if (index === this.cursorRow) s.invert(name);
      s.hit(name, () => {
        this.cursorRow = index;
        if (this.clickShift) this.marks.range(dwarves, dwarf);
        else this.marks.anchor = dwarf;
      });
      for (let k = 0; k < g.fit && this.firstCol + k < labors.length; k += 1) {
        const column = this.firstCol + k;
        const labor = labors[column] as LaborRow;
        const col = g.gridCol + k * g.cellCols;
        const enabled = this.enabled(dwarf, labor.id);
        s.put(col, row, enabled ? on : off, child || !enabled ? t.dim : t.value, t.black);
        if (index === this.cursorRow && column === this.cursorCol) s.invert({ col, row, cols: 1, rows: 1 });
        s.hit({ col, row, cols: g.cellCols, rows: 1 }, () => {
          this.cursorRow = index;
          this.cursorCol = column;
          this.toggleCell(dwarf, labor.id);
        });
      }
    }
    if (dwarves.length > g.height) {
      const track = s.glyphs.index('│');
      const thumb = s.glyphs.index('█');
      const at = Math.floor((this.firstRow * (g.height - 1)) / Math.max(1, dwarves.length - g.height));
      for (let r = 0; r < g.height; r += 1) s.put(s.cols - 1, g.dataRow + r, r === at ? thumb : track, t.border, t.black);
    }

    // The keys, each a button, and the status line.
    const foot = s.rows - BOTTOM_ROWS;
    separator(s, 1, foot, s.cols - 2);
    const dwarf = this.cursorDwarf();
    const labor = this.cursorLabor();
    const row1: [string, string, () => void][] = [
      ['Space', 'mark', () => { if (dwarf !== undefined) this.marks.toggle(dwarf); }],
      ['*', 'all', () => this.marks.all(dwarves)],
      ['Enter', 'toggle', () => { if (dwarf !== undefined && labor !== undefined) this.toggleCell(dwarf, labor.id); }],
      ['a', 'row', () => { this.toggleRow(); }],
      ['c', 'column', () => { if (labor !== undefined) this.toggleColumn(labor.id); }],
    ];
    const row2: [string, string, () => void][] = [
      ['-', 'priority_down', () => { if (labor !== undefined) this.changePriority(labor.id, -1); }],
      ['+', 'priority_up', () => { if (labor !== undefined) this.changePriority(labor.id, 1); }],
      ['t', 'templates', () => { this.templateMenu = 0; }],
    ];
    [row1, row2].forEach((buttons, k) => {
      let col = 1;
      for (const [key, id, action] of buttons) {
        if (col >= s.cols - 4) break;
        col += button(s, col, foot + 1 + k, key, strings.get(`ui.labor_manager.key.${id}`), action) + 2;
      }
    });
    if (this.notice !== null) label(s, 1, foot + 3, this.notice, { fg: t.alert, width: s.cols - 2, keys: false });

    if (this.templateMenu !== null) this.drawTemplates(s);
    else drawTooltip(s, this.pointer);
  }

  private drawTemplates(s: Surface): void {
    const t = s.theme;
    const strings = this.strings;
    const selection = this.selection();
    const title = strings.get('ui.labor_manager.templates_title', { n: selection.length });
    const lines = LABOR_TEMPLATES.map((template, k) => `[${k + 1}] ${strings.get(`ui.labor_manager.template.${template.id}`)}`);
    const width = Math.min(s.cols - 2, Math.max(Array.from(title).length + 4, 56));
    // What the highlighted template turns on, wrapped over two rows.
    const detail = this.templateText(LABOR_TEMPLATES[this.templateMenu ?? 0]?.labors ?? []);
    const wrapped: string[] = [''];
    for (const word of detail.split(' ')) {
      const line = wrapped[wrapped.length - 1] as string;
      if (line.length > 0 && line.length + 1 + word.length > width - 4) wrapped.push(word);
      else wrapped[wrapped.length - 1] = line.length === 0 ? word : `${line} ${word}`;
    }
    const rows = lines.length + 7;
    const col = Math.max(0, Math.floor((s.cols - width) / 2));
    const row = Math.max(0, Math.floor((s.rows - rows) / 2));
    s.fill({ col, row, cols: width, rows }, t.panelBg);
    // The dialog covers the grid's click regions.
    s.hit({ col, row, cols: width, rows }, () => {});
    label(s, col + 2, row + 1, title, { fg: t.key, bg: t.panelBg, width: width - 4, keys: false });
    lines.forEach((line, k) => {
      const cells = { col: col + 2, row: row + 2 + k, cols: width - 4, rows: 1 };
      label(s, cells.col, cells.row, line, { bg: t.panelBg, width: cells.cols });
      if (k === this.templateMenu) s.invert(cells);
      s.hit(cells, () => this.chooseTemplate(k));
    });
    wrapped.slice(0, 2).forEach((line, k) => label(s, col + 2, row + 3 + lines.length + k, line, { fg: t.value, bg: t.panelBg, width: width - 4, keys: false }));
    const n = button(s, col + 2, row + rows - 1, 'Enter', strings.get('ui.labor_manager.apply'), () => this.chooseTemplate(this.templateMenu ?? 0));
    button(s, col + 4 + n, row + rows - 1, 'Esc', strings.get('ui.labor_manager.back'), () => { this.templateMenu = null; });
  }

  /** A template's labors by name ("Mining, Hauling"), or "every labor off". */
  private templateText(ids: readonly string[]): string {
    if (ids.length === 0) return this.strings.get('ui.labor_manager.template_none');
    const labors = this.labors();
    return ids.map((id) => labors.find((l) => l.id === id)?.name ?? id).join(', ');
  }

  private chooseTemplate(index: number): void {
    const template = LABOR_TEMPLATES[index];
    this.templateMenu = null;
    if (template !== undefined) this.applyTemplate(template.id);
  }

  // ---------- input ----------

  key(press: KeyPress): boolean {
    if (press.ctrl || press.alt || press.meta) return true;
    const k = press.key;
    const esc = k === 'Esc' || k === 'Escape';
    const up = k === '↑' || k === 'ArrowUp';
    const down = k === '↓' || k === 'ArrowDown';
    const left = k === '←' || k === 'ArrowLeft';
    const right = k === '→' || k === 'ArrowRight';
    if (this.templateMenu !== null) {
      if (esc) this.templateMenu = null;
      else if (up || down) this.templateMenu = Math.max(0, Math.min(LABOR_TEMPLATES.length - 1, this.templateMenu + (up ? -1 : 1)));
      else if (k === 'Enter') this.chooseTemplate(this.templateMenu);
      else if (/^[1-9]$/.test(k) && Number(k) <= LABOR_TEMPLATES.length) this.chooseTemplate(Number(k) - 1);
      return true;
    }
    if (esc) {
      this.host.back();
      return true;
    }
    this.notice = null;
    const dwarves = this.dwarves();
    const dwarf = dwarves[this.cursorRow];
    const labor = this.cursorLabor();
    const page = Math.max(1, (this.lastGrid?.height ?? 10) - 1);
    const letter = k.length === 1 ? k.toLowerCase() : '';
    if (up || down) {
      // `Shift` + arrows mark the rows they pass.
      if (press.shift && dwarf !== undefined) this.marks.ids.add(dwarf);
      this.move(up ? -1 : 1, 0);
      const next = dwarves[this.cursorRow];
      if (press.shift && next !== undefined) this.marks.ids.add(next);
    } else if (left || right) this.move(0, left ? -1 : 1);
    else if (k === 'PageUp' || k === 'PageDown') this.move(k === 'PageUp' ? -page : page, 0);
    else if (k === 'Home') this.move(-dwarves.length, 0);
    else if (k === 'End') this.move(dwarves.length, 0);
    else if (k === ' ' || k === 'Space') {
      if (dwarf !== undefined) this.marks.toggle(dwarf);
    } else if (k === '*') this.marks.all(dwarves);
    else if (k === 'Enter') {
      if (dwarf !== undefined && labor !== undefined) this.toggleCell(dwarf, labor.id);
    } else if (letter === 'a') this.toggleRow();
    else if (letter === 'c') {
      if (labor !== undefined) this.toggleColumn(labor.id);
    } else if (letter === 't') this.templateMenu = 0;
    else if (k === '+' || k === '=') {
      if (labor !== undefined) this.changePriority(labor.id, 1);
    } else if (k === '-') {
      if (labor !== undefined) this.changePriority(labor.id, -1);
    } else if (/^[1-9]$/.test(k)) {
      if (labor !== undefined) this.setPriority(labor.id, Number(k));
    }
    // A modal screen: no key falls through to the fortress below.
    return true;
  }

  pointerDown(p: CellPointer): void {
    this.pointer = { col: p.col, row: p.row };
    this.notice = null;
    this.clickShift = p.shift;
    clickHit(this.last, p);
    this.clickShift = false;
  }

  pointerMove(p: CellPointer): void {
    this.pointer = { col: p.col, row: p.row };
  }

  wheel(w: CellWheel): void {
    const g = this.lastGrid;
    const max = Math.max(0, this.dwarves().length - (g?.height ?? 1));
    this.firstRow = Math.max(0, Math.min(max, this.firstRow + (w.dy > 0 ? 3 : -3)));
    // The cursor follows the window so the next draw does not scroll back.
    this.cursorRow = Math.max(this.firstRow, Math.min(this.firstRow + (g?.height ?? 1) - 1, this.cursorRow));
  }
}
