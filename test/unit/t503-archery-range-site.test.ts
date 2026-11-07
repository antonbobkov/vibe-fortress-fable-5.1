import { describe, expect, it } from 'vitest';
import type { BuildingsReader } from '@systems/buildings';
import { HALL_Z, setupThreeYearsFortress, threeYearsWorld } from '../scenarios/three_years_fortress';
import { checkDefenceWorks, createDefenceYear } from '../scenarios/defence_year_fortress';

/**
 * T-503: on `defence-year-6` at cadence 25 a zone took the archery target's tile while the target was
 * being set up, and the script then zoned the range over it: `CreateZone rejected (overlap)` stopped the
 * run. The script now takes such a target down, to set it up again on a free site.
 */
describe('T-503 the archery range never overlaps another zone', () => {
  it('a target whose tile another zone took comes down instead of the range being refused', () => {
    const w = threeYearsWorld('defence-year', 2, 'none', 0);
    const fortress = setupThreeYearsFortress(w);
    const state = createDefenceYear(w, fortress);
    checkDefenceWorks(w, state);
    // A finished target in a room of its own, whose tile a stockpile has taken meanwhile.
    const x = fortress.cx + 14;
    const y = fortress.cy + 14;
    w.digRoom(x - 1, y - 1, HALL_Z, 3, 3);
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) w.discover(w.index(x + dx, y + dy, HALL_Z));
    const origin = w.index(x, y, HALL_Z);
    const target = w.build('archery_target', origin);
    w.zone('stockpile', [origin]);
    state.archeryTargetId = target;
    expect(() => checkDefenceWorks(w, state)).not.toThrow();
    expect(state.archeryTargetId).toBe(0);
    expect(state.archeryRangeZoneId).toBe(0);
    expect(w.readers.of<BuildingsReader>('14').zone(w.readers.of<BuildingsReader>('14').zoneAt(origin))?.type).toBe('stockpile');
    expect(w.readers.of<BuildingsReader>('14').get(target)?.settings['deconstruct'], 'the target is to come down').toBe(true);
    expect(state.notes.at(-1)).toContain('archery target');
  });
});
