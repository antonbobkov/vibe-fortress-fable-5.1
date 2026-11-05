/**
 * Tuning constants for threats, monsters and raids.
 * `02-systems/18-threats-monsters-and-raids.md` § Tuning constants.
 */

export const THREATS_CADENCE = 50;
export const THREATS_PHASE = 31;

export const RENOWN_WEALTH_DIVISOR = 2000;
export const RENOWN_POP_WEIGHT = 0.2;
/** `threat-schedules.md`: Hillfolk bandits appear only below reputation 50. */
export const BANDIT_REPUTATION_LIMIT = 50;
export const WARNING_DAYS = 1;
/** Keep ended raid data long enough for legend events to be recorded. */
export const PARTY_HISTORY_DAYS = 1;
export const ARRIVAL_SPREAD = 2;
export const ARRIVAL_TICKS = 100;
export const STEAL_MAX_SIZE = 30;
export const THIEF_WAIT_DAYS = 1;
/** A thief still approaching its quarry this long after arrival withdraws (unmeasured). */
export const THIEF_APPROACH_DAYS = 2;
export const FOLLOW_RADIUS = 4;
export const ENGAGE_IDLE_TICKS = 150;
/** 18 § Engage: an engaged party none of whose members strikes a blow this long loiters, and stays out of the fight (unmeasured). */
export const ENGAGE_STALL_TICKS = 600;
export const LOOT_RADIUS = 6;
export const LOITER_DAYS_RAID = 2;
export const LOITER_DAYS_SIEGE = 5;
export const RETREAT_LOSS_PERCENT = 50;
/** 18 § Morale: a party's morale on arrival, by purpose; a purpose not named has none. */
export const MORALE_START: Readonly<Partial<Record<string, number>>> = { siege: 100, raid: 90, ambush: 75, bandits: 60 };
/** A party breaks when its morale falls to this. */
export const MORALE_BREAK = 20;
/** A party that has lost every captain it arrived with breaks below this once it is out of a fight. */
export const MORALE_BREAK_LEADERLESS = 50;
/** Morale a member's casualty costs, for a party of ten (scaled by 10 / members); its worst counts. */
export const MORALE_CASUALTY = { fled: 5, down: 8, caged: 10, dead: 10 } as const;
/** Morale the loss of the party's last captain costs, once. */
export const MORALE_CAPTAIN_LOST = 30;
/** Morale a trap that springs on a member and does not miss costs. */
export const MORALE_TRAP = 3;
/** Morale a hit from one of its own costs (a careless archer's arrow). */
export const MORALE_OWN_FIRE = 2;
/** Morale a fortress creature killed or downed by a member gives. */
export const MORALE_FOE_FELLED = 5;
/** Morale an item of loot picked up gives. */
export const MORALE_LOOT = 2;
/** A raider's nerve (the morale below which it runs) is its species' `fleeBloodPercent` less this, plus its spread. */
export const NERVE_BELOW_FLEE_BLOOD = 20;
/** The spread of nerve between raiders of one species: 0 .. NERVE_SPREAD - 1, from the entity id. */
export const NERVE_SPREAD = 20;
export const RETREAT_STUCK_TICKS = 600;
export const RETREAT_GIVE_UP_DAYS = 2;
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
/** 25 § Hexers: the first year a raid or siege brings hexers, by peril; a peril not named brings none. */
export const HEXER_FIRST_YEAR: Readonly<Record<number, number>> = { 3: 3, 4: 2 };
/** Hexers a raid brings on top of its size. */
export const HEXERS_PER_RAID = 1;
/** Hexers a siege brings on top of its size. */
export const HEXERS_PER_SIEGE = 2;
/** 25 § Hexers: a hexer whose entity id is a multiple of this carries the dread hexer kit; no draw. */
export const DREAD_HEXER_EVERY = 3;
export const RESTLESS_PER_NIGHT_MIN = 2;
export const RESTLESS_PER_NIGHT_MAX = 8;
