/**
 * The labors panel: `ui-screens/panels.md` § Labors ("click to toggle · shift-click: whole column
 * · [a] all on/off") and `11` § Player-facing behavior. Rows are the dwarves, columns the labors of
 * `labors.json` under two-letter heads; the columns that do not fit scroll with `←`/`→` while the
 * panel is open. A click submits `SetLabor`; a shift-click sets the whole column to the opposite of
 * "every dwarf has it"; `[a]` does the same for the selected dwarf's row (D-077).
 *
 * The panel is the quick view; `Enter` (or a click on its last row) opens the labor manager, the
 * full-window screen with every column, the priorities and the templates (UI audit M5, D-246).
 * Hovering a column head names the labor in full.
 */

import type { Command } from '@core/commands';
import type { EntityId } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { JobsReader } from '@systems/jobs';
import type { Surface } from '../surface';
import { clampList, label, separator, toggleGlyph } from '../widgets';
import type { PanelContext } from './context';
import { dwarvesOf, nameOf } from './units';

const CELL = 3;
const NAME = 11;

export class LaborsPanel {
  selectedRow = 0;
  firstColumn = 0;
  /** The first dwarf row shown; the grid scrolls to keep the selected row in view (Q13). */
  firstRow = 0;

  labors(ctx: PanelContext): string[] {
    return ctx.registry.table<{ id: string }>('labors').ids().slice();
  }

  enabled(ctx: PanelContext, dwarf: EntityId, labor: string): boolean {
    return ctx.readers.has('11') && ctx.readers.of<JobsReader>('11').laborEnabled(dwarf, labor);
  }

  /** A click on one cell. */
  toggleCell(ctx: PanelContext, dwarf: EntityId, labor: string): Command {
    return { type: 'SetLabor', dwarfId: dwarf, labor, on: !this.enabled(ctx, dwarf, labor) };
  }

  /** Shift-click: the whole column. */
  toggleColumn(ctx: PanelContext, labor: string): Command[] {
    const dwarves = dwarvesOf(ctx);
    const on = !dwarves.every((d) => this.enabled(ctx, d, labor));
    return dwarves.map((d) => ({ type: 'SetLabor', dwarfId: d, labor, on }));
  }

  /** `[a]`: every labor of the selected dwarf. */
  toggleRow(ctx: PanelContext): Command[] {
    const dwarf = dwarvesOf(ctx)[this.selectedRow];
    if (dwarf === undefined) return [];
    const labors = this.labors(ctx);
    const on = !labors.every((l) => this.enabled(ctx, dwarf, l));
    return labors.map((labor) => ({ type: 'SetLabor', dwarfId: dwarf, labor, on }));
  }

  visibleColumns(ctx: PanelContext, cols: number): string[] {
    const fit = Math.max(1, Math.floor((cols - NAME - 1) / CELL));
    const labors = this.labors(ctx);
    this.firstColumn = Math.max(0, Math.min(Math.max(0, labors.length - fit), this.firstColumn));
    return labors.slice(this.firstColumn, this.firstColumn + fit);
  }

  move(delta: number, ctx: PanelContext): void {
    const n = dwarvesOf(ctx).length;
    this.selectedRow = Math.max(0, Math.min(Math.max(0, n - 1), this.selectedRow + delta));
  }

  scroll(delta: number): void {
    this.firstColumn = Math.max(0, this.firstColumn + delta);
  }
}

/** "Ketil I.": the given name and the family initial. */
function shortName(name: string): string {
  const [first, second] = name.split(' ');
  return second === undefined ? (first ?? '') : `${first ?? ''} ${second.charAt(0)}.`;
}

export function drawLaborsPanel(s: Surface, rect: Rect, panel: LaborsPanel, ctx: PanelContext): void {
  const t = s.theme;
  const strings = ctx.strings;
  const columns = panel.visibleColumns(ctx, rect.cols - 1);
  const labors = ctx.registry.table<{ id: string; name: string }>('labors');
  let head = ' '.repeat(NAME);
  for (const l of columns) head += `${(labors.byId(l)?.name ?? l).slice(0, 2)} `;
  const more = panel.firstColumn + columns.length < panel.labors(ctx).length ? '…' : '';
  label(s, rect.col + 1, rect.row, head + more, { fg: t.key, width: rect.cols - 2, keys: false });
  columns.forEach((l, k) => {
    const cell = { col: rect.col + 1 + NAME + k * CELL, row: rect.row, cols: 2, rows: 1 };
    s.tooltip({ ...cell, cols: CELL }, labors.byId(l)?.name ?? l);
    s.hit(cell, () => {
      for (const c of panel.toggleColumn(ctx, l)) ctx.submit(c);
    });
  });
  const dwarves = dwarvesOf(ctx);
  const height = Math.max(1, rect.rows - 5);
  const rows = { selected: panel.selectedRow, scroll: panel.firstRow };
  clampList(rows, dwarves.length, height);
  panel.selectedRow = rows.selected;
  panel.firstRow = rows.scroll;
  for (let r = 0; r < height && panel.firstRow + r < dwarves.length; r += 1) {
    const index = panel.firstRow + r;
    const d = dwarves[index] as EntityId;
    const row = rect.row + 1 + r;
    label(s, rect.col + 1, row, shortName(nameOf(ctx, d)).slice(0, NAME - 1), { width: NAME - 1, keys: false });
    if (index === panel.selectedRow) s.invert({ col: rect.col + 1, row, cols: NAME - 1, rows: 1 });
    s.hit({ col: rect.col + 1, row, cols: NAME - 1, rows: 1 }, () => {
      panel.selectedRow = index;
    });
    columns.forEach((l, k) => {
      const col = rect.col + 1 + NAME + k * CELL;
      label(s, col, row, toggleGlyph(panel.enabled(ctx, d, l)), { fg: t.value, keys: false });
      s.hit({ col, row, cols: 2, rows: 1 }, () => {
        if (ctx.shiftClick()) for (const c of panel.toggleColumn(ctx, l)) ctx.submit(c);
        else ctx.submit(panel.toggleCell(ctx, d, l));
      });
    });
  }
  const row = rect.row + 1 + height;
  separator(s, rect.col + 1, row, rect.cols - 2);
  label(s, rect.col + 1, row + 1, strings.get('ui.labors.help1'), { fg: t.dim, width: rect.cols - 2 });
  label(s, rect.col + 1, row + 2, strings.get('ui.labors.help2'), { fg: t.dim, width: rect.cols - 2 });
  label(s, rect.col + 1, row + 3, strings.get('ui.labors.manager'), { width: rect.cols - 2 });
  s.hit({ col: rect.col + 1, row: row + 3, cols: rect.cols - 2, rows: 1 }, () => ctx.laborManager?.({ focus: dwarves[panel.selectedRow] }));
}
