import { describe, expect, it } from 'vitest';
import { improvedMeasurements, measuredBounds, regressionCheck, type WildlifeFigures } from '../perf/wildlife_year_measurements';

const measured: WildlifeFigures = { median: 12.5, worst: 3, wildlifeFree: 8, extinct: 0, hungerThirstDeaths: 2 };
const before = { ...measured, wildlifeFree: 7 };

describe('T-137 annual regression policy', () => {
  it('derives tolerance floors while retaining strict worst-seed, extinction and need-death bounds', () => {
    expect(measuredBounds(measured)).toEqual({ median: 11.5, worst: 3, wildlifeFree: 6, extinct: 0, hungerThirstDeaths: 2 });
  });
  it('accepts the measured cure correction, including its improved minimum and extinction count', () => {
    const old = { ...measured, worst: 0, wildlifeFree: 8, extinct: 1 };
    expect(regressionCheck(old, before, old)).toMatchObject({ allowed: true, worsened: ['wildlifeFree'], exceeded: [] });
    expect(improvedMeasurements(old, before)).toEqual(measured);
  });
  it.each([{ median: 11.5 }, { wildlifeFree: 6 }])('allows one tolerated loss at its boundary: %j', change => {
    expect(regressionCheck(before, { ...before, ...change }, measured).allowed).toBe(true);
  });
  it.each([{ median: 11.49 }, { wildlifeFree: 5 }, { worst: 2 }, { extinct: 1 }, { hungerThirstDeaths: 3 }])('blocks a single violated bound: %j', change => {
    const check = regressionCheck(before, { ...before, ...change }, measured);
    expect(check.allowed).toBe(false);
    expect(check.exceeded).toEqual(Object.keys(change));
  });
  it('blocks two losses together even though both are inside their tolerances', () => {
    expect(regressionCheck(before, { ...before, median: 11.5, wildlifeFree: 6 }, measured))
      .toMatchObject({ allowed: false, worsened: ['median', 'wildlifeFree'], exceeded: [] });
  });
  it('compares simultaneous losses to the actual latest row, not a historical tolerated drop', () => {
    expect(regressionCheck(before, { ...before, median: 12 }, measured))
      .toMatchObject({ allowed: true, worsened: ['median'], exceeded: [] });
  });
  it('tightens every improved figure and preserves every bound when a figure falls', () => {
    expect(improvedMeasurements(measured, { median: 13, worst: 4, wildlifeFree: 9, extinct: 0, hungerThirstDeaths: 1 }))
      .toEqual({ median: 13, worst: 4, wildlifeFree: 9, extinct: 0, hungerThirstDeaths: 1 });
    expect(improvedMeasurements(measured, { median: 12, worst: 2, wildlifeFree: 7, extinct: 1, hungerThirstDeaths: 3 })).toEqual(measured);
  });
});
