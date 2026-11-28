/**
 * `readers.of('10')`: `02-systems/10-dwarves.md` § Interfaces › Reader. Arrays are fresh copies.
 */

import { avoidsFire } from './fire';
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
  /** The hostile whose last seen tile `avoidedThreatTile` gives, or 0 (the Jobs panel names it). */
  avoidedThreat(id: EntityId): EntityId;
  /** Whether the dwarf fled a fire within `FIRE_AVOID_TICKS`: 11 offers it no job worked near a fire. */
  avoidsFire(id: EntityId): boolean;
  /** The living dwarf walking to or sleeping in this bed, or 0. */
  bedHolder(bedId: EntityId): EntityId;
  /** Whether the dwarf drank spirits within `TIPSY_TICKS` (`10` § Tipsy). */
  isTipsy(id: EntityId): boolean;
  /**
   * `dwarves.whim()`: the Thane's whim of the season, its text, its kind, the count it asks for, how
   * much of it the fortress has now and whether it is met now, or null (`10` § The Thane's whim).
   */
  whim(): WhimView | null;
  /**
   * `dwarves.unsheltered()`: the living civilians the `hearth` alert finds no shelter for (19 `retreatTile`
   * gave none at their last ask: the watched shut-out ids of § Behavior selection, step 2), ascending; empty
   * under another alert.
   */
  unsheltered(): EntityId[];
  /** Whether the dwarf is one of `unsheltered()`: 11 offers it every job it would be offered under a `watchful` alert. */
  isUnsheltered(id: EntityId): boolean;
  /** The wagon's tile from the arrival (02 § Arrival), the idle anchor before a hearth hall (D-057); -1 with no arrival. */
  wagonTile(): TileIndex;
}

/** `dwarves.whim()`: the whim of the season as the units panel's Thane line reads it. */
export interface WhimView {
  readonly id: string;
  readonly text: string;
  readonly met: boolean;
  readonly kind: 'stock' | 'room';
  /** The units (`stock`) or buildings (`room`) the whim asks for. */
  readonly count: number;
  /** How many of them the fortress has now, as the judgement counts them. */
  readonly have: number;
}

export function makeReader(entities: EntityStore, registry: Registry, titles: () => Record<TitleName, EntityId>, moodProductivity: (id: EntityId) => number = () => 100, avoidedThreatTile: (id: EntityId) => TileIndex = () => -1, bedHolder: (bedId: EntityId) => EntityId = () => 0, tick: () => number = () => 0, tipsy: (id: EntityId) => boolean = () => false, whim: () => WhimView | null = () => null, unsheltered: () => EntityId[] = () => [], isUnsheltered: (id: EntityId) => boolean = () => false, wagonTile: () => TileIndex = () => -1, downActivity: (id: EntityId) => string | null = () => null, avoidedThreat: (id: EntityId) => EntityId = () => 0): DwarvesReader {
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
    activityText: (id) => downActivity(id) ?? entities.get(id, C.Brain)?.activity ?? '',
    productivity: moodProductivity,
    friends: (id) => (entities.get(id, C.Relationships)?.friends ?? []).slice(),
    isFriend: (a, b) => (entities.get(a, C.Relationships)?.friends ?? []).includes(b),
    avoidedThreatTile,
    avoidedThreat,
    avoidsFire: (id) => avoidsFire(entities.get(id, C.Brain)?.fireFlight, tick()),
    bedHolder,
    isTipsy: tipsy,
    whim,
    unsheltered,
    isUnsheltered,
    wagonTile,
  };
}
