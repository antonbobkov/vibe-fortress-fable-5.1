/**
 * Tuning constants for threats, monsters and raids.
 * `02-systems/18-threats-monsters-and-raids.md` § Tuning constants.
 */

export const THREATS_CADENCE = 50;
export const THREATS_PHASE = 31;

export const RENOWN_WEALTH_DIVISOR = 2000;
export const RENOWN_POP_WEIGHT = 0.2;
export const WARNING_DAYS = 1;
export const ARRIVAL_SPREAD = 2;
export const ARRIVAL_TICKS = 100;
export const STEAL_MAX_SIZE = 30;
export const FOLLOW_RADIUS = 4;
export const ENGAGE_IDLE_TICKS = 150;
export const LOOT_RADIUS = 6;
export const LOITER_DAYS_RAID = 2;
export const LOITER_DAYS_SIEGE = 5;
export const RETREAT_LOSS_PERCENT = 50;
export const SPOT_RADIUS = 6;
export const SPOT_RADIUS_DOG = 10;
export const WEB_TICKS = 100;
export const CAVE_SEEK_RADIUS = 30;
export const CAVE_RETURN_TICKS = 600;
export const DEEP_PRESSURE_PER_TILE = 10;
export const DEEP_THRESHOLDS = [50, 150, 300, 500] as const;
export const EMERGENCE_TILES = 4;
export const HOLLOW_WAVE_DAYS = 28;
export const HOSTILE_SKILL_PER_TIER = 2;
export const RESTLESS_PER_NIGHT_MIN = 2;
export const RESTLESS_PER_NIGHT_MAX = 8;
