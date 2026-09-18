/**
 * Skills and experience: `02-systems/10-dwarves.md` § Skills and experience and
 * `03-content/skills-and-professions.md` § Skill levels. Pure rules.
 *
 * The tier names are the § Skill levels table, transcribed; `test/unit/dwarves/dwarves.test.ts`
 * reads the table from the document and fails on any drift.
 */

import { SKILL_MAX_LEVEL } from '@core/constants';

/** `xpToNext(level) = 100 + level × 60`. */
export function xpToNext(level: number): number {
  return 100 + level * 60;
}

/** The cumulative xp at which a level is reached: `Σ xpToNext(l)` for `l < level`. */
export function cumulativeXp(level: number): number {
  const l = Math.max(0, Math.min(SKILL_MAX_LEVEL, level));
  return 100 * l + 30 * l * (l - 1);
}

/** The level a cumulative xp total has reached, capped at `SKILL_MAX_LEVEL`. */
export function levelForXp(xp: number): number {
  let level = 0;
  while (level < SKILL_MAX_LEVEL && xp >= cumulativeXp(level + 1)) level += 1;
  return level;
}

/** "Each completed job grants `xp = jobDef.xp × (100 + Wits) / 150`" (rounded down). */
export function jobXp(baseXp: number, wits: number): number {
  return Math.floor((baseXp * (100 + wits)) / 150);
}

/** `skills-and-professions.md` § Skill levels, the tier column (level 0 has none). */
export const SKILL_TIERS: readonly string[] = [
  '',
  'Dabbling',
  'Novice',
  'Novice',
  'Adequate',
  'Adequate',
  'Competent',
  'Competent',
  'Skilled',
  'Skilled',
  'Proficient',
  'Proficient',
  'Talented',
  'Talented',
  'Adept',
  'Adept',
  'Expert',
  'Expert',
  'Master',
  'Master',
  'Legendary',
];

export function tierName(level: number): string {
  return SKILL_TIERS[Math.max(0, Math.min(SKILL_MAX_LEVEL, level))] ?? '';
}

/** The levels whose `SkillLevelUp` gives a happy thought (15); 20 also emits `LegendaryReached`. */
export const THOUGHT_LEVELS: readonly number[] = [5, 10, 15, 20];

/**
 * `22` § Movement helper / `10` § Movement: `speedFixed = species speed × (50 + Agility) / 100`
 * × wound modifier (17) × carry modifier; the wound and carry modifiers are 100% until 17 and 13
 * exist (T-M1-09: "attributes only").
 */
export function dwarfSpeed(speciesSpeed: number, agility: number, woundPercent = 100, carryPercent = 100): number {
  return Math.floor((((Math.floor((speciesSpeed * (50 + agility)) / 100) * woundPercent) / 100) * carryPercent) / 100);
}
