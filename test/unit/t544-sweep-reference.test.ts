/**
 * T-544: the sweep's reference and best figures are T-544 merged with T-545 (`4ab37734`): the squad
 * hunts wolves and bears in metal, and dangerous wild groups come a season apart. The best figures are
 * the means of its eight shifts, as T-543 set them; the instrument's row is that commit's eight shifts
 * (reports/audits/2026-11-13-t544-wild-squad-arena.md).
 */
import { describe, expect, it } from 'vitest';
import { poolSweeps, sweepCheck, SWEEP_MEASURED, SWEEP_REFERENCE, type SweepFigures } from '../perf/three_years_sweep';
import { WILDLIFE_MEASURED, WILDLIFE_REFERENCE } from '../perf/wildlife_year_constants';

/** The pooled rows of `4ab37734` at shifts 0 to 150 (run 43573320107) and 200 to 350 (run 43573322208). */
const MERGED_0_150: SweepFigures = { alive: 20, grown: 7, hungry: 0, living: 1024.25, deaths: 130.75, extinct: 0.5, needDeaths: 3 };
const MERGED_200_350: SweepFigures = { alive: 20, grown: 7, hungry: 0, living: 972.25, deaths: 96.75, extinct: 0.25, needDeaths: 0.25 };
/** T-544 alone (`5698da35`, run 43568577943) and T-545 alone (`5d355335`, run 43562051671), at shifts 0 to 150. */
const T544_ALONE: SweepFigures = { alive: 19.75, grown: 7, hungry: 0.25, living: 889.5, deaths: 148.75, extinct: 1, needDeaths: 2.75 };
const T545_ALONE: SweepFigures = { alive: 20, grown: 7, hungry: 0, living: 1014.75, deaths: 135, extinct: 0.5, needDeaths: 2.5 };

describe('T-544 the sweep and instrument references', () => {
  it('the sweep reference is the merged head\'s standard shifts, and the best figures its eight-shift means', () => {
    expect(SWEEP_REFERENCE).toEqual(MERGED_0_150);
    const eight = poolSweeps([MERGED_0_150, MERGED_200_350]);
    expect({ living: eight.living, deaths: eight.deaths }).toEqual(SWEEP_MEASURED);
    expect(sweepCheck(SWEEP_REFERENCE).bounds).toEqual({ alive: 18, grown: 6, hungry: 1, living: 898.25, deaths: 143.75 });
  });

  it('both halves of the merged head and T-545 alone pass; T-544 alone, before T-545, would not', () => {
    for (const row of [MERGED_0_150, MERGED_200_350, T545_ALONE]) expect(sweepCheck(row).exceeded).toEqual([]);
    expect(sweepCheck(T544_ALONE).exceeded).toEqual(['living at year 3', 'dwarf deaths']);
  });

  it('the instrument\'s reference and best figures are run 43573353421\'s pooled row', () => {
    const row = { median: 12.94, worst: 9.63, secondWorst: 10.5, living: 151.88, wildlifeFree: 9.38, extinct: 0, starvedYears: 0, hungerThirstDeaths: 0 };
    expect(WILDLIFE_REFERENCE).toEqual(row);
    expect(WILDLIFE_MEASURED).toEqual(row);
  });
});
