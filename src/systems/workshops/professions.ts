import { C } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { Registry } from '@core/registry';
import type { EntityId } from '@core/types';
import { ADULT_AGE_YEARS } from '@systems/dwarves/constants';
import { TICKS_PER_YEAR } from '@core/constants';

interface SkillRow { readonly id: string; readonly profession: string | null; readonly military: string | null }

/** `12` § Professions. lastRaised resolves a tie between the highest skills. */
export function civilianProfession(entities: EntityStore, registry: Registry, id: EntityId): string {
  const creature = entities.get(id, C.Creature);
  if (creature !== undefined && creature.ageTicks < ADULT_AGE_YEARS * TICKS_PER_YEAR) return 'Child';
  const skills = entities.get(id, C.Skills);
  if (skills === undefined) return 'Settler';
  const table = registry.table<SkillRow>('skills');
  let best = 0;
  let level = 0;
  for (let s = 1; s <= table.size; s += 1) {
    const row = table.byIndex(s);
    const n = skills.level[s] ?? 0;
    if (row?.profession === null || row?.profession === undefined || n === 0) continue;
    if (n > level || (n === level && s === skills.lastRaised)) { best = s; level = n; }
  }
  return best === 0 ? 'Settler' : (table.byIndex(best)?.profession ?? 'Settler');
}

export function militaryTitle(entities: EntityStore, registry: Registry, id: EntityId): string {
  const skills = entities.get(id, C.Skills);
  if (skills === undefined) return 'Recruit';
  const table = registry.table<SkillRow>('skills');
  let best = 0;
  let level = 0;
  for (let s = 1; s <= table.size; s += 1) {
    const row = table.byIndex(s);
    const n = skills.level[s] ?? 0;
    if (row?.military === null || row?.military === undefined || n === 0) continue;
    if (n > level || (n === level && s === skills.lastRaised)) { best = s; level = n; }
  }
  return best === 0 ? 'Recruit' : (table.byIndex(best)?.military ?? 'Recruit');
}
