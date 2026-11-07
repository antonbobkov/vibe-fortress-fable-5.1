/** T-513: the twenty-seed sweep's set rule and bounds, read over pooled shifted sweeps. */
import { describe, expect, it } from 'vitest';
import {
  poolSweeps, sweepCheck, sweepFigures, SWEEP_MEASURED, SWEEP_REFERENCE, SWEEP_SHIFTS, SWEEP_TOLERANCE, type SweepSeedRow,
} from '../perf/three_years_sweep';

const seeds: SweepSeedRow[] = [0, 2, 4].flatMap((peril) => [...Array(peril === 4 ? 6 : 7).keys()].map((i) => ({
  seed: `three-years-p${peril}-${i + 1}`, peril, y1: 14, y3: 45, deaths: 7, needDeaths: 0, extinctDay: null,
})));
const withSeed = (seed: string, change: Partial<SweepSeedRow>): SweepSeedRow[] => seeds.map((r) => (r.seed === seed ? { ...r, ...change } : r));

describe('T-513 the sweep verdict', () => {
  it('counts one sweep as the set rule does', () => {
    const rows = withSeed('three-years-p0-3', { needDeaths: 4 }).map((r) => (r.seed === 'three-years-p4-2' ? { ...r, y1: 0, y3: 0, extinctDay: 60 } : r))
      .map((r) => (r.seed === 'three-years-p0-6' ? { ...r, y3: 7 } : r));
    expect(sweepFigures(rows)).toEqual({ alive: 19, grown: 6, hungry: 1, living: 45 * 18 + 7, deaths: 140, extinct: 1, needDeaths: 4 });
  });

  it('pools four sweeps 50 ticks apart into means', () => {
    expect(SWEEP_SHIFTS).toEqual([0, 50, 100, 150]);
    const a = sweepFigures(seeds);
    const b = sweepFigures(withSeed('three-years-p0-1', { needDeaths: 2, y3: 30, deaths: 22 }));
    expect(poolSweeps([a, a, a, b])).toEqual({ alive: 20, grown: 7, hungry: 0.25, living: 896.25, deaths: 143.75, extinct: 0, needDeaths: 0.5 });
  });

  it('passes the reference and blocks a pooled set rule or bound that fails', () => {
    expect(sweepCheck(SWEEP_REFERENCE)).toEqual({ allowed: true, exceeded: [], bounds: {
      alive: 18, grown: 6, hungry: 1, living: SWEEP_MEASURED.living - SWEEP_TOLERANCE.living, deaths: SWEEP_MEASURED.deaths + SWEEP_TOLERANCE.deaths } });
    // One peril-0 fortress starving in every timeline is the set rule's allowance; a second in one of four is not.
    expect(sweepCheck({ ...SWEEP_REFERENCE, hungry: 1 }).allowed).toBe(true);
    expect(sweepCheck({ ...SWEEP_REFERENCE, hungry: 1.25 }).exceeded).toEqual(['peril-0 with need deaths']);
    expect(sweepCheck({ ...SWEEP_REFERENCE, alive: 17.75, grown: 5.75 }).exceeded).toEqual(['alive at year 1', 'peril-0 grown']);
    expect(sweepCheck({ ...SWEEP_REFERENCE, living: SWEEP_MEASURED.living - 101, deaths: SWEEP_MEASURED.deaths + 31 }).exceeded)
      .toEqual(['living at year 3', 'dwarf deaths']);
  });
});
