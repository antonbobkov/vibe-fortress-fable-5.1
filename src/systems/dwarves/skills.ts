/**
 * Experience and level-ups: `02-systems/10-dwarves.md` § Skills and experience, § Attributes
 * (drift: "every `SkillLevelUp` adds `ATTRIBUTE_DRIFT` to the attribute linked to that skill in
 * the skill table …, capped at `ATTRIBUTE_MAX`").
 *
 * `SkillLevelUp` is emitted for every level gained (12 re-reads professions, 10 drifts attributes);
 * 15 gives its thought at levels 5, 10, 15 and 20 (DECISIONS.md D-057).
 */

import { C, type Attributes } from '@core/components';
import { ATTRIBUTE_MAX } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { EntityStore } from '@core/entities';
import type { Registry } from '@core/registry';
import type { EntityId } from '@core/types';
import { SKILL_MAX_LEVEL } from '@core/constants';
import { ATTRIBUTE_DRIFT } from './constants';
import { levelForXp } from './rules/skills';

interface SkillRow {
  readonly id: string;
  readonly attributes: readonly (keyof Attributes)[];
}

/** Largest xp a `Skills.xp` slot holds (`Uint16Array`). */
const XP_CAP = 0xffff;

/**
 * Add `amount` xp to a dwarf's skill; raise the level through every threshold crossed, emitting
 * `SkillLevelUp { id, skill, level }` for each and `LegendaryReached { id, skill }` at 20.
 * Returns the levels gained.
 */
export function grantXp(
  entities: EntityStore,
  registry: Registry,
  id: EntityId,
  skillId: string,
  amount: number,
  emit: (event: GameEvent) => void,
): number {
  if (amount <= 0) return 0;
  const skills = entities.get(id, C.Skills);
  if (skills === undefined) return 0;
  const table = registry.table<SkillRow>('skills');
  const s = table.index(skillId);
  const level = skills.level.slice();
  const xp = skills.xp.slice();
  xp[s] = Math.min(XP_CAP, ((xp[s] ?? 0) as number) + amount);
  const before = (level[s] ?? 0) as number;
  const after = Math.max(before, levelForXp(xp[s] as number));
  level[s] = after;
  entities.add(id, C.Skills, { level, xp, lastRaised: after > before ? s : skills.lastRaised });
  if (after === before) return 0;
  const row = table.byIndex(s) as SkillRow;
  const attrs = entities.get(id, C.Attributes);
  const drifted: Attributes | undefined = attrs === undefined ? undefined : { ...attrs };
  for (let l = before + 1; l <= after; l += 1) {
    emit({ type: 'SkillLevelUp', id, skill: skillId, level: l });
    if (drifted !== undefined) {
      for (const a of row.attributes) drifted[a] = Math.min(ATTRIBUTE_MAX, drifted[a] + ATTRIBUTE_DRIFT);
    }
    if (l === SKILL_MAX_LEVEL) emit({ type: 'LegendaryReached', id, skill: skillId });
  }
  if (drifted !== undefined) entities.add(id, C.Attributes, drifted);
  return after - before;
}
