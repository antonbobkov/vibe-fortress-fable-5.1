/**
 * T-555: the sweep's reference and best figures are `4b9c52f9`'s (T-555 on master `df68548f`). Its
 * deaths rose 17.1 a sweep over master's same eight shifts, all of it three-years-p4-1's timeline moved
 * by the Wildwood's new list entries, and the rise was accepted as a timeline shift; the best figures
 * are the means of its eight shifts, as T-543 set them (reports/data/2026-11-16-t555-sweep-deaths.md).
 */
import { describe, expect, it } from 'vitest';
import { poolSweeps, sweepCheck, SWEEP_MEASURED, SWEEP_REFERENCE, type SweepFigures } from '../perf/three_years_sweep';

/** The pooled rows of `4b9c52f9` at shifts 0 to 150 (run 43826997913) and of `e60ea120`, the same code, at 200 to 350 (run 43843562286). */
const T555_0_150: SweepFigures = { alive: 19.75, grown: 7, hungry: 0, living: 972.5, deaths: 161.25, extinct: 1, needDeaths: 3 };
const T555_200_350: SweepFigures = { alive: 20, grown: 7, hungry: 0, living: 984, deaths: 125.5, extinct: 0.5, needDeaths: 1.25 };
/** Master `df68548f` at the same eight shifts (runs 43836845395 and 43843566973). */
const MASTER_0_150: SweepFigures = { alive: 19.75, grown: 7, hungry: 0.25, living: 1010, deaths: 137.25, extinct: 0.5, needDeaths: 2 };
const MASTER_200_350: SweepFigures = { alive: 20, grown: 7, hungry: 0, living: 969.5, deaths: 115.25, extinct: 1, needDeaths: 1.5 };

describe('T-555 the sweep reference', () => {
  it('is the standard shifts of T-555, and the best figures its eight-shift means', () => {
    expect(SWEEP_REFERENCE).toEqual(T555_0_150);
    const eight = poolSweeps([T555_0_150, T555_200_350]);
    expect({ living: eight.living, deaths: eight.deaths }).toEqual(SWEEP_MEASURED);
    expect(sweepCheck(SWEEP_REFERENCE).bounds).toEqual({ alive: 18, grown: 6, hungry: 1, living: 878.25, deaths: 173.38 });
  });

  it('both halves of T-555 and of master pass; master\'s eight shifts die 17.1 fewer a sweep', () => {
    for (const row of [T555_0_150, T555_200_350, MASTER_0_150, MASTER_200_350]) expect(sweepCheck(row).exceeded).toEqual([]);
    const master = poolSweeps([MASTER_0_150, MASTER_200_350]);
    expect({ living: master.living, deaths: master.deaths }).toEqual({ living: 989.75, deaths: 126.25 });
  });
});
