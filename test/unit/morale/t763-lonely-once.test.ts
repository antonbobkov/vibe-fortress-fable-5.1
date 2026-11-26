/**
 * T-763: `lonely` counts once, as a thought, and not as need pressure (15 § Mood). A busy first
 * week with nowhere to talk makes a gregarious dwarf gloomier, not miserable; hunger, thirst and
 * tiredness still take a dwarf below 20.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Needs } from '@core/components';
import { TICKS_PER_HOUR } from '@core/constants';
import { moodValue, type MoraleReader } from '@systems/morale';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

/** Ulfar of the playtest: sensitive, gregarious, patient (base −3, `lonely` × 2 × 1.3). */
function ulfar(w: TestWorld): number {
  const id = w.spawnDwarf({ at: w.index(10, 10, Z), name: 'Ulfar Ironfist' });
  const p = w.game.registry.table('personality');
  w.game.world.entities.add(id, C.Personality, { traits: [p.index('sensitive'), p.index('gregarious'), p.index('patient')] as never });
  return id;
}

/** Hold the dwarf's needs for an hour, set again each tick, so the hour's recomputation sees them. */
function holdHour(w: TestWorld, id: number, needs: Partial<Needs>): void {
  for (let t = 0; t < TICKS_PER_HOUR; t += 1) {
    w.game.world.entities.add(id, C.Needs, { hunger: 0, thirst: 0, rest: 0, social: 0, comfort: 0, purpose: 0, joy: 0, ...needs });
    w.step(1);
  }
}

describe('T-763 lonely counts once', () => {
  it('a lonely thought is a negative but not need pressure', () => {
    // As a pressure thought the −10 would count twice (35); as an ordinary negative, once (45).
    expect(moodValue([{ value: -10, need: false }], 0, 0)).toBe(45);
    // With every survival need met the floor holds at 20, however lonely and gloomy the dwarf.
    expect(moodValue([{ value: -13, need: false }, { value: -100 }], 0, -3)).toBe(20);
  });

  it('a gregarious dwarf with no one to talk to and nowhere to sit is Unhappy, not Miserable', () => {
    const w = new TestWorld({ seed: 't763-lonely', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    w.forceWeather('clear');
    const id = ulfar(w);
    const morale = w.readers.of<MoraleReader>('15');
    for (let h = 0; h < 3; h += 1) holdHour(w, id, { social: 100, comfort: 100, joy: 100 });
    const lonely = morale.thoughts(id).find((t) => t.id === 'lonely');
    expect(lonely?.value).toBeCloseTo(-13, 5);
    expect(morale.mood(id)).toBeGreaterThanOrEqual(20);
    expect(morale.tier(id)).toBe(1);
    // Thirst is still neglect: the same dwarf, thirsty, falls below 20.
    for (let h = 0; h < 2; h += 1) holdHour(w, id, { social: 100, comfort: 100, joy: 100, thirst: 90 });
    expect(morale.mood(id)).toBeLessThan(20);
    expect(morale.tier(id)).toBe(0);
  });
});
