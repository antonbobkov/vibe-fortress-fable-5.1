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

/**
 * The labor manager (`ui-screens/panels.md` § Labor manager; UI audit M5). The column heads are the
 * labor names written downward, cut to this many rows; every labor name is unique within them.
 */
export const LABOR_HEADER_ROWS = 9;

/** The dwarf-name column of the labor manager, in cells: as wide as the screen allows between these. */
export const LABOR_NAME_COLS_MIN = 14;
export const LABOR_NAME_COLS_MAX = 24;

/** One labor column of the labor manager, in cells: as wide as the screen allows between these. */
export const LABOR_CELL_COLS_MIN = 2;
export const LABOR_CELL_COLS_MAX = 4;

/**
 * The profession templates of the labor manager: applying one turns exactly these labors on and
 * every other labor off (D-246). Hauling stays on in the working professions because haul jobs
 * rank below default work (`HAUL_PRIORITY`, 11 § Tuning constants); a soldier keeps none.
 */
export const LABOR_TEMPLATES: readonly { readonly id: string; readonly labors: readonly string[] }[] = Object.freeze([
  { id: 'miner', labors: ['mining', 'hauling'] },
  { id: 'hauler', labors: ['hauling'] },
  { id: 'farmer', labors: ['farming', 'herbalism', 'brewing', 'cooking', 'hauling'] },
  { id: 'crafter', labors: ['carpentry', 'masonry', 'crafts', 'mechanics', 'gem_cutting', 'leather', 'textiles', 'smelting', 'smithing', 'hauling'] },
  { id: 'soldier', labors: [] },
  { id: 'none', labors: [] },
]);

/** The titles a dwarf can hold, in the title table's order (10 § Titles). */
export const TITLE_IDS = ['thane', 'warden', 'broker', 'chief_medic'] as const;

/** `RenameSquad`: a name of at most 32 characters (16's `renameSquad`). */
export const SQUAD_NAME_MAX_CHARS = 32;
