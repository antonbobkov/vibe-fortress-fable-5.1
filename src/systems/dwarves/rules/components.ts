/**
 * The components 10 owns, built from a `DwarfRecord` for the spawn path
 * (`schemas/components.md` § Component ownership: "`Attributes`, `Skills`, `Needs`, `Personality`,
 * `Schedule`, `Relationships`, `Title`, `Brain` | 10 | 02 and 21 at creation through the spawn
 * API").
 *
 * `10` § Sleeping: "each dwarf has `sleepStartHour` (random 20–24) and sleeps `SLEEP_HOURS`"; the
 * hour is drawn from 10's stream at spawn (docs/02-systems/10-dwarves.md).
 */

import type { Attributes, Brain, Needs, Personality, Relationships, Schedule, Skills, Title } from '@core/components';
import { NEED_MAX } from '@core/constants';
import type { Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import { SLEEP_HOURS } from '../constants';
import type { DwarfRecord } from './make-dwarf';
import { cumulativeXp } from './skills';

/** The first and last sleep start hours (`10` § Sleeping "random 20–24", hours 20:00 … 23:00; D-057). */
export const SLEEP_START_MIN = 20;
export const SLEEP_START_MAX = 23;

export interface DwarfComponents {
  readonly attributes: Attributes;
  readonly skills: Skills;
  readonly needs: Needs;
  readonly personality: Personality;
  readonly schedule: Schedule;
  readonly relationships: Relationships;
  readonly title: Title;
  readonly brain: Brain;
}

/** A fresh `Brain`: nothing chosen yet, so behavior selection runs on the first tick. */
export function freshBrain(): Brain {
  return {
    behavior: 'idle',
    behaviorUntil: 0,
    targetTile: -1,
    activity: '',
    lastMistTick: 0,
    lastOutdoorThoughtHour: -1,
    daysUnderground: 0,
  };
}

export function dwarfComponents(
  record: DwarfRecord,
  registry: Registry,
  rng: RngStream,
  title: Title['title'] = 'none',
): DwarfComponents {
  const skills = registry.table('skills');
  const traits = registry.table('personality');
  const level = new Uint8Array(skills.size + 1);
  const xp = new Uint16Array(skills.size + 1);
  for (const key of Object.keys(record.skills).sort()) {
    const s = skills.index(key);
    level[s] = record.skills[key] ?? 0;
    xp[s] = cumulativeXp(level[s] as number);
  }
  const n = Math.max(0, Math.min(NEED_MAX, record.needs));
  return {
    attributes: { ...record.attributes },
    skills: { level, xp, lastRaised: 0 },
    needs: { hunger: n, thirst: n, rest: n, social: n, comfort: n, purpose: n, joy: n },
    personality: {
      traits: [traits.index(record.personality[0]), traits.index(record.personality[1]), traits.index(record.personality[2])],
    },
    schedule: { sleepStartHour: rng.int(SLEEP_START_MIN, SLEEP_START_MAX), sleepHours: SLEEP_HOURS },
    relationships: { friends: [], grudges: [], talkCount: [], spouse: 0, pets: [] },
    title: { title },
    brain: freshBrain(),
  };
}
