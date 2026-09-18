/**
 * The presentation state and its save section.
 *
 * `schemas/system-state.md` § UiState: `{ camX, camY, z, zoom, panel, overlays, logTail }`, and
 * 24 § State: "Camera, z, zoom, overlays, hints shown and the open panel are saved in the `ui`
 * section". The live state adds what is not saved: the look cursor and whether the sidebar is
 * shown (`Tab` "toggles it without changing the panel").
 */

import type { LogLine } from './announcements';
import { LOG_SAVED_LINES } from './constants';

export interface UiState {
  camX: number;
  camY: number;
  z: number;
  zoom: number;
  panel: string | null;
  /** `Tab` hides the sidebar without closing the panel. */
  sidebar: boolean;
  overlays: string[];
  cursor: { x: number; y: number } | null;
}

/** The `ui` save section (`save-format.md` § Sections: `ui`, JSON, `UiState`). */
export interface SavedUiState {
  readonly camX: number;
  readonly camY: number;
  readonly z: number;
  readonly zoom: number;
  readonly panel: string | null;
  readonly overlays: readonly string[];
  readonly logTail: readonly { tick: number; severity: string; text: string; focus?: number }[];
}

export function defaultUiState(z: number): UiState {
  return { camX: 0, camY: 0, z, zoom: 1, panel: null, sidebar: true, overlays: ['designations', 'zones'], cursor: null };
}

/** The saved form: the state's persistent fields and the last `LOG_SAVED_LINES` log lines. */
export function toSaved(ui: UiState, log: readonly LogLine[]): SavedUiState {
  const tail = log.slice(Math.max(0, log.length - LOG_SAVED_LINES));
  return {
    camX: ui.camX,
    camY: ui.camY,
    z: ui.z,
    zoom: ui.zoom,
    panel: ui.panel,
    overlays: [...ui.overlays],
    logTail: tail.map((l) => (l.focus === undefined ? { tick: l.tick, severity: l.severity, text: l.text } : { tick: l.tick, severity: l.severity, text: l.text, focus: l.focus })),
  };
}

/** Apply a saved section to the live state; returns the log lines it carried. */
export function fromSaved(ui: UiState, saved: SavedUiState): LogLine[] {
  ui.camX = saved.camX;
  ui.camY = saved.camY;
  ui.z = saved.z;
  ui.zoom = saved.zoom;
  ui.panel = saved.panel;
  ui.sidebar = true;
  ui.overlays = [...saved.overlays];
  ui.cursor = null;
  return saved.logTail.map((l) => ({
    tick: l.tick,
    severity: l.severity === 'danger' || l.severity === 'alert' ? l.severity : 'note',
    text: l.text,
    count: 1,
    ...(l.focus === undefined ? {} : { focus: l.focus }),
  }));
}
