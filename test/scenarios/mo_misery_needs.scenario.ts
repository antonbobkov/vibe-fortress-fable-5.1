import { expect } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import type { MoraleReader } from '@systems/morale';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'mo_misery_needs', milestone: 4, seed: 'mo-misery-needs', world: 'flat-test', embark: 'none',
  todo: 'C-007',
  run: (w) => {
    const dwarves = Array.from({ length: 7 }, (_, i) => w.spawnDwarf({ at: w.index(10 + i, 10, 32) }));
    w.step(7 * TICKS_PER_DAY + 2);
    const morale = w.readers.of<MoraleReader>('15');
    expect(dwarves.some((id) => morale.mood(id) < 20)).toBe(true);
    for (const id of dwarves) expect(w.events('SulkHappened').filter((e) => e['id'] === id).length).toBe(1);
    expect(w.events('CreatureDied')).toHaveLength(0);
  },
};
export default scenario;
