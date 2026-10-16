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
