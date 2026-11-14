/**
 * Item value: `02-systems/13-items-and-storage.md` § Value.
 *
 * ```
 * value(item) = materialValue × type.valueMultiplier × qualityMultiplier × count × ageFactor
 * ```
 *
 * "integer marks, where `qualityMultiplier` is 12's tier table (0.5 … 5.0) and 1.0 for non-quality
 * items". The multiplier is content `Fixed` (thousandths) and the quality factor permille, so the
 * product is exact before the one final truncation to whole marks.
 */

import { AGED_VALUE_PERCENT, QUALITY_VALUE_PERMILLE, VINTAGE_VALUE_PERCENT } from './constants';

/** 12's value multiplier of a quality tier, in permille; 1000 for an item type that bears no quality. */
export function qualityPermille(quality: number, qualityBearing: boolean): number {
  if (!qualityBearing) return 1000;
  return QUALITY_VALUE_PERMILLE[quality] ?? 1000;
}

/**
 * `value(item)` in whole marks. `multFixed` is the type's `mult` in thousandths (content `Fixed`).
 */
export function itemValue(materialValue: number, multFixed: number, quality: number, qualityBearing: boolean, count: number, age = 0): number {
  const q = qualityPermille(quality, qualityBearing);
  if (age > 0) return Math.floor((materialValue * multFixed * q * count * agePercent(age)) / 100_000_000);
  return Math.floor((materialValue * multFixed * q * count) / 1_000_000);
}

/** 13 § Aging in a cellar: an aged item is worth `AGED_VALUE_PERCENT`, a vintage one `VINTAGE_VALUE_PERCENT`. */
export function agePercent(age: number): number {
  return age >= 2 ? VINTAGE_VALUE_PERCENT : age === 1 ? AGED_VALUE_PERCENT : 100;
}
