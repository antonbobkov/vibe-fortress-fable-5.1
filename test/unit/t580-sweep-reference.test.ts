/**
 * T-580: the sweep's reference and best figures are `2e36fb6d`'s (T-576's honest answer to ambushes and
 * T-580's work below ground or by the gate, with a watch and war dogs there, on master `0c2e88b7`). The
 * reference moved by decision: the dwarves an honest answer costs are the game's. The best figures are
 * the means of its eight shifts, as T-543 set them (reports/data/2026-11-17-t580-ambush-surface-work.md).
 */
import { describe, expect, it } from 'vitest';
import { poolSweeps, sweepCheck, SWEEP_MEASURED, SWEEP_REFERENCE, type SweepFigures } from '../perf/three_years_sweep';

/** The pooled rows of `2e36fb6d` at shifts 0 to 150 (run 44200076970) and 200 to 350 (run 44200119366). */
const T580_0_150: SweepFigures = { alive: 19.5, grown: 7, hungry: 0, living: 1010.5, deaths: 137, extinct: 1.75, needDeaths: 6.25 };
const T580_200_350: SweepFigures = { alive: 19.75, grown: 7, hungry: 0, living: 965, deaths: 126.75, extinct: 1.75, needDeaths: 6 };

describe('T-580 the sweep reference', () => {
  it('is the standard shifts of T-580, and the best figures its eight-shift means', () => {
    expect(SWEEP_REFERENCE).toEqual(T580_0_150);
    const eight = poolSweeps([T580_0_150, T580_200_350]);
    expect({ living: eight.living, deaths: eight.deaths }).toEqual(SWEEP_MEASURED);
    expect(sweepCheck(SWEEP_REFERENCE).bounds).toEqual({ alive: 18, grown: 6, hungry: 1, living: 887.75, deaths: 161.88 });
  });

  it('both halves of T-580 pass its bounds', () => {
    for (const row of [T580_0_150, T580_200_350]) expect(sweepCheck(row).exceeded).toEqual([]);
  });
});
