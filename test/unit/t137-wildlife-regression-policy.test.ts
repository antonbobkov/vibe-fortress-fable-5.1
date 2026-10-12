import { describe, expect, it } from 'vitest';
import { improvedMeasurements, measuredBounds, regressionCheck, type WildlifeFigures } from '../perf/wildlife_year_measurements';

const measured: WildlifeFigures = { median: 12.5, worst: 3, secondWorst: 10, wildlifeFree: 8, extinct: 0, hungerThirstDeaths: 2 };
const before = { ...measured, wildlifeFree: 7 };

describe('T-137 annual regression policy', () => {
  it('T-261: derives the decided second-worst, extinction and need-death tolerance bounds', () => {
    expect(measuredBounds(measured)).toEqual({ median: 11.5, secondWorst: 8, wildlifeFree: 6, extinct: 1, hungerThirstDeaths: 3 });
  });
  it('accepts the measured cure correction, including its improved minimum and extinction count', () => {
    const old = { ...measured, worst: 0, wildlifeFree: 8, extinct: 1 };
    expect(regressionCheck(old, before, old)).toMatchObject({ allowed: true, worsened: ['wildlifeFree'], exceeded: [] });
    expect(improvedMeasurements(old, before)).toEqual(measured);
  });
  it.each([{ median: 11.5 }, { wildlifeFree: 6 }])('allows one tolerated loss at its boundary: %j', change => {
    expect(regressionCheck(before, { ...before, ...change }, measured).allowed).toBe(true);
  });
  it.each([{ median: 11.49 }, { wildlifeFree: 5 }, { secondWorst: 7 }, { extinct: 2 }, { hungerThirstDeaths: 4 }])('blocks a single violated bound: %j', change => {
    const check = regressionCheck(before, { ...before, ...change }, measured);
    expect(check.allowed).toBe(false);
    expect(check.exceeded).toEqual(Object.keys(change));
  });
  it('T-261: allows two losses together when both are inside their tolerances', () => {
    expect(regressionCheck(before, { ...before, median: 11.5, wildlifeFree: 6 }, measured))
      .toMatchObject({ allowed: true, worsened: ['median', 'wildlifeFree'], exceeded: [] });
  });
  it('compares simultaneous losses to the actual latest row, not a historical tolerated drop', () => {
    expect(regressionCheck(before, { ...before, median: 12 }, measured))
      .toMatchObject({ allowed: true, worsened: ['median'], exceeded: [] });
  });
  it('tightens every improved figure and preserves every bound when a figure falls', () => {
    expect(improvedMeasurements(measured, { median: 13, worst: 4, secondWorst: 11, wildlifeFree: 9, extinct: 0, hungerThirstDeaths: 1 }))
      .toEqual({ median: 13, worst: 4, secondWorst: 11, wildlifeFree: 9, extinct: 0, hungerThirstDeaths: 1 });
    expect(improvedMeasurements(measured, { median: 12, worst: 2, secondWorst: 9, wildlifeFree: 7, extinct: 1, hungerThirstDeaths: 3 })).toEqual(measured);
  });
});
