/**
 * Global constants.
 *
 * Every row of `docs/01-architecture/constants.md`, verbatim. `test/unit/constants.test.ts`
 * parses that document and fails on any drift in either direction, so this file is never edited
 * without the document changing first.
 *
 * A constant that only one system uses lives in that system's `constants.ts`, never here.
 */

// ---------- World scale ----------

/** World map side length in regions. */
export const WORLD_SIZE_SMALL = 32;
/** Default world size. */
export const WORLD_SIZE_STANDARD = 64;
/** Largest world size. */
export const WORLD_SIZE_LARGE = 96;
/** Local map width in tiles (x axis). */
export const LOCAL_MAP_W = 96;
/** Local map height in tiles (y axis). */
export const LOCAL_MAP_H = 96;
/** Number of z-levels; z = 0 is the bottom. */
export const LOCAL_MAP_Z = 48;
/** Side of a chunk in tiles; chunks are one z-level thick. */
export const CHUNK_SIZE = 16;
/** z-levels 0-3 are the Sea of Fire. */
export const MAGMA_SEA_TOP_Z = 3;
/** Band of the third (deepest) cavern. */
export const CAVERN_3_Z_MIN = 5;
export const CAVERN_3_Z_MAX = 8;
/** Band of the second cavern. */
export const CAVERN_2_Z_MIN = 11;
export const CAVERN_2_Z_MAX = 14;
/** Band of the first (shallowest) cavern. */
export const CAVERN_1_Z_MIN = 18;
export const CAVERN_1_Z_MAX = 22;
/** Lowest surface elevation on any local map. */
export const SURFACE_Z_MIN = 27;
/** Highest surface elevation on any local map. */
export const SURFACE_Z_MAX = 40;
/** Top z-level; always air. */
export const SKY_Z_MAX = 47;
/** Deepsilver veins occur only at z <= this value. */
export const DEEPSILVER_Z_MAX = 6;

// ---------- Time ----------

export const TICKS_PER_HOUR = 50;
export const HOURS_PER_DAY = 24;
/** `TICKS_PER_HOUR x HOURS_PER_DAY`. */
export const TICKS_PER_DAY = 1200;
export const DAYS_PER_SEASON = 28;
/** Spring, summer, autumn, winter, in that order. */
export const SEASONS_PER_YEAR = 4;
export const DAYS_PER_YEAR = 112;
export const TICKS_PER_YEAR = 134400;
/** Ticks per real second at speed 1x; one game day per real minute. */
export const SIM_TICKS_PER_SECOND = 20;
/** Available speeds besides pause. */
export const SPEED_MULTIPLIERS: readonly [1, 2, 4] = [1, 2, 4];
/** Upper bound on ticks simulated in one animation frame; the game slows rather than skipping. */
export const MAX_TICKS_PER_FRAME = 8;
/** Embark always happens on day 1 of spring, year 1. */
export const START_SEASON = 'spring';
/** Hour of arrival. */
export const START_HOUR = 8;

// ---------- Population and entity limits ----------

/** Starting dwarves. */
export const EMBARK_DWARF_COUNT = 7;
/** Default immigration cap; player-configurable 20-200. */
export const POPULATION_CAP_DEFAULT = 80;
/** Hard cap on living creatures; wildlife and threats stop spawning at the cap. */
export const MAX_CREATURES = 600;
/** Above this the UI warns about performance; nothing is refused. */
export const MAX_ITEMS_SOFT = 40000;
/** Dwarves per squad. */
export const SQUAD_MAX_SIZE = 6;
/** Squads per fortress. */
export const SQUAD_MAX_COUNT = 6;

// ---------- Fluids ----------

/** Units of fluid in a full tile. */
export const FLUID_MAX_LEVEL = 7;
/** Water at 1-3 is passable at double movement cost. */
export const FLUID_WADE_LEVEL = 3;
/** Water at 4-7 is impassable for pathfinding; non-aquatic creatures inside it drown slowly. */
export const FLUID_DEEP_LEVEL = 4;
/** Water is simulated every 2 ticks. */
export const FLUID_TICK_CADENCE_WATER = 2;
/** Magma is simulated every 4 ticks. */
export const FLUID_TICK_CADENCE_MAGMA = 4;

// ---------- Economy ----------

export const CURRENCY_NAME = 'marks';
/** Marks available at embark. */
export const EMBARK_BUDGET_BASE = 1500;
/** Added to the budget per point of the region's peril rating. */
export const EMBARK_BUDGET_PER_PERIL = 100;
/** Skill levels to distribute per starting dwarf. */
export const EMBARK_SKILL_POINTS_PER_DWARF = 10;
/** Highest starting level in any one skill. */
export const EMBARK_SKILL_MAX_PER_SKILL = 5;

// ---------- Scales ----------

export const SKILL_MAX_LEVEL = 20;
export const ATTRIBUTE_MIN = 0;
export const ATTRIBUTE_MAX = 100;
/** Average dwarf. */
export const ATTRIBUTE_BASELINE = 50;
/** Needs range 0 (satisfied) to 100 (desperate). */
export const NEED_MAX = 100;
export const MOOD_MIN = 0;
export const MOOD_MAX = 100;
/** Mood with no thoughts and no unmet needs. */
export const MOOD_BASELINE = 55;
/** poor, common, fine, superior, exceptional, masterwork. */
export const QUALITY_TIER_COUNT = 6;
/** bare, modest, decent, fine, grand, royal. */
export const ROOM_QUALITY_TIER_COUNT = 6;
/** 1 is most urgent. */
export const PRIORITY_MIN = 1;
export const PRIORITY_MAX = 9;
export const PRIORITY_DEFAULT = 5;
/** Wealth, peril and temper range 0-4. */
export const RATING_MAX = 4;
/** head, torso, left arm, right arm, left leg, right leg. */
export const BODY_PART_COUNT = 6;

// ---------- Rendering and screen ----------

/** Screen cell is 16x16 px at zoom 1; cells are square. */
export const CELL_PX_ZOOM_1 = 16;
/** Cell sizes 12, 16, 24 px. */
export const ZOOM_LEVELS: readonly [0.75, 1, 1.5] = [0.75, 1, 1.5];
/** Below this the canvas scales down instead of hiding cells. */
export const MIN_VIEW_COLS = 80;
export const MIN_VIEW_ROWS = 45;
/** Width of the right-hand panel when open. */
export const SIDEBAR_COLS = 36;
/** Height of the bottom status bar. */
export const STATUS_ROWS = 2;
/** Render loop target; rendering is decoupled from simulation. */
export const TARGET_FPS = 60;
/** How many z-levels below the slice show through open tiles, each dimmer. */
export const LEVELS_VISIBLE_BELOW = 2;

/** Fortress rename limit, shared by the core command and its text input. */
export const FORTRESS_NAME_MAX_CHARS = 32;
