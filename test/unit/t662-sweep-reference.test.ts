/**
 * T-662: under T-652's fixed immigration rolls the sweep's living is about half as noisy as when each
 * shift drew its own rolls, so its tolerance narrows to 80; the deaths' noise is the timeline's and keeps
 * 30. The reference and best figures are master `f83df33f`'s (T-680) eight shifts, as T-543 set them
 * (reports/data/2026-11-22-t662-sweep-noise.md).
 */
import { describe, expect, it } from 'vitest';
import {
  poolSweeps, sweepCheck, sweepTrace, SWEEP_MEASURED, SWEEP_REFERENCE, SWEEP_TOLERANCE, type SweepFigures,
} from '../perf/three_years_sweep';

/** The pooled rows of `f83df33f` at shifts 0 to 150 (run 45005780661) and 200 to 350 (run 45005782771). */
const T662_0_150: SweepFigures = { alive: 20, grown: 7, hungry: 0, living: 1151.75, deaths: 98.25, extinct: 0, needDeaths: 0 };
const T662_200_350: SweepFigures = { alive: 20, grown: 7, hungry: 0, living: 1101.5, deaths: 106.75, extinct: 0.5, needDeaths: 0 };
/** Master's codes around it at shifts 0 to 150: T-676 (44966730312), T-675 (44975306609) and T-681 (44996870138). */
const NEAR: SweepFigures[] = [
  { alive: 20, grown: 7, hungry: 0, living: 1116.25, deaths: 112.5, extinct: 0.5, needDeaths: 0 },
  { alive: 20, grown: 7, hungry: 0, living: 1189, deaths: 97.75, extinct: 0, needDeaths: 0 },
  { alive: 20, grown: 7, hungry: 0, living: 1137.75, deaths: 120.25, extinct: 0, needDeaths: 0 },
];

describe('T-662 the sweep reference under fixed rolls', () => {
  it('is the standard shifts of f83df33f, the best figures its eight-shift means, the living tolerance 80', () => {
    expect(SWEEP_REFERENCE).toEqual(T662_0_150);
    const eight = poolSweeps([T662_0_150, T662_200_350]);
    expect({ living: eight.living, deaths: eight.deaths }).toEqual(SWEEP_MEASURED);
    expect(SWEEP_TOLERANCE).toEqual({ living: 80, deaths: 30 });
    expect(sweepCheck(SWEEP_REFERENCE).bounds).toEqual({ alive: 18, grown: 6, hungry: 1, living: 1046.63, deaths: 132.5 });
  });

  it('passes both halves and the codes around it, none of them worth tracing', () => {
    for (const row of [T662_0_150, T662_200_350, ...NEAR]) {
      expect(sweepCheck(row).exceeded).toEqual([]);
      expect(sweepTrace(row)).toEqual([]);
    }
  });

  it('flags a pooled figure about twice the noise from the best figures as worth tracing', () => {
    expect(sweepTrace({ ...T662_0_150, deaths: 125 })).toEqual(['dwarf deaths (125, 22.5 over the best)']);
    expect(sweepTrace({ ...T662_0_150, deaths: 124.75 })).toEqual([]);
    expect(sweepTrace({ ...T662_0_150, living: 1061.63 })).toEqual(['living at year 3 (1061.63, 65 under the best)']);
  });
});
