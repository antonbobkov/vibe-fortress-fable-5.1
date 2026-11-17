/**
 * T-569: a ±1 thought that decays by `halflife` lasts its hours (15 § Thoughts, Decay).
 *
 * Before, `currentValue` cut a halflife thought under 1 to 0, so a −1 row (`nettles`, `lab_stink`)
 * was gone at the first hourly recompute. Now a halflife thought keeps at least 1 (its whole value
 * when smaller) until its hours end, and is removed once under 1 after them.
 */
import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import { TICKS_PER_HOUR } from '@core/constants';
import { currentValue, type MoraleReader, type ThoughtDef } from '@systems/morale';
import { TestWorld } from '../../scenarios/test-world';

const thoughts = contentRegistry().table<ThoughtDef>('thoughts');
const at = (baseValue: number, def: ThoughtDef, hours: number): number =>
  currentValue({ thought: 0, startTick: 0, baseValue }, def, Math.round(hours * TICKS_PER_HOUR));

describe('T-569 small halflife thoughts', () => {
  const nettles = thoughts.byId('nettles')!;

  it('the −1 rows are halflife over 12 hours', () => {
    for (const id of ['nettles', 'lab_stink', 'drank_cactus', 'smoky_hall']) {
      expect(thoughts.byId(id), id).toMatchObject({ value: { formula: '−1' }, hours: 12, decay: 'halflife' });
    }
  });

  it('a −1 halflife thought holds −1 through its hours and is gone at their end', () => {
    for (const hours of [0, 1, 4, 6, 11, 11.9]) expect(at(-1, nettles, hours), `${hours} h`).toBe(-1);
    expect(at(-1, nettles, 12)).toBe(0);
    expect(at(-1, nettles, 30)).toBe(0);
  });

  it('a +1 halflife thought holds +1 through its hours and is gone at their end', () => {
    for (const hours of [0, 1, 4, 6, 11, 11.9]) expect(at(1, nettles, hours), `${hours} h`).toBe(1);
    expect(at(1, nettles, 12)).toBe(0);
  });

  it('a value under 1 (a stoic\'s halved −1) keeps its own value, not 1', () => {
    expect(at(-0.5, nettles, 0)).toBe(-0.5);
    expect(at(-0.5, nettles, 8)).toBe(-0.5);
    expect(at(-0.5, nettles, 12)).toBe(0);
  });

  it('a larger thought halves as before, is held at 1 to its hours, and runs past them while 1 or more', () => {
    const storm = thoughts.byId('caught_in_storm')!;                 // −4 over 12 hours: halves every 4
    expect(at(-4, storm, 4)).toBe(-2);
    expect(at(-4, storm, 8)).toBe(-1);
    expect(at(-4, storm, 10)).toBe(-1);                               // −0.71, held at −1
    expect(at(-4, storm, 12)).toBe(0);
    const friend = thoughts.byId('friend_died')!;                    // −15 over 336 hours: halves every 112
    expect(at(-16, friend, 112)).toBe(-8);
    expect(at(-15, friend, 400)).toBeCloseTo(-15 * 2 ** (-400 / 112), 10);
    expect(at(-15, friend, 440)).toBe(0);
  });

  it('a dwarf stung by nettles shows −1 in the mood panel six hours on, and not after twelve', () => {
    const w = new TestWorld({ seed: 't569-nettles', world: 'flat-test', embark: 'none' });
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, 32) });
    const trait = (id: string): number => contentRegistry().table('personality').index(id);
    // Three traits that do not scale a comfort thought, so the row's −1 is the dwarf's −1.
    w.game.world.entities.add(dwarf, C.Personality, { traits: [trait('brave'), trait('greedy'), trait('ascetic')] });
    w.step(1);
    w.game.world.emit({ type: 'Stung', id: dwarf, source: 'nettle' });
    w.step(1);
    const morale = w.readers.of<MoraleReader>('15');
    const nettle = (): number | undefined => morale.thoughts(dwarf).find((t) => t.id === 'nettles')?.value;
    expect(nettle()).toBe(-1);
    w.step(6 * TICKS_PER_HOUR);
    expect(nettle()).toBe(-1);
    w.step(6 * TICKS_PER_HOUR);
    expect(nettle()).toBeUndefined();
  });
});
