import { describe, expect, it } from 'vitest';
import type { JobsReader } from '@systems/jobs';
import { setupThreeYearsFortress, threeYearsWorld } from '../scenarios/three_years_fortress';
import { keepWoodcutter } from '../scenarios/three_years_economy';

/**
 * T-653: the founder who came with the axe is the fortress's woodcutter and carpenter. While he is
 * out of the work (in the hospital, dead, or training in the strong squad) nobody fells a tree and
 * the carpenter's jobs wait: in `three-years-p4-2` at shift 150 the beds stopped at seven for a
 * fortress of 24. The player gives his trade to another dwarf.
 */
describe('T-653 the three-year script keeps a woodcutter', () => {
  it('gives the founder woodcutter\'s trade to another dwarf once he is gone, and not while he works', () => {
    const w = threeYearsWorld('three-years-p4-2', 4);
    const state = setupThreeYearsFortress(w);
    const founders = w.game.arrival!.dwarves;
    const hall = w.index(state.cx + 10, state.cy + 6, state.hallZ);
    const immigrants = [0, 1, 2].map(() => w.spawnDwarf({ at: hall }));
    w.step(1);
    keepWoodcutter(w, state);
    expect(state.economy.specialists['woodcutter'], 'the founder fells').toBeUndefined();
    w.game.world.entities.destroy(founders[2]!);
    w.step(1);
    keepWoodcutter(w, state);
    const feller = state.economy.specialists['woodcutter'];
    expect(immigrants).toContain(feller);
    const jobs = w.readers.of<JobsReader>('11');
    expect(jobs.laborEnabled(feller!, 'woodcutting')).toBe(true);
    expect(jobs.laborEnabled(feller!, 'carpentry')).toBe(true);
    expect(jobs.laborEnabled(feller!, 'farming'), 'he does nothing else').toBe(false);
  });
});
