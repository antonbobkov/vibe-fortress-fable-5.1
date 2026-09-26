/**
 * Health system tuning constants: `02-systems/17-health-and-medicine.md` § Tuning constants.
 */

export const HEALTH_CADENCE = 5;
export const HEALTH_PHASE = 2;

export const BLOOD_PER_SIZE = 10;
export const LIGHT_MAX = 0.2;
export const SERIOUS_MAX = 0.5;
export const HEAL_BASE_TICKS = 6000;
export const BLOOD_REGEN_PER_TICK = 1;
export const PAIN_UNCONSCIOUS = 80;
export const BLOOD_UNCONSCIOUS_PERCENT = 40;
export const BLOOD_DEATH_PERCENT = 20;
export const UNTREATED_FRACTURE_PERCENT = 25;
export const SUTURED_HEAL_PERCENT = 150;
export const INFECTION_PERMILLE = 100;
export const INFECTION_DEATH_PERMILLE = 50;
export const INFECTION_CURE_DAYS = 3;
export const DROWN_DAMAGE = 8;
export const FALL_DAMAGE_PER_LEVEL_SQ = 6;
export const STARVE_PERCENT = 8;
export const PRODUCTIVITY_FLOOR = 30;
export const TREAT_TICKS = 200;
export const TREAT_FAIL_PERMILLE = 200;
export const DIAGNOSE_XP = 20;
export const PAIN_DISCHARGE = 30;
export const FRACTURE_PERCENT = 30;

export const HOSPITAL_DEFAULT_SUPPLIES: Readonly<Record<string, number>> = Object.freeze({
  cloth: 10,
  thread: 5,
  splints: 4,
  crutches: 2,
  brightleaf: 6,
  buckets: 2,
});
