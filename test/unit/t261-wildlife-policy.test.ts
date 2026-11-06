import { describe, expect, it } from 'vitest';
import { distribution } from '../perf/wildlife_year_measurements';
import type { WildlifeDeath } from '../perf/wildlife_year_fixture';

const starved = (n: number): WildlifeDeath[] => Array.from({ length: n }, (_, i) => ({ tick: 1, day: 110, id: i + 1, kind: 'dwarf', name: '', cause: 'starvation',
  killerId: 0, killerSpecies: 'none', wildlife: false, tile: 0 }));

describe('T-261 annual policy guards the distribution rather than its single worst seed', () => {
  it('computes the second-lowest of twelve and the sum, and includes the wiped-out year in the median', () => {
    expect(distribution([0, 11, 10, 10, 10, 12, 13, 13, 15, 14, 15, 14].map((living) => ({ living, deaths: [] }))))
      .toMatchObject({ median: 12.5, worst: 0, secondWorst: 10, living: 137, extinct: 1, seeds: 12 });
  });
  it('T-509: counts a year with eleven starved as one starved year', () => {
    expect(distribution([{ living: 2, deaths: starved(11) }, { living: 12, deaths: [] }, { living: 9, deaths: starved(1) }]))
      .toMatchObject({ hungerThirstDeaths: 12, starvedYears: 2 });
  });
});
