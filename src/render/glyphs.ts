/**
 * Named glyph indices into the atlas.
 *
 * Every entry is a row of `03-content/glyphs-and-colors.md` § Glyphs by thing § Terrain; the index
 * is the CP437 index of the glyph the row names, or the content index from § Glyph set for the
 * extras (the sapling's `τ` is listed there at 274).
 *
 * The compositor names glyphs through this table so no index is written inline.
 */

/** Nothing drawn. */
export const GLYPH_NONE = 0;
/** ASCII space; also draws nothing. */
export const GLYPH_SPACE_CHAR = 32;

/** `▒` rough wall, and a constructed wall of logs or raw stone. */
export const GLYPH_ROUGH_WALL = 177;
/** `█` smoothed wall, and every constructed block wall. */
export const GLYPH_SOLID_WALL = 219;
/** `☼` engraved wall and engraved floor. */
export const GLYPH_ENGRAVED = 15;
/** `.` rough floor, mud and ash. */
export const GLYPH_ROUGH_FLOOR = 46;
/** `+` smoothed floor. */
export const GLYPH_SMOOTH_FLOOR = 43;
/** `≡` paved floor. */
export const GLYPH_PAVED_FLOOR = 240;
/** `"` grass, cave moss and shrubs. */
export const GLYPH_GRASS = 34;
/** `▲` ramp. */
export const GLYPH_RAMP = 30;
/** `<` stairs up. */
export const GLYPH_STAIRS_UP = 60;
/** `>` stairs down. */
export const GLYPH_STAIRS_DOWN = 62;
/** `X` stairs up and down. */
export const GLYPH_STAIRS_UPDOWN = 88;
/** `╬` fortification. */
export const GLYPH_FORTIFICATION = 206;
/** `♣` broadleaf tree; 07 plants gives each species its own glyph in M4 (DECISIONS.md D-035). */
export const GLYPH_TREE = 5;
/** `τ` sapling (`glyphs-and-colors.md` § Glyph set, index 274). */
export const GLYPH_SAPLING = 274;
/** `○` boulder. */
export const GLYPH_BOULDER = 9;
