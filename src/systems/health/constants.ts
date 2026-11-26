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
/** Ticks after which a light wound stops bleeding by itself. */
export const CLOT_TICKS = 150;
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
/** The damage of one hour's heat stroke or frostbite on a limb (§ Wound creation, Heat and cold). */
export const TEMPERATURE_INJURY_DAMAGE = 5;
export const STARVE_PERCENT = 8;
export const PRODUCTIVITY_FLOOR = 30;
export const TREAT_TICKS = 200;
/** T-576: the work of `stop_bleeding`, first aid: a bandage is put on in an hour, not in the four of a suture. */
export const BANDAGE_TICKS = 50;
export const TREAT_FAIL_PERMILLE = 200;
export const DIAGNOSE_XP = 20;
export const PAIN_DISCHARGE = 30;
export const FRACTURE_PERCENT = 30;

export const HOSPITAL_SUPPLY_MAX = 999;
/** 17 § Player-facing behavior: a hospital bed for this many living dwarves; fewer, and the Beds line is in the alert colour. */
export const HOSPITAL_BEDS_PER = 10;
/** 17 § Player-facing behavior: the living dwarves from which the hospital's standing alert holds, if no wound has come first. */
export const HOSPITAL_ALERT_DWARVES = 30;

export const HOSPITAL_DEFAULT_SUPPLIES: Readonly<Record<string, number>> = Object.freeze({
  cloth: 10,
  bandages: 0,
  thread: 5,
  splints: 4,
  crutches: 2,
  brightleaf: 6,
  buckets: 2,
  honey: 0,
  soap: 0,
});
