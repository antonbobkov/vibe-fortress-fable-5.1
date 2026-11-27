/**
 * 14 Buildings & rooms tuning constants: every row of `02-systems/14-buildings-and-rooms.md`
 * § Tuning constants, verbatim.
 */

/** Between a trigger and the mechanism acting. */
export const LINK_DELAY_TICKS = 100;
/** Work at each end of a mechanism link (`jobs.md`). */
export const LINK_WORK_TICKS = 150;
export const PLATE_RESET_TICKS = 100;
/** Time a door-breaker needs. */
export const DOOR_BREAK_TICKS = 600;
/** Max bridge side. */
export const BRIDGE_MAX = 5;
/** Damage units to a random part (17). */
export const BRIDGE_CRUSH_DAMAGE = 60;
export const WELL_DEPTH = 10;
/** Tiles that count toward size. */
export const ROOM_SIZE_CAP = 40;
/** Score multiplier for enclosed rooms. */
export const ENCLOSED_PERCENT = 150;
/** Default build time; types override. */
export const BUILD_BASE_TICKS = 100;
/** The implicit hall and comfort light cover a 5×5 square around the built hearth. */
export const HEARTH_HALL_SIDE = 5;
/** Temperature added inside the hearth's 5×5 comfort area. */
export const HEARTH_WARMTH_C = 2;
/** 14 § Beds: the percent a made-up bed (one holding its bedding) rests at. */
export const MADE_UP_REST_PERCENT = 110;
/** Build time of a workshop of blocks against its logs, percent (14 § Placement, Workshops of stone). */
export const STONE_WORKSHOP_TICKS_PERCENT = 150;

/** `door` modes (14 § Doors and hatches); `open` is the default. */
export const DOOR_MODES: readonly string[] = Object.freeze(['open', 'locked', 'no_pets', 'lock_on_alert']);
/** `hatch` modes (14 § Doors and hatches); `open` is the default. */
export const HATCH_MODES: readonly string[] = Object.freeze(['open', 'locked']);
/**
 * The wagon's container: "capacity unlimited" (`02` § Arrival step 3), held as the largest safe
 * integer so the container's room arithmetic stays exact (D-074).
 */
export const WAGON_CAPACITY = Number.MAX_SAFE_INTEGER;

/** 14 § Burial: the free coffins a tomb keeps standing until the player sets its `coffins ready`. */
export const TOMB_COFFINS_READY = 2;

/** 14 § The drying rack: the units a rack holds over its drying rows. */
export const RACK_CAPACITY = 5;

/** 14 § Candle stands and lanterns: the candles a stand holds. */
export const STAND_CANDLES = 5;
/** 14 § Candle stands and lanterns: the days a tallow candle burns. */
export const CANDLE_DAYS_TALLOW = 7;
/** 14 § Candle stands and lanterns: the days a beeswax candle burns. */
export const CANDLE_DAYS_WAX = 14;
/** 14 § Candle stands and lanterns, 18 § Stealth: how much farther a creature in comfort light spots, or is spotted. */
export const CANDLE_SPOT_BONUS = 2;
/** 14 § Candle stands and lanterns: per mille an hour, `smoky_hall` for a dwarf lit only by tallow (10's draw). */
export const TALLOW_SMOKE_PERMILLE = 20;
