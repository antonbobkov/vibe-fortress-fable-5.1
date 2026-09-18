/**
 * Item value: `02-systems/13-items-and-storage.md` § Value.
 *
 * ```
 * value(item) = materialValue × type.valueMultiplier × qualityMultiplier × count
 * ```
 *
 * "integer marks, where `qualityMultiplier` is 12's tier table (0.5 … 5.0) and 1.0 for non-quality
 * items". The multiplier is content `Fixed` (thousandths) and the quality factor permille, so the
 * product is exact before the one final truncation to whole marks.
 */

import { QUALITY_VALUE_PERMILLE } from './constants';

/** 12's value multiplier of a quality tier, in permille; 1000 for an item type that bears no quality. */
export function qualityPermille(quality: number, qualityBearing: boolean): number {
  if (!qualityBearing) return 1000;
  return QUALITY_VALUE_PERMILLE[quality] ?? 1000;
}

/**
 * `value(item)` in whole marks. `multFixed` is the type's `mult` in thousandths (content `Fixed`).
 */
export function itemValue(materialValue: number, multFixed: number, quality: number, qualityBearing: boolean, count: number): number {
  const q = qualityPermille(quality, qualityBearing);
  return Math.floor((materialValue * multFixed * q * count) / 1_000_000);
}
