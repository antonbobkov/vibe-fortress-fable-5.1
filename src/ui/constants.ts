/**
 * The tuning constants of `02-systems/24-ui-and-input.md` § Tuning constants.
 *
 * `24` is owned by `ui/`, which is not a system directory, and its rows are not in
 * `01-architecture/constants.md`; they live here verbatim, as `src/render/constants.ts` holds 23's
 * rows (docs/process/tooling.md § Where code constants live outside the systems).
 */
import type { UserSettings } from './settings';

/** Presentation-only designation batches retained for undo. */
export const UNDO_BATCHES_MAX = 10;

/** Animals cap editor bounds and Shift increment (24). */
export const BREEDING_CAP_MIN = 0;
export const BREEDING_CAP_MAX = 100;
export const BREEDING_CAP_BIG_STEP = 10;

/** Log lines kept in memory. */
export const LOG_MAX_LINES = 2000;

/** Log lines written to the `ui` save section. */
export const LOG_SAVED_LINES = 200;

/** Repeated identical announcements within this many ticks merge with a count. */
export const LOG_DEDUP_TICKS = 100;

/** The keyboard cursor keeps at least this many tiles between itself and the edge of the map view; the camera scrolls to keep it. */
export const CURSOR_SCROLL_MARGIN = 3;

/** Rejection reason display time in the status bar (D-U4: four seconds). */
export const STATUS_HINT_SECONDS = 4;

/** How long the game menu shows what saving did (24 § Game menu). */
export const GAME_MENU_MESSAGE_MS = 3000;

/** `02` § Presets: the preset the embark screen opens with (D-U3). */
export const EMBARK_DEFAULT_PRESET = 'balanced';

/** Hints are evaluated once per this many game hours. */
export const HINT_CHECK_HOURS = 1;

/** The embark screen's hint line turns over after this many seconds of real time. */
export const EMBARK_HINT_SECONDS = 5;

/** `hint_food`: the stock of edible items is below this many days of eating for the population. */
export const HINT_FOOD_DAYS = 2;
/** Days one edible item feeds one dwarf at the base hunger rate (a meal takes 100 of the 24 hunger a day brings, rounded down to four). */
export const HINT_FOOD_DAYS_PER_ITEM = 4;

/** Width of a body part's health meter in the creature inspector. */
export const HEALTH_PART_BAR_CELLS = 5;

/** The values and defaults of ui-keymap-and-screens.md § Settings. */
export const SETTINGS_ZOOM_OPTIONS = ['auto', 0.75, 1, 1.5, 2] as const;
export const SETTINGS_SNAPSHOT_OPTIONS = [2, 4, 8] as const;
export const SETTINGS_COMBAT_LOG_OPTIONS = ['all', 'hits only', 'off'] as const;
export const SETTINGS_INTRO_OPTIONS = ['first time', 'always', 'off'] as const;
export const SETTINGS_INTRO_STYLE_OPTIONS = ['deep', 'hall'] as const;
export const DEFAULT_USER_SETTINGS: Readonly<UserSettings> = Object.freeze({
  autoPauseDanger: true,
  autoPauseAlert: false,
  hints: true,
  colorblind: false,
  zoom: 'auto',
  edgeScrolling: false,
  autosave: true,
  snapshotsKept: 4,
  combatLog: 'hits only',
  music: true,
  musicVolume: 50,
  soundVolume: 50,
  intro: 'first time',
  introSeen: false,
  introStyle: 'deep',
  reducedMotion: false,
});

/** 24 § Tuning constants: the intro's stage, in cells (`intro.md` § Stage). */
export const INTRO_STAGE_COLS = 64;
export const INTRO_STAGE_ROWS = 16;
/** 24 § Tuning constants: how long an intro cue shows each frame when its row gives no step. */
export const INTRO_FRAME_MS = 250;
/** 24 § Tuning constants: how far below its place each column of a rising piece of intro art starts. */
export const INTRO_RISE_ROWS = 6;
/** 24 § Tuning constants: the deep intro's strip, in art pixels (`deep-intro.md` § Stage). */
export const DEEP_INTRO_STAGE_COLS = 80;
export const DEEP_INTRO_STAGE_ROWS = 30;
/** 24 § Tuning constants: how often the deep intro's static and speckle are drawn anew, ms. */
export const DEEP_INTRO_NOISE_MS = 80;
/** 24 § Tuning constants: how often a shake of the deep intro moves the strip, ms. */
export const DEEP_INTRO_SHAKE_MS = 40;
/** 24 § Tuning constants: the stone blocks of the pillars beside the deep intro's strip, art pixels. */
export const DEEP_INTRO_BLOCK_COLS = 8;
export const DEEP_INTRO_COURSE_ROWS = 4;

/** The music and sound volumes run from 0 to 100 in steps of this many (ui-keymap-and-screens.md § Settings). */
export const SETTINGS_VOLUME_STEP = 10;

/** 24 § Music: the silence between two fortress pieces is drawn between these, in seconds. */
export const MUSIC_SILENCE_MIN_S = 60;
export const MUSIC_SILENCE_MAX_S = 180;
/** 24 § Music: the pause before the main-menu theme plays again. */
export const MUSIC_MENU_GAP_S = 8;
/** 24 § Music: the pause before the tense piece plays again while the danger stands. */
export const MUSIC_TENSE_GAP_S = 3;
/** 24 § Music: the pause after a change of mood (or music turned on) before the next piece. */
export const MUSIC_CHANGE_GAP_S = 3;
/** 24 § Music: how long a stopped piece takes to fade out. */
export const MUSIC_FADE_S = 2.5;
/** 24 § Music: how far ahead of the audio clock notes are handed to the synthesizer. */
export const MUSIC_LOOKAHEAD_S = 1;
/** 24 § Music: the time a piece's last notes take to die away, added to its length. */
export const MUSIC_TAIL_S = 2;
/** 24 § Music: the loudest the music plays, at volume 100. */
export const MUSIC_MASTER_GAIN = 0.6;
/** 24 § Music: the length of the cave reverb, in seconds. */
export const MUSIC_REVERB_S = 2.4;
/** 24 § Music: how long after music turns off (or the volume reaches 0) the audio context is suspended, so the last piece has faded. */
export const MUSIC_SUSPEND_DELAY_S = 3;

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

/**
 * The labor manager (`ui-screens/panels.md` § Labor manager; UI audit M5). The column heads are the
 * labor names written downward, cut to this many rows; every labor name is unique within them.
 */
export const LABOR_HEADER_ROWS = 9;

/** A window at least this many rows tall writes every labor name in full down its column head. */
export const LABOR_TALL_WINDOW_ROWS = 55;

/** A dwarf's skill in a labor's skill: the levels from which the manager's cell colour changes. */
export const LABOR_SKILL_VALUE_LEVEL = 5;
export const LABOR_SKILL_GOOD_LEVEL = 10;

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

/**
 * The function tags a lever or a plate can be linked to (14 § Mechanisms; `LinkMechanism` refuses
 * any other target with `not_linkable`). The building panel lists and names only these (U-05).
 */
export const LINKABLE_TAGS: readonly string[] = Object.freeze(['door', 'hatch', 'floodgate', 'bridge', 'trap:spike', 'cage']);

/** A pressure plate's smallest creature size changes by this much per `←` `→` (a dwarf is 60; U-05). */
export const PLATE_SIZE_STEP = 10;

/** The largest "smallest size" the plate editor offers. */
export const PLATE_SIZE_MAX = 300;

/** The deepest fluid a plate can wait for: the fluid grid has levels 0..7 (`SetPlateTrigger`). */
export const PLATE_LEVEL_MAX = 7;

/** The stockpile editor uses the quality tiers accepted by SetStockpileFilter. */
export const STOCKPILE_QUALITY_MIN = 0;
export const STOCKPILE_QUALITY_MAX = 5;

/** Responsive horizontal spacing for the minimum eighty-column viewport. */
export const UI_NORMAL_SPACING = 3;
export const UI_COMPACT_SPACING = 1;
export const EMBARK_PRESET_SPACING = 4;

/** The world map's site summary names at most this many species, layers or ores in a row, then "and N more". */
export const SITE_LIST_NAMES = 2;

/** The width of the site summary's row labels in the region panel ("Wildlife" and a space). */
export const SITE_LABEL_COLS = 9;
