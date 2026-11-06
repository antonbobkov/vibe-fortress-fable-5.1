import { describe, expect, it } from 'vitest';
import { improvedMeasurements, measuredBounds, pool, regressionCheck, type Sample, type WildlifeFigures } from '../perf/wildlife_year_measurements';
import { WILDLIFE_TOLERANCE as TOL, WORSENED_SHARE } from '../perf/wildlife_year_constants';

const measured: WildlifeFigures = { median: 12.5, worst: 4, secondWorst: 9, living: 140, wildlifeFree: 7, extinct: 1, starvedYears: 2, hungerThirstDeaths: 12 };
const before: WildlifeFigures = { ...measured, wildlifeFree: 6.5 };
const sample = (living: number, starvedYears = 0): Sample => ({ median: 12, worst: 5, secondWorst: 9, living, wildlifeFree: 7, extinct: 0, hungerThirstDeaths: starvedYears * 10, starvedYears });

describe('T-137 annual regression policy, judged over pooled samples (T-509)', () => {
  it('T-509: pools the samples: means of the distribution figures, counts of extinct and starved years', () => {
    expect(pool([sample(140), sample(130, 1), { ...sample(120), extinct: 1, median: 11, worst: 0 }])).toEqual({
      samples: 3, median: 11.67, worst: 3.33, secondWorst: 9, living: 130, wildlifeFree: 7, extinct: 1, starvedYears: 1, hungerThirstDeaths: 10,
    });
    expect(() => pool([])).toThrow('at least one sample');
  });
  it('derives every bound from the best pooled figures and its tolerance', () => {
    expect(measuredBounds(measured)).toEqual({ median: 12.5 - TOL.median, living: 140 - TOL.living, wildlifeFree: 7 - TOL.wildlifeFree,
      extinct: 1 + TOL.extinct, starvedYears: 2 + TOL.starvedYears });
  });
  it.each([{ median: 12.5 - TOL.median }, { living: 140 - TOL.living }, { wildlifeFree: 7 - TOL.wildlifeFree }, { extinct: 1 + TOL.extinct }, { starvedYears: 2 + TOL.starvedYears }])(
    'allows one tolerated loss at its bound: %j', (change) => {
      expect(regressionCheck(measured, { ...measured, ...change }, measured).allowed).toBe(true);
    });
  it.each([{ median: 12.49 - TOL.median }, { living: 139.9 - TOL.living }, { wildlifeFree: 6.9 - TOL.wildlifeFree }, { extinct: 2 + TOL.extinct }, { starvedYears: 3 + TOL.starvedYears }])(
    'blocks a single violated bound: %j', (change) => {
      const check = regressionCheck(measured, { ...measured, ...change }, measured);
      expect(check.allowed).toBe(false);
      expect(check.exceeded).toEqual(Object.keys(change));
    });
  it('T-308: the worst, the second-worst and need deaths are reported, not guarded', () => {
    expect(regressionCheck(before, { ...before, worst: 0, secondWorst: 0, hungerThirstDeaths: 40 }, measured))
      .toMatchObject({ allowed: true, worsened: [], exceeded: [] });
  });
  it('T-509: a figure counts as worsened only past half its tolerance, and three together block', () => {
    const small = { median: before.median - WORSENED_SHARE * TOL.median, living: before.living - WORSENED_SHARE * TOL.living, wildlifeFree: before.wildlifeFree - WORSENED_SHARE * TOL.wildlifeFree };
    expect(regressionCheck(before, { ...before, ...small }, measured)).toMatchObject({ allowed: true, worsened: [] });
    const larger = { median: small.median - 0.1, living: small.living - 0.1, wildlifeFree: small.wildlifeFree - 0.1 };
    expect(regressionCheck(before, { ...before, ...larger }, measured))
      .toMatchObject({ allowed: false, worsened: ['median', 'living', 'wildlifeFree'], exceeded: [] });
    expect(regressionCheck(before, { ...before, median: larger.median, living: larger.living }, measured))
      .toMatchObject({ allowed: true, worsened: ['median', 'living'] });
  });
  it('compares simultaneous losses to the actual latest row, not a historical tolerated drop', () => {
    const latest = { ...before, median: before.median - TOL.median };
    expect(regressionCheck(latest, latest, measured)).toMatchObject({ allowed: true, worsened: [], exceeded: [] });
  });
  it('tightens every improved figure and preserves every bound when a figure falls', () => {
    const better = { median: 13, worst: 5, secondWorst: 10, living: 145, wildlifeFree: 8, extinct: 0, starvedYears: 1, hungerThirstDeaths: 3 };
    expect(improvedMeasurements(measured, better)).toEqual(better);
    expect(improvedMeasurements(measured, { median: 12, worst: 2, secondWorst: 8, living: 130, wildlifeFree: 6, extinct: 2, starvedYears: 4, hungerThirstDeaths: 30 })).toEqual(measured);
  });
});
