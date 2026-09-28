/** T-M7-04: uncovered medicine is weighted in two waves. */
import { expect } from 'vitest';
import { RngStream, seedFor } from '@core/rng';
import { KEY_PROFESSIONS } from '@systems/immigration/constants';
import { coverage, planWave, waveSize } from '@systems/immigration/waves';
import type { DwarvesReader } from '@systems/dwarves/reader';
import type { ItemsReader } from '@systems/items/reader';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'im_composition', milestone: 7, seed: 'im-composition', world: 'flat-test', embark: 'none',
  setup: (w) => {
    for (const profession of KEY_PROFESSIONS) if (profession.id !== 'medic') w.spawnDwarf({ skills: { [profession.primary]: 5 } });
    for (let n = 0; n < 15; n += 1) w.spawnItem('bar', 'deepsilver', w.index(48, 48, 32), 5);
  },
  run: (w) => {
    const dwarves = w.readers.of<DwarvesReader>('10');
    const adultSkills = dwarves.adults().map((id) => Object.fromEntries(KEY_PROFESSIONS.map((p) => [p.primary, dwarves.skill(id, p.primary)])));
    const covered = coverage(w.game.registry, adultSkills);
    expect(covered.has('medic')).toBe(false);
    let successes = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const rng = new RngStream(seedFor(`im-composition-${seed}`, '21'));
      const taken = new Set<string>();
      const size = waveSize(w.readers.of<ItemsReader>('13').wealth(), 3, 0, 80, false);
      const first = planWave(w.game.registry, rng, size, covered, taken);
      const second = planWave(w.game.registry, rng, size, covered, taken);
      if ([...first, ...second].some((member) => member.profession === 'medic')) successes += 1;
    }
    expect(successes).toBeGreaterThanOrEqual(18);
  },
};
export default scenario;
