/**
 * T-574: the sweep's reference and best figures are `d79a1f4f`'s (a cached route joined at its tile
 * nearest the requester, 22 § Path cache, on master `baf8da3d`). The best figures are the means of its
 * eight shifts, as T-543 set them (reports/data/2026-11-16-t574-ambush-day-297.md).
 */
import { describe, expect, it } from 'vitest';
import { poolSweeps, sweepCheck, type SweepFigures } from '../perf/three_years_sweep';

/** The tolerances these bounds were set with, before T-662 narrowed the living's. */
const T513_TOLERANCE = { living: 100, deaths: 30 };

/** T-574's reference and best figures, since moved by T-580 (t580-sweep-reference.test.ts). */
const T574_REFERENCE: SweepFigures = { alive: 20, grown: 7, hungry: 0, living: 1070.25, deaths: 109.5, extinct: 0.5, needDeaths: 1 };
const T574_MEASURED = { living: 1075.25, deaths: 100 };

/** The pooled rows of `d79a1f4f` at shifts 0 to 150 (run 43869964046) and 200 to 350 (run 43878798775). */
const T574_0_150: SweepFigures = { alive: 20, grown: 7, hungry: 0, living: 1070.25, deaths: 109.5, extinct: 0.5, needDeaths: 1 };
const T574_200_350: SweepFigures = { alive: 20, grown: 7, hungry: 0, living: 1080.25, deaths: 90.5, extinct: 0.25, needDeaths: 0 };
/** T-555 (`4b9c52f9` and `e60ea120`) at the same eight shifts (runs 43826997913 and 43843562286). */
const T555_0_150: SweepFigures = { alive: 19.75, grown: 7, hungry: 0, living: 972.5, deaths: 161.25, extinct: 1, needDeaths: 3 };
const T555_200_350: SweepFigures = { alive: 20, grown: 7, hungry: 0, living: 984, deaths: 125.5, extinct: 0.5, needDeaths: 1.25 };

describe('T-574 the sweep reference', () => {
  it('is the standard shifts of T-574, and the best figures its eight-shift means', () => {
    expect(T574_REFERENCE).toEqual(T574_0_150);
    const eight = poolSweeps([T574_0_150, T574_200_350]);
    expect({ living: eight.living, deaths: eight.deaths }).toEqual(T574_MEASURED);
    expect(sweepCheck(T574_REFERENCE, T574_MEASURED, T513_TOLERANCE).bounds).toEqual({ alive: 18, grown: 6, hungry: 1, living: 975.25, deaths: 130 });
  });

  it('both halves of T-574 pass; T-555\'s eight shifts lived 97 fewer and died 43.38 more a sweep', () => {
    for (const row of [T574_0_150, T574_200_350]) expect(sweepCheck(row, T574_MEASURED, T513_TOLERANCE).exceeded).toEqual([]);
    const before = poolSweeps([T555_0_150, T555_200_350]);
    const after = poolSweeps([T574_0_150, T574_200_350]);
    expect(after.living - before.living).toBeCloseTo(97, 2);
    expect(after.deaths - before.deaths).toBeCloseTo(-43.38, 2);
  });
});
