/**
 * The tuning constants of `02-systems/23-rendering.md` § Tuning constants.
 *
 * `23` is owned by `render/`, which is not a system directory, so these rows have no
 * `src/systems/<id>/constants.ts` to live in and they are not in `01-architecture/constants.md`
 * (which `test/unit/constants.test.ts` pins row for row). They live here, verbatim, for the same
 * reason `src/core/path-constants.ts` holds 22's rows. See docs/process/tooling.md § Where code constants live outside the systems.
 *
 * Global screen constants (`CELL_PX_ZOOM_1`, `ZOOM_LEVELS`, `MIN_VIEW_COLS`, `MIN_VIEW_ROWS`,
 * `SIDEBAR_COLS`, `STATUS_ROWS`, `LEVELS_VISIBLE_BELOW`, `TARGET_FPS`) stay in
 * `src/core/constants.ts`, because `constants.md` carries them.
 */

/** The grid the automatic zoom keeps at least: the largest level of 1 or more that leaves this many cells. */
export const AUTO_ZOOM_MIN_COLS = 100;
export const AUTO_ZOOM_MIN_ROWS = 56;

/** Announcement strip above the status bar, in cell rows. */
export const LOG_ROWS = 3;

/** Colored atlases kept in the LRU. */
export const ATLAS_COLOR_CACHE = 128;

/** The bundled font's design grid: each glyph is this many pixels square (23 § Atlas). */
export const ATLAS_FONT_DESIGN_PX = 8;

/** The atlas reads the font's shapes at this many times its design size, one design pixel to a square of samples. */
export const ATLAS_FONT_SAMPLE = 4;

/** Multiplier applied to every channel per dimming step. */
export const DIM_FACTOR = 0.55;

/** Milliseconds per animation phase of an active fluid tile. */
export const FLUID_ANIM_MS = 500;

/** Blend factor for zone backgrounds. */
export const ZONE_TINT_ALPHA = 0.25;

/** The least relative luminance of a zone's background: a tint on a black cell is lifted to it. */
export const ZONE_TINT_MIN_LUMA = 0.18;

/** The selected zone's tiles blend at this many times `ZONE_TINT_ALPHA`. */
export const ZONE_SELECTED_ALPHA_FACTOR = 2;

/** The bundled square bitmap font, loaded before the browser builds any atlas. */
export const BUNDLED_FONT_FAMILY = 'DeepholmMono';
