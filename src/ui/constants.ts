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

/** Rejection reason display time in the status bar (D-U4: four seconds). */
export const STATUS_HINT_SECONDS = 4;

/** `02` § Presets: the preset the embark screen opens with (D-U3). */
export const EMBARK_DEFAULT_PRESET = 'balanced';

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

/** `command-catalog.md` `AddWorkOrder`: "count 1–999 or maintain threshold 1–999" (the picker's bounds, D-U5). */
export const ORDER_COUNT_MIN = 1;
export const ORDER_COUNT_MAX = 999;

/** D-U5: "`+`/`-` ±1, `Shift` ±10". */
export const ORDER_COUNT_BIG_STEP = 10;

/** The threshold a once order takes when it is first switched to `keep ≥ N`. */
export const ORDER_KEEP_DEFAULT = 20;

/** D-U5: recipes "with recent first": how many recently ordered recipes the picker lists. */
export const ORDER_RECENT_MAX = 5;

/** Finished orders the order list keeps as `done` rows for `[r] repeat`. */
export const ORDER_FINISHED_MAX = 3;
