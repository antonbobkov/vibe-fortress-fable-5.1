/** `15` §§ Mood, Tiers and effects, Thoughts; pure arithmetic shared with the reader and tests. */
import { MOOD_BASELINE, MOOD_MAX, MOOD_MIN, TICKS_PER_HOUR } from '@core/constants';
import type { ActiveThought } from '@core/components';
import type { MoodTier } from '@core/types';
import type { ThoughtDef } from './thoughts';

export const POSITIVE_CAP = 40;
export const NEGATIVE_CAP = 35;
export const NEED_PRESSURE_CAP = 20;
export const HEARTH_TIER_BONUS = 2;
export const SULK_DAYS = 7;
export const UNBURIED_DAYS = 3;

/** 0 Miserable, 1 Unhappy, 2 Fine, 3 Content, 4 Ecstatic. */
export function tierOf(value: number): MoodTier {
  return value >= 85 ? 4 : value >= 65 ? 3 : value >= 40 ? 2 : value >= 20 ? 1 : 0;
}

export function productivity(tier: MoodTier): number {
  return [80, 90, 100, 105, 115][tier] as number;
}

export function currentValue(thought: ActiveThought, def: ThoughtDef, tick: number): number {
  if (def.decay === 'standing' || def.hours === null) return thought.baseValue;
  const ageHours = Math.max(0, tick - thought.startTick) / TICKS_PER_HOUR;
  if (def.decay === 'linear') return ageHours >= def.hours ? 0 : thought.baseValue * (1 - ageHours / def.hours);
  const halfHours = def.hours / 3;
  const value = thought.baseValue * 2 ** (-ageHours / halfHours);
  return Math.abs(value) < 1 ? 0 : value;
}

/** Standing need thoughts already carry need pressure inside the shared negative cap. */
export function moodValue(values: readonly { value: number }[], hearthTier: number, personalityBase: number): number {
  const positives = Math.min(POSITIVE_CAP, values.reduce((n, v) => n + Math.max(0, v.value), 0));
  const negatives = Math.min(NEGATIVE_CAP, values.reduce((n, v) => n + Math.max(0, -v.value), 0));
  return Math.max(MOOD_MIN, Math.min(MOOD_MAX, MOOD_BASELINE + positives - negatives + hearthTier * HEARTH_TIER_BONUS + personalityBase));
}
