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
