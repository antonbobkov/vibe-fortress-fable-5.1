/**
 * The tuning constants of `02-systems/24-ui-and-input.md` § Tuning constants.
 *
 * `24` is owned by `ui/`, which is not a system directory, and its rows are not in
 * `01-architecture/constants.md`; they live here verbatim, as `src/render/constants.ts` holds 23's
 * rows (DECISIONS.md D-030).
 */
import type { UserSettings } from './settings';

/** Log lines kept in memory. */
export const LOG_MAX_LINES = 2000;

/** Log lines written to the `ui` save section. */
export const LOG_SAVED_LINES = 200;

/** Repeated identical announcements within this many ticks merge with a count. */
export const LOG_DEDUP_TICKS = 100;

/** Rejection reason display time in the status bar. */
export const STATUS_HINT_SECONDS = 2;

/** Hints are evaluated once per this many game hours. */
export const HINT_CHECK_HOURS = 1;

/** Width of a body part's health meter in the creature inspector. */
export const HEALTH_PART_BAR_CELLS = 5;

/** The values and defaults of ui-keymap-and-screens.md § Settings. */
export const SETTINGS_ZOOM_OPTIONS = [0.75, 1, 1.5] as const;
export const SETTINGS_SNAPSHOT_OPTIONS = [2, 4, 8] as const;
export const SETTINGS_COMBAT_LOG_OPTIONS = ['all', 'hits only', 'off'] as const;
export const DEFAULT_USER_SETTINGS: Readonly<UserSettings> = Object.freeze({
  autoPauseDanger: true,
  autoPauseAlert: false,
  hints: true,
  colorblind: false,
  zoom: 1,
  edgeScrolling: false,
  autosave: true,
  snapshotsKept: 4,
  combatLog: 'hits only',
});
