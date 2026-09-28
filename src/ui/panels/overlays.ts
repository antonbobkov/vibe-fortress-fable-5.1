/**
 * The overlays panel (`f`): `ui-screens/panels.md` § Overlays (f), `ui-keymap-and-screens.md`
 * § Overlays, 23 § Compositor step 8. One row per overlay the compositor draws, in the documented
 * order, with a `[■]`/`[□]` box; `↑`/`↓` select, `Enter` or a click toggles (D-103). The last three
 * are the debug overlays of step 8, drawn under the wireframe's `Debug:` label (T-M7-08).
 */

import type { Rect } from '@render/cellbuffer';
import {
  OVERLAY_CHUNKS,
  OVERLAY_CONNECTIVITY,
  OVERLAY_FLUID_LEVELS,
  OVERLAY_JOBS,
  OVERLAY_PATHS,
  OVERLAY_PRIORITY_DIGITS,
  OVERLAY_SQUAD_STATIONS,
  OVERLAY_STOCKPILE_USAGE,
  OVERLAY_TEMPERATURE,
} from '@render/compositor';
import type { Surface } from '../surface';
import { label } from '../widgets';

/** The documented order, with the labels of the overlay list; `debug` marks the last group. */
export const OVERLAY_ROWS: readonly { readonly id: string; readonly label: string; readonly debug?: true }[] = [
  { id: 'designations', label: 'designations' },
  { id: OVERLAY_PRIORITY_DIGITS, label: 'priority digits' },
  { id: 'zones', label: 'zones' },
  { id: OVERLAY_FLUID_LEVELS, label: 'fluid levels' },
  { id: OVERLAY_TEMPERATURE, label: 'temperature' },
  { id: OVERLAY_JOBS, label: 'jobs' },
  { id: OVERLAY_SQUAD_STATIONS, label: 'squad stations' },
  { id: OVERLAY_STOCKPILE_USAGE, label: 'stockpile usage' },
  { id: OVERLAY_CONNECTIVITY, label: 'connectivity', debug: true },
  { id: OVERLAY_PATHS, label: 'paths', debug: true },
  { id: OVERLAY_CHUNKS, label: 'chunks', debug: true },
];

/** The row index of the first debug overlay; the wireframe's `Debug:` label sits on it. */
export const FIRST_DEBUG_ROW = OVERLAY_ROWS.findIndex((row) => row.debug === true);

export class OverlayMenu {
  selected = 0;

  move(delta: number): void {
    this.selected = Math.max(0, Math.min(OVERLAY_ROWS.length - 1, this.selected + delta));
  }

  /** Toggle a row's overlay in the UI state's list. */
  static toggle(overlays: string[], id: string): void {
    const at = overlays.indexOf(id);
    if (at >= 0) overlays.splice(at, 1);
    else overlays.push(id);
  }
}

export function drawOverlaysPanel(s: Surface, rect: Rect, menu: OverlayMenu, overlays: string[]): void {
  const t = s.theme;
  OVERLAY_ROWS.forEach((row, k) => {
    // The `Debug:` label takes one row of its own before the three debug overlays.
    const line = rect.row + k + (row.debug === true ? 1 : 0);
    if (line - rect.row >= rect.rows) return;
    if (k === FIRST_DEBUG_ROW) label(s, rect.col + 1, line - 1, 'Debug:', { fg: t.dim, width: rect.cols - 2, keys: false });
    const on = overlays.includes(row.id);
    const r = { col: rect.col + 1, row: line, cols: rect.cols - 2, rows: 1 };
    label(s, r.col, r.row, `${on ? '[■]' : '[ ]'} ${row.label}`, { width: r.cols, fg: k === menu.selected ? t.key : t.text });
    s.hit(r, () => {
      menu.selected = k;
      OverlayMenu.toggle(overlays, row.id);
    });
  });
}
