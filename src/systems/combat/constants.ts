/**
 * Combat system tuning constants.
 * `02-systems/16-combat.md` § Tuning constants.
 */

export const COMBAT_CADENCE = 1;
export const COMBAT_PHASE = 0;

export const PERCEPTION_RADIUS = 14;
export const TARGET_LOSE_TICKS = 200;
export const RANGED_KEEP_DISTANCE = 3;
export const MIN_ATTACK_COOLDOWN = 12; // Ticks
export const BLUNT_THROUGH_PERCENT = 30;
export const FRACTURE_PERCENT = 30; // Of part max hp in one blunt hit
export const PROJECTILE_SPEED = 3;
export const AMMO_BREAK_PERMILLE = 200;
export const FLEE_BLOOD_PERCENT = 50;
export const THREAT_RADIUS = 8;
export const THREAT_THROTTLE_TICKS = 50;
export const TRAIN_SHIFT_HOURS = 6;
export const SPAR_TICKS = 300;
export const TRAIN_XP = 12;
export const SPAR_INJURY_PERMILLE = 20;
export const TRAIN_SHOTS = 5;
export const REEQUIP_CHECK_DAYS = 3;
export const SOLDIER_AMMO = 25;
export const ARMOR_MIN_SPEED_PERCENT = 60;
export const CREATURE_ATTRIBUTE_DEFAULT = 50;
export const CREATURE_BASE_SKILL = 2;
export const HOSTILE_SKILL_PER_TIER = 2;

/**
 * Quality multipliers for combat equipment (weapons and armor).
 * `03-content/weapons-and-armor.md` § Armor / Worked examples:
 * poor 0.8, common 1.0, fine 1.1, superior 1.2, exceptional 1.35, masterwork 1.5.
 */
export const QUALITY_COMBAT_MULT: readonly number[] = [0.8, 1.0, 1.1, 1.2, 1.35, 1.5];
