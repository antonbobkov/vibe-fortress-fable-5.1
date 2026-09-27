/**
 * The overlays panel (`f`): `ui-screens/panels.md` § Overlays (f), `ui-keymap-and-screens.md`
 * § Overlays, 23 § Compositor step 8. One row per overlay the compositor draws, in the documented
 * order, with a `[■]`/`[□]` box; `↑`/`↓` select, `Enter` or a click toggles (D-103). Overlays of
 * systems that are not built yet (jobs, squad stations, the debug ones) are listed when they arrive.
 */

import type { Rect } from '@render/cellbuffer';
import type { Surface } from '../surface';
import { label } from '../widgets';

/** The documented order, with the labels of the overlay list. */
export const OVERLAY_ROWS: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'designations', label: 'designations' },
  { id: 'priority_digits', label: 'priority digits' },
  { id: 'zones', label: 'zones' },
  { id: 'fluid_levels', label: 'fluid levels' },
  { id: 'temperature', label: 'temperature' },
  { id: 'squad_stations', label: 'squad stations' },
  { id: 'stockpile_usage', label: 'stockpile usage' },
];

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
    if (k >= rect.rows) return;
    const on = overlays.includes(row.id);
    const text = `${on ? '[■]' : '[ ]'} ${row.label}`;
    const r = { col: rect.col + 1, row: rect.row + k, cols: rect.cols - 2, rows: 1 };
    label(s, r.col, r.row, text, { width: r.cols, fg: k === menu.selected ? t.key : t.text });
    s.hit(r, () => {
      menu.selected = k;
      OverlayMenu.toggle(overlays, row.id);
    });
  });
}
