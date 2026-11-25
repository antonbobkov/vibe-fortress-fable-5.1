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
  OVERLAY_LIGHT,
  OVERLAY_PATHS,
  OVERLAY_PRIORITY_DIGITS,
  OVERLAY_SQUAD_STATIONS,
  OVERLAY_STOCKPILE_USAGE,
  OVERLAY_TEMPERATURE,
} from '@render/compositor';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { label } from '../widgets';

/**
 * The documented order; `name` is the overlay list's label, `ui.overlay.<name>`, and `debug` marks
 * the last group.
 */
export const OVERLAY_ROWS: readonly { readonly id: string; readonly name: string; readonly debug?: true }[] = [
  { id: 'designations', name: 'designations' },
  { id: OVERLAY_PRIORITY_DIGITS, name: 'priority_digits' },
  { id: 'zones', name: 'zones' },
  { id: OVERLAY_FLUID_LEVELS, name: 'fluid_levels' },
  { id: OVERLAY_TEMPERATURE, name: 'temperature' },
  { id: OVERLAY_JOBS, name: 'jobs' },
  { id: OVERLAY_SQUAD_STATIONS, name: 'squad_stations' },
  { id: OVERLAY_STOCKPILE_USAGE, name: 'stockpile_usage' },
  { id: OVERLAY_LIGHT, name: 'light' },
  { id: OVERLAY_CONNECTIVITY, name: 'connectivity', debug: true },
  { id: OVERLAY_PATHS, name: 'paths', debug: true },
  { id: OVERLAY_CHUNKS, name: 'chunks', debug: true },
];

/** An overlay row's label in the list and in Help's legend ("priority digits"). */
export function overlayLabel(strings: Strings, row: { readonly name: string }): string {
  return strings.get(`ui.overlay.${row.name}`);
}

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

export function drawOverlaysPanel(s: Surface, rect: Rect, menu: OverlayMenu, overlays: string[], strings: Strings): void {
  const t = s.theme;
  OVERLAY_ROWS.forEach((row, k) => {
    // The `Debug:` label takes one row of its own before the three debug overlays.
    const line = rect.row + k + (row.debug === true ? 1 : 0);
    if (line - rect.row >= rect.rows) return;
    if (k === FIRST_DEBUG_ROW) label(s, rect.col + 1, line - 1, strings.get('ui.overlay.debug'), { fg: t.dim, width: rect.cols - 2, keys: false });
    const on = overlays.includes(row.id);
    const r = { col: rect.col + 1, row: line, cols: rect.cols - 2, rows: 1 };
    label(s, r.col, r.row, `${on ? '[■]' : '[ ]'} ${overlayLabel(strings, row)}`, { width: r.cols, fg: k === menu.selected ? t.key : t.text });
    s.hit(r, () => {
      menu.selected = k;
      OverlayMenu.toggle(overlays, row.id);
    });
  });
}
