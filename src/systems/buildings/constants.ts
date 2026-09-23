/**
 * 14 Buildings & rooms tuning constants: every row of `02-systems/14-buildings-and-rooms.md`
 * § Tuning constants, verbatim.
 */

/** Between a trigger and the mechanism acting. */
export const LINK_DELAY_TICKS = 100;
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

/** `door` modes (14 § Doors and hatches); `open` is the default. */
export const DOOR_MODES: readonly string[] = Object.freeze(['open', 'locked', 'no_pets', 'lock_on_alert']);
/** `hatch` modes (14 § Doors and hatches); `open` is the default. */
export const HATCH_MODES: readonly string[] = Object.freeze(['open', 'locked']);
/**
 * The wagon's container: "capacity unlimited" (`02` § Arrival step 3), held as the largest safe
 * integer so the container's room arithmetic stays exact (D-074).
 */
export const WAGON_CAPACITY = Number.MAX_SAFE_INTEGER;
