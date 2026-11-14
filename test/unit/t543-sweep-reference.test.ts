/**
 * T-543: the sweep's reference and best figures are master `6e6a6ec3`'s, after wolves and bears fight
 * back; the best figures are the means of its eight shifts (reports/audits/2026-11-10-t543-sweep-deaths-drift.md).
 */
import { describe, expect, it } from 'vitest';
import { poolSweeps, sweepCheck, type SweepFigures } from '../perf/three_years_sweep';

/** T-543's reference and best figures, since refreshed by T-544 (t544-sweep-reference.test.ts). */
const T543_REFERENCE: SweepFigures = { alive: 19.75, grown: 7, hungry: 0.25, living: 886, deaths: 147, extinct: 1, needDeaths: 2.5 };
const T543_MEASURED = { living: 882.25, deaths: 146.38 };

/** The pooled rows of master `6e6a6ec3` at shifts 0 to 150 (run 42872065870) and 200 to 350 (run 42873612241). */
const MASTER_0_150: SweepFigures = { alive: 19.75, grown: 7, hungry: 0.25, living: 886, deaths: 147, extinct: 1, needDeaths: 2.5 };
const MASTER_200_350: SweepFigures = { alive: 19.75, grown: 7, hungry: 0.25, living: 878.5, deaths: 145.75, extinct: 1.25, needDeaths: 2.75 };
/** Master `48b754d1`, before T-538 to T-541, at the same eight shifts (runs 42870676873 and 42870682282). */
const BEFORE_0_150: SweepFigures = { alive: 19.75, grown: 7, hungry: 0.25, living: 967, deaths: 134.25, extinct: 1.25, needDeaths: 1 };
const BEFORE_200_350: SweepFigures = { alive: 20, grown: 7, hungry: 0, living: 912.5, deaths: 134.5, extinct: 0.75, needDeaths: 1 };

describe('T-543 the sweep reference', () => {
  it('is the standard shifts of master, and the best figures are its eight-shift means', () => {
    expect(T543_REFERENCE).toEqual(MASTER_0_150);
    const eight = poolSweeps([MASTER_0_150, MASTER_200_350]);
    expect({ living: eight.living, deaths: eight.deaths }).toEqual(T543_MEASURED);
  });

  it('passes both halves of master and of the commit before, with the old tolerances', () => {
    for (const row of [MASTER_0_150, MASTER_200_350, BEFORE_0_150, BEFORE_200_350]) expect(sweepCheck(row, T543_MEASURED).exceeded).toEqual([]);
    expect(sweepCheck(T543_REFERENCE, T543_MEASURED).bounds).toEqual({ alive: 18, grown: 6, hungry: 1, living: 782.25, deaths: 176.38 });
  });
});
