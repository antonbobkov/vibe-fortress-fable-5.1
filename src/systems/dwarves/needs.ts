/** `10-dwarves.md` § Needs and `creature-brains.md` § Dwarf brain (hourly). */
import type { Needs } from '@core/components';
import { NEED_MAX } from '@core/constants';

export type NeedName = keyof Needs;
export const NEED_NAMES: readonly NeedName[] = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'];
export const WANT: Readonly<Record<NeedName, number>> = {
  hunger: 50, thirst: 50, rest: 60, social: 50, comfort: 55, purpose: 60, joy: 60,
};
export const CRITICAL: Readonly<Partial<Record<NeedName, number>>> = { hunger: 85, thirst: 85, rest: 90 };
export const HUNGER_PER_HOUR = 1;
export const THIRST_PER_HOUR = 1.6;
export const REST_AWAKE_PER_HOUR = 5;
export const REST_ASLEEP_PER_HOUR = -15;
export const SOCIAL_PER_HOUR = 2;
export const COMFORT_PER_HOUR = 1;
export const PURPOSE_IDLE_PER_HOUR = 2;
export const PURPOSE_WORK_PER_HOUR = -10;
export const JOY_PER_HOUR = 0.75;
export const ENDURANCE_BASE = 150;
export const PERCENT = 100;
export const SLEEP_NEED_MIN = 20;

const clamp = (n: number): number => Math.max(0, Math.min(NEED_MAX, n));

/** `10` § Needs: Endurance slows hunger and awake rest; 06 scales thirst. D-117. */
export function advanceNeeds(n: Needs, endurance: number, thirstPercent: number, asleep: boolean, working: boolean): Needs {
  const endFactor = (ENDURANCE_BASE - endurance) / PERCENT;
  return {
    hunger: clamp(n.hunger + HUNGER_PER_HOUR * endFactor),
    thirst: clamp(n.thirst + THIRST_PER_HOUR * thirstPercent / PERCENT),
    rest: clamp(n.rest + (asleep ? REST_ASLEEP_PER_HOUR : REST_AWAKE_PER_HOUR * endFactor)),
    social: clamp(n.social + SOCIAL_PER_HOUR),
    comfort: clamp(n.comfort + COMFORT_PER_HOUR),
    purpose: clamp(n.purpose + (working ? PURPOSE_WORK_PER_HOUR : PURPOSE_IDLE_PER_HOUR)),
    joy: clamp(n.joy + JOY_PER_HOUR),
  };
}

export function crossed(before: Needs, after: Needs): { want: NeedName[]; critical: NeedName[] } {
  const want: NeedName[] = [];
  const critical: NeedName[] = [];
  for (const name of NEED_NAMES) {
    if (before[name] < WANT[name] && after[name] >= WANT[name]) want.push(name);
    const threshold = CRITICAL[name];
    if (threshold !== undefined && before[name] < threshold && after[name] >= threshold) critical.push(name);
  }
  return { want, critical };
}
