import { describe, expect, it } from 'vitest';
import { distribution } from '../perf/wildlife_year_measurements';
import type { WildlifeDeath } from '../perf/wildlife_year_fixture';

function death(kind: string, cause: string, wildlife: boolean): WildlifeDeath {
  return { tick: 1200, day: 2, id: 1, kind, name: kind, cause, killerId: wildlife ? 2 : 0,
    killerSpecies: wildlife ? 'wolf' : 'none', wildlife, tile: 0 };
}

describe('T-136 wildlife distribution accounting', () => {
  it('includes extinction and averages the middle pair for an even number of years', () => {
    expect(distribution([0, 12, 10, 11].map((living) => ({ living, deaths: [] })))).toMatchObject({
      seeds: 4, median: 10.5, worst: 0, wildlifeFree: 4, extinct: 1, hungerThirstDeaths: 0,
    });
  });

  it('counts years without wildlife dwarf deaths, not years without livestock or other deaths', () => {
    expect(distribution([
      { living: 12, deaths: [death('dog', 'killed', true)] },
      { living: 11, deaths: [death('dwarf', 'bled_out', true)] },
      { living: 10, deaths: [death('dwarf', 'starvation', false), death('dwarf', 'dehydration', false)] },
    ])).toMatchObject({ seeds: 3, median: 11, worst: 10, wildlifeFree: 2, hungerThirstDeaths: 2 });
  });

  it('rejects an empty distribution instead of manufacturing a passing floor', () => {
    expect(() => distribution([])).toThrow('at least one year');
  });
});
