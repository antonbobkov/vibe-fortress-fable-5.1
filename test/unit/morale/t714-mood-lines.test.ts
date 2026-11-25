/**
 * T-714: "X is miserable." no longer repeats several times a day (`reports/data/2026-11-24-playtest-2.md`,
 * finding 1). The miserable line names its reasons and a day's are one line, each dwarf named once
 * however often its mood dips below 20 (15 § Registrations; the simulation's tier is unchanged); and
 * the restless dead fall to dust at dawn (17 § Registrations). T-731: the line keeps its string key.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { MoraleReader } from '@systems/morale';
import { AnnouncementLog } from '@ui/announcements';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from '../ui/ui-fixture';

const Z = FLAT_TEST_SURFACE_Z;

function world(seed: string): TestWorld {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  w.forceWeather('clear');
  return w;
}

/** A dwarf with three traits that scale no need thought and add no base (ascetic, greedy, messy). */
function plainDwarf(w: TestWorld, name: string, x: number): number {
  const id = w.spawnDwarf({ at: w.index(x, 10, Z), name });
  w.game.world.entities.get(id, C.Creature)!.name = name;
  const p = w.game.registry.table('personality');
  w.game.world.entities.add(id, C.Personality, { traits: [p.index('ascetic'), p.index('greedy'), p.index('messy')] as never });
  return id;
}

type NeedValues = { hunger?: number; thirst?: number; rest?: number; comfort?: number };

/** Hold dwarves' needs for an hour, set again each tick, so the hour's recomputation sees them. */
function holdHour(w: TestWorld, needs: ReadonlyMap<number, NeedValues>): void {
  for (let t = 0; t < TICKS_PER_HOUR; t += 1) {
    for (const [id, values] of needs) {
      w.game.world.entities.add(id, C.Needs, { hunger: 0, thirst: 0, rest: 0, social: 0, comfort: 0, purpose: 0, joy: 0, ...values });
    }
    w.step(1);
  }
}

function announcer(w: TestWorld): AnnouncementLog {
  const log = new AnnouncementLog(strings, w.game.registry);
  log.register(w.game.world.registrations.announcements);
  return log;
}

/**
 * Hunger 95 is `hungry` −9; thirst adds the rest, so the need thoughts sum to `n` and need pressure is
 * floor(n): mood = 55 − n − floor(n). These give moods of about 18.5, 20.5, 22.5, 24.5, 26.5 and 30.5.
 */
const THIRST_FOR = { 18.5: 97.5, 20.5: 92.5, 22.5: 87.5, 24.5: 82.5, 26.5: 77.5, 30.5: 67.5 } as const;

describe('T-714 a mood that hovers about 20 is told once a day', () => {
  it('a dwarf whose mood moves 19, 21, 19, 22 through a day falls to Miserable again and again, and the log has one line', () => {
    const w = world('t714-hover');
    const id = plainDwarf(w, 'Dagny Goldstone', 10);
    const morale = w.readers.of<MoraleReader>('15');
    const log = announcer(w);
    const told: GameEvent[] = [];
    w.game.world.onEvents((events) => {
      for (const e of events) if (e.type === 'MoodTierChanged') { told.push(e); log.announce(e, w.readers, w.tick); }
    });
    const hour = (mood: keyof typeof THIRST_FOR): number => {
      holdHour(w, new Map([[id, { hunger: 95, thirst: THIRST_FOR[mood] }]]));
      expect(morale.mood(id)).toBeCloseTo(mood, 0);
      return morale.tier(id);
    };
    expect(hour(30.5)).toBe(1);
    // Twenty hours of hovering about the bound, as needs rise and fall, within the first day.
    const tiers: number[] = [];
    for (let k = 0; k < 5; k += 1) for (const mood of [18.5, 20.5, 18.5, 22.5] as const) tiers.push(hour(mood));
    expect(w.tick).toBeLessThan(TICKS_PER_DAY);
    // The simulation reads the plain band each hour: the tier flips with the mood.
    expect(tiers).toEqual(Array.from({ length: 5 }, () => [0, 1, 0, 1]).flat());
    expect(told.filter((e) => e['to'] === 0)).toHaveLength(10);
    // The announcer names the dwarf once that day.
    const lines = log.lines.filter((l) => l.text.includes('miserable'));
    expect(lines).toHaveLength(1);
    expect(lines[0]?.count).toBe(1);
    expect(lines[0]?.text).toBe('Dagny Goldstone is miserable: "I am thirsty. I am hungry."');
  });
});

describe('T-714 the miserable line names its reasons, and a day\'s are one line', () => {
  it('names the three strongest negative thoughts; a second fall the same day is not announced; a new day starts a new line', () => {
    const w = world('t714-line');
    const asa = plainDwarf(w, 'Asa Forgehall', 10);
    const njal = plainDwarf(w, 'Njal Asheye', 12);
    // Asa: hungry −9, thirsty −8, tired −3, uncomfortable −2. Njal: thirsty −9, tired −4.
    holdHour(w, new Map([[asa, { hunger: 95, thirst: 90, rest: 75, comfort: 75 }], [njal, { thirst: 95, rest: 80 }]]));
    const log = announcer(w);
    const fall = (id: number, tick: number) => log.announce({ type: 'MoodTierChanged', id, from: 1, to: 0 } as GameEvent, w.readers, tick);
    const day = 5 * TICKS_PER_DAY;
    const first = fall(asa, day + 10);
    expect(first?.line.text).toBe('Asa Forgehall is miserable: "I am hungry. I am thirsty. I am tired."');
    expect(first?.line.severity).toBe('note');
    expect(first?.focus).toBe(w.index(10, 10, Z));
    // The second dwarf of the day joins the line; the reasons weighing most over both.
    expect(fall(njal, day + 400)?.line.text).toBe('2 dwarves are miserable: Asa, Njal. "I am thirsty. I am hungry. I am tired."');
    // A second fall of a dwarf already named today makes no line.
    expect(fall(asa, day + 900)).toBeNull();
    expect(log.lines.filter((l) => l.text.includes('miserable'))).toHaveLength(1);
    // Another day, another line.
    expect(fall(njal, day + TICKS_PER_DAY + 10)?.line.text).toBe('Njal Asheye is miserable: "I am thirsty. I am tired."');
    expect(log.lines.filter((l) => l.text.includes('miserable'))).toHaveLength(2);
  });

  it('only a fall to Miserable is announced', () => {
    const w = world('t714-only-miserable');
    const asa = plainDwarf(w, 'Asa Forgehall', 10);
    const log = announcer(w);
    expect(log.announce({ type: 'MoodTierChanged', id: asa, from: 2, to: 1 } as GameEvent, w.readers, 100)).toBeNull();
    expect(log.announce({ type: 'MoodTierChanged', id: asa, from: 0, to: 1 } as GameEvent, w.readers, 100)).toBeNull();
  });
});

describe('T-731 the miserable line keeps its string key', () => {
  it('announce.mood_tier_why for one dwarf, announce.mood_tier_many_why once a second joins it', () => {
    const w = world('t731-key');
    const asa = plainDwarf(w, 'Asa Forgehall', 10);
    const njal = plainDwarf(w, 'Njal Asheye', 12);
    holdHour(w, new Map([[asa, { hunger: 95, thirst: 90 }], [njal, { thirst: 95 }]]));
    const log = announcer(w);
    const fall = (id: number, tick: number) => log.announce({ type: 'MoodTierChanged', id, from: 1, to: 0 } as GameEvent, w.readers, tick);
    const day = 5 * TICKS_PER_DAY;
    expect(fall(asa, day + 10)?.line.key).toBe('announce.mood_tier_why');
    expect(fall(njal, day + 400)?.line.key).toBe('announce.mood_tier_many_why');
    expect(log.lines.filter((l) => l.key?.startsWith('announce.mood_tier'))).toHaveLength(1);
  });
});

describe('T-714 the restless dead fall to dust at dawn', () => {
  it('a restless dead returning to rest at dawn has its own line', () => {
    const w = world('t714-dust');
    const log = announcer(w);
    const species = w.game.registry.table('creatures').index('restless_dead');
    const died = { type: 'CreatureDied', id: 999, cause: 'dawn', killerId: 0, species, name: '', faction: 'hostile', ageTicks: 0, wornItems: [], noCorpse: true } as unknown as GameEvent;
    expect(log.announce(died, w.readers, 100)?.line.text).toBe('A restless dead has fallen to dust.');
  });
});
