/**
 * T-767: the needs-met floor gives way only to a need past its margin (15 § Mood). Hunger, thirst
 * or rest under halfway from its want threshold to its critical one is the ordinary daily cycle:
 * the thought still counts twice in the raw mood, but the floor holds at 20. `lonely`, whose need
 * has no critical threshold, lowers the floor as before.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Needs } from '@core/components';
import { TICKS_PER_HOUR } from '@core/constants';
import { moodValue, type MoraleReader } from '@systems/morale';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

/** Yrsa of the T-763 probe: restless, sensitive, timid (base −6): bored and restless weigh −10.4 each. */
function yrsa(w: TestWorld): number {
  const id = w.spawnDwarf({ at: w.index(10, 10, Z), name: 'Yrsa Copperpick' });
  const p = w.game.registry.table('personality');
  w.game.world.entities.add(id, C.Personality, { traits: [p.index('restless'), p.index('sensitive'), p.index('timid')] as never });
  return id;
}

/** Hold the dwarf's needs for an hour, set again each tick, so the hour's recomputation sees them. */
function holdHour(w: TestWorld, id: number, needs: Partial<Needs>): void {
  for (let t = 0; t < TICKS_PER_HOUR; t += 1) {
    w.game.world.entities.add(id, C.Needs, { hunger: 0, thirst: 0, rest: 0, social: 0, comfort: 0, purpose: 0, joy: 0, ...needs });
    w.step(1);
  }
}

describe('T-767 the needs-met floor and its margin', () => {
  it('pressure marked off the floor still counts twice in the raw mood but leaves the floor at 20', () => {
    // −3.6 of need pressure: raw 55 − 100→35 − 3 − 6 = 11; the floor without it 20, with it 17.
    expect(moodValue([{ value: -3.6, need: true, floor: false }, { value: -100 }], 0, -6)).toBe(20);
    expect(moodValue([{ value: -3.6, need: true, floor: true }, { value: -100 }], 0, -6)).toBe(17);
    expect(moodValue([{ value: -3.6, need: true }, { value: -100 }], 0, -6)).toBe(17);      // `floor` defaults to `need`
    // Above the floor the raw mood is unchanged: −10 counts twice either way.
    expect(moodValue([{ value: -10, need: true, floor: false }], 0, 0)).toBe(35);
  });

  it('a gloomy dwarf a little thirsty or tired stays Unhappy; past halfway to critical it is Miserable', () => {
    const w = new TestWorld({ seed: 't767-floor', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    w.forceWeather('clear');
    const id = yrsa(w);
    const morale = w.readers.of<MoraleReader>('15');
    const gloomy = { comfort: 100, purpose: 100, joy: 100 };
    for (let h = 0; h < 2; h += 1) holdHour(w, id, gloomy);
    expect(morale.mood(id)).toBeGreaterThanOrEqual(20);
    // Thirst 65 (want 50, critical 85: under 67.5) and rest 70 (want 60, critical 90: under 75).
    holdHour(w, id, { ...gloomy, thirst: 65 });
    expect(morale.thoughts(id).some((t) => t.id === 'thirsty')).toBe(true);
    expect(morale.mood(id)).toBe(20);
    expect(morale.tier(id)).toBe(1);
    holdHour(w, id, { ...gloomy, rest: 70 });
    expect(morale.thoughts(id).some((t) => t.id === 'tired')).toBe(true);
    expect(morale.mood(id)).toBe(20);
    // Both at once are still each under their margin: the floor holds.
    holdHour(w, id, { ...gloomy, thirst: 65, rest: 70 });
    expect(morale.mood(id)).toBe(20);
    // Thirst 75 is past halfway: the floor gives way to it.
    holdHour(w, id, { ...gloomy, thirst: 75 });
    expect(morale.mood(id)).toBeLessThan(20);
    expect(morale.tier(id)).toBe(0);
  });

  it('lonely lowers the floor as before, having no critical threshold', () => {
    const w = new TestWorld({ seed: 't767-lonely', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    w.forceWeather('clear');
    const id = yrsa(w);
    const morale = w.readers.of<MoraleReader>('15');
    for (let h = 0; h < 2; h += 1) holdHour(w, id, { comfort: 100, purpose: 100, joy: 100, social: 70 });
    expect(morale.thoughts(id).some((t) => t.id === 'lonely')).toBe(true);
    expect(morale.mood(id)).toBeLessThan(20);
  });
});
