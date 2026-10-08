/**
 * `readers.of('10')`: `02-systems/10-dwarves.md` § Interfaces › Reader. Arrays are fresh copies.
 */

import { C, type Attributes, type Needs } from '@core/components';
import { TICKS_PER_YEAR } from '@core/constants';
import type { EntityStore } from '@core/entities';
import type { Registry } from '@core/registry';
import type { EntityId, TileIndex } from '@core/types';
import { ADULT_AGE_YEARS } from './constants';
import { tierName } from './rules/skills';
import type { TitleName } from './state';
import { isUnclothed } from './clothing';

export interface DwarvesReader {
  /** Every living dwarf, ascending. */
  list(): EntityId[];
  population(): number;
  adults(): EntityId[];
  children(): EntityId[];
  isChild(id: EntityId): boolean;
  title(id: EntityId): string;
  /** All roles held, in title-table order (D-121). */
  titles(id: EntityId): TitleName[];
  holder(title: TitleName): EntityId;
  isUnclothed(id: EntityId): boolean;
  skill(id: EntityId, skillId: string): number;
  skillTier(id: EntityId, skillId: string): string;
  attribute(id: EntityId, attr: keyof Attributes): number;
  need(id: EntityId, need: keyof Needs): number;
  behavior(id: EntityId): string;
  activityText(id: EntityId): string;
  /** Percent: mood multiplier (15) × wound modifier (17); 100 until those systems exist. */
  productivity(id: EntityId): number;
  friends(id: EntityId): EntityId[];
  isFriend(a: EntityId, b: EntityId): boolean;
  /** Last seen tile of a still-near, living hostile; -1 without a remembered civilian threat. */
  avoidedThreatTile(id: EntityId): TileIndex;
}

export function makeReader(entities: EntityStore, registry: Registry, titles: () => Record<TitleName, EntityId>, moodProductivity: (id: EntityId) => number = () => 100, avoidedThreatTile: (id: EntityId) => TileIndex = () => -1): DwarvesReader {
  const skills = registry.table('skills');
  const list = (): EntityId[] => entities.with(C.Brain, C.Creature).filter((id) => entities.alive(id));
  const isChild = (id: EntityId): boolean => {
    const c = entities.get(id, C.Creature);
    return c !== undefined && c.ageTicks < ADULT_AGE_YEARS * TICKS_PER_YEAR;
  };
  const skill = (id: EntityId, skillId: string): number => {
    const s = entities.get(id, C.Skills);
    return s === undefined || !skills.has(skillId) ? 0 : ((s.level[skills.index(skillId)] ?? 0) as number);
  };
  return {
    list,
    population: () => list().length,
    adults: () => list().filter((id) => !isChild(id)),
    children: () => list().filter(isChild),
    isChild,
    title: (id) => entities.get(id, C.Title)?.title ?? 'none',
    titles: (id) => (['thane', 'warden', 'broker', 'chief_medic'] as const).filter((name) => titles()[name] === id),
    holder: (title) => titles()[title] ?? 0,
    isUnclothed: (id) => isUnclothed(entities.get(id, C.Equipment), (item) => item !== 0 && entities.has(item, C.Item)),
    skill,
    skillTier: (id, skillId) => tierName(skill(id, skillId)),
    attribute: (id, attr) => entities.get(id, C.Attributes)?.[attr] ?? 0,
    need: (id, need) => entities.get(id, C.Needs)?.[need] ?? 0,
    behavior: (id) => entities.get(id, C.Brain)?.behavior ?? '',
    activityText: (id) => entities.get(id, C.Brain)?.activity ?? '',
    productivity: moodProductivity,
    friends: (id) => (entities.get(id, C.Relationships)?.friends ?? []).slice(),
    isFriend: (a, b) => (entities.get(a, C.Relationships)?.friends ?? []).includes(b),
    avoidedThreatTile,
  };
}
