/** T-652: the season's immigration roll is drawn on a stream of its own (21 § Evaluation). */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import type { MoodTier } from '@core/types';
import type { MoraleSystem } from '@systems/morale';
import type { ImmigrationSystem } from '@systems/immigration';
import type { ImmigrationReader } from '@systems/immigration/reader';
import { IMMIGRATION_PERMILLE } from '@systems/immigration/constants';
import { seasonRoll } from '@systems/immigration/waves';
import { TestWorld } from '../../scenarios/test-world';

const YEAR_TWO_SUMMER = (112 + 28) * TICKS_PER_DAY;

/** The hall spirit eligible (60), at the given tier, which sizes the wave (21 § Wave size). */
function setSpirit(w: TestWorld, tier: MoodTier): void {
  const morale = w.game.world.scheduler.byId('15') as MoraleSystem;
  morale.deserialize({ ...morale.serialize(), hallSpirit: 60, hallSpiritTier: tier }, {
    world: w.game.world, registry: w.game.registry, rng: w.game.world.rngFor('15'),
    readers: w.readers, register: w.game.world.registrations,
  });
}

/** Seven dwarves and gold enough that a second wave is not refused for wealth, a tick before summer of year 2. */
function fortress(seed: string): TestWorld {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: YEAR_TWO_SUMMER - 2 });
  for (let n = 0; n < 7; n += 1) w.spawnDwarf();
  for (let x = 4; x < 8; x += 1) w.spawnItem('bar', 'gold', w.index(x, 12, Z), 10);
  return w;
}

/** Plays the summer wave at the tier given, then evaluates autumn: the autumn outcome, the wave's size and 21's own stream. */
function play(seed: string, summerTier: MoodTier): { size: number; autumn: string | null; rng: unknown } {
  const w = fortress(seed);
  w.step(1);
  setSpirit(w, summerTier);
  w.until((world) => world.events('ImmigrantsArrived').length > 0, 600);
  const size = Number(w.events('ImmigrantsArrived')[0]?.['count']);
  const im = w.game.world.scheduler.byId('21') as ImmigrationSystem;
  const rng = im.serialize().rng;
  setSpirit(w, 2);
  expect(w.readers.of<ImmigrationReader>('21').eligibility()).toEqual({ eligible: true, reasons: [], guaranteed: false });
  const waves = im.serialize().wavesSoFar;
  w.game.world.emit({ type: 'SeasonChanged', season: 2, year: 2 });
  w.step(1);
  const autumn = im.serialize().wavesSoFar > waves ? 'wave' : w.readers.of<ImmigrationReader>('21').lastSkipReason();
  return { size, autumn, rng };
}

describe('T-652 the season roll on a stream of its own', () => {
  it('is fixed by the world seed, the year and the season alone, with the stated chance over seeds', () => {
    expect(seasonRoll('t652', 2, 1)).toBe(seasonRoll('t652', 2, 1));
    let waves = 0;
    for (let n = 1; n <= 400; n += 1) if (seasonRoll(`t652-${n}`, 2, 1) < IMMIGRATION_PERMILLE) waves += 1;
    expect(waves).toBeGreaterThanOrEqual(250);
    expect(waves).toBeLessThanOrEqual(310);
    const rolls = new Set([1, 2, 3, 4].flatMap((year) => [0, 1, 2, 3].map((season) => seasonRoll('t652', year, season))));
    expect(rolls.size).toBeGreaterThan(12);
  });

  it('a wave of another size leaves the next season\'s roll unchanged', () => {
    // One seed whose autumn roll brings a wave and one whose autumn roll fails, both after a summer wave.
    const seeds: string[] = [];
    for (const wave of [true, false]) {
      for (let n = 1; n <= 200; n += 1) {
        const seed = `t652-wave-${n}`;
        if (seasonRoll(seed, 2, 1) < IMMIGRATION_PERMILLE && (seasonRoll(seed, 2, 2) < IMMIGRATION_PERMILLE) === wave) { seeds.push(seed); break; }
      }
    }
    expect(seeds).toHaveLength(2);
    for (const seed of seeds) {
      const small = play(seed, 2);
      const large = play(seed, 4);
      expect(large.size).toBeGreaterThan(small.size);
      // The two plans drew differently on 21's stream ...
      expect(large.rng).not.toEqual(small.rng);
      // ... and autumn's roll is the same in both.
      const expected = seasonRoll(seed, 2, 2) < IMMIGRATION_PERMILLE ? 'wave' : 'luck';
      expect(small.autumn).toBe(expected);
      expect(large.autumn).toBe(expected);
    }
  });
});
