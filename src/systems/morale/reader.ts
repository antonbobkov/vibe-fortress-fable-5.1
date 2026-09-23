/** `15` § Interfaces › Reader. */
import type { MoodTier, EntityId } from '@core/types';
import type { ThoughtDef } from './thoughts';

export interface ThoughtView {
  id: string;
  text: string;
  value: number;
  remainingHours: number | null;
}

export interface MoraleReader {
  mood(id: EntityId): number;
  tier(id: EntityId): MoodTier;
  productivity(id: EntityId): number;
  thoughts(id: EntityId): ThoughtView[];
  hallSpirit(): number;
  hallSpiritTier(): MoodTier;
  def(thoughtId: string): ThoughtDef | undefined;
  dayOff(id: EntityId): boolean;
}
