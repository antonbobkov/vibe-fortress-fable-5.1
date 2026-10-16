/** T-M6-18: distinguish fortress survival from ordinary combat deaths. */
import type { TestWorld } from './test-world';

export function deathCounts(w: TestWorld): { dwarf: number; tame: number; other: number } {
  const dwarfSpecies = w.game.registry.table('creatures').index('dwarf');
  const counts = { dwarf: 0, tame: 0, other: 0 };
  for (const event of w.events('CreatureDied')) {
    if (event['species'] === dwarfSpecies) counts.dwarf += 1;
    else if (event['faction'] === 'fortress') counts.tame += 1;
    else counts.other += 1;
  }
  return counts;
}

/** The dwarf deaths of a need gone unmet: 10 starves a dwarf of food or of drink (`starvation`). */
export const NEED_DEATH_CAUSES: readonly string[] = ['starvation', 'dehydration'];

/** T-334: the fortress's dwarf deaths by cause, for a long run's printed figures. */
export function dwarfDeathsByCause(w: TestWorld): Record<string, number> {
  const dwarfSpecies = w.game.registry.table('creatures').index('dwarf');
  const causes: Record<string, number> = {};
  for (const event of w.events('CreatureDied')) {
    if (event['species'] !== dwarfSpecies) continue;
    const cause = String(event['cause'] ?? 'unknown');
    causes[cause] = (causes[cause] ?? 0) + 1;
  }
  return causes;
}

/** T-334: how many dwarves died of hunger or thirst. */
export function needDeaths(w: TestWorld): number {
  const causes = dwarfDeathsByCause(w);
  return NEED_DEATH_CAUSES.reduce((sum, cause) => sum + (causes[cause] ?? 0), 0);
}
