import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { FLAT_TEST_SURFACE_Z, buildFlatTestMap } from '@app/headless';
import { C, type Needs } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import {
  advanceNeeds,
  crossed,
  WANT,
  CRITICAL,
  HUNGER_PER_HOUR,
  THIRST_PER_HOUR,
  REST_AWAKE_PER_HOUR,
  REST_ASLEEP_PER_HOUR,
  SOCIAL_PER_HOUR,
  COMFORT_PER_HOUR,
  PURPOSE_IDLE_PER_HOUR,
  PURPOSE_WORK_PER_HOUR,
  JOY_PER_HOUR,
} from '@systems/dwarves';
import { TestWorld } from '../../scenarios/test-world';

const zero: Needs = { hunger: 0, thirst: 0, rest: 0, social: 0, comfort: 0, purpose: 0, joy: 0 };
const registry = contentRegistry();
const world = (seed: string): TestWorld => new TestWorld({ seed, registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none' });

describe('T-M4-05 needs', () => {
  it.each([[20, 1.3, 6.5], [50, 1, 5], [80, 0.7, 3.5]])('Endurance %i scales hunger and awake rest', (end, hunger, rest) => {
    const n = advanceNeeds(zero, end, 100, false, false);
    expect(n.hunger).toBeCloseTo(hunger);
    expect(n.rest).toBeCloseTo(rest);
    expect(n.thirst).toBe(1.6);
    expect(n.social).toBe(2);
    expect(n.comfort).toBe(3);
    expect(n.purpose).toBe(2);
    expect(n.joy).toBe(1.5);
    expect(advanceNeeds(zero, end, 100, true, true).purpose).toBe(0);
    expect(advanceNeeds({ ...zero, rest: 30 }, end, 100, true, true).rest).toBe(15);
  });

  it('D-117: heatwave raises thirst by 50 percent, independent of Endurance', () => {
    for (const end of [20, 50, 80]) expect(advanceNeeds(zero, end, 150, false, false).thirst).toBe(2.4);
    const w = world('heat-thirst');
    const id = w.spawnDwarf({ at: w.index(10, 10, FLAT_TEST_SURFACE_Z) });
    w.setNeed(id, 'thirst', 0);
    w.forceWeather('heatwave');
    w.step(TICKS_PER_HOUR + 1);
    expect(w.readers.of<{ need(id: number, n: keyof Needs): number }>('10').need(id, 'thirst')).toBe(2.4);
  });

  it('threshold crossings flag a new choice exactly once and emit NeedCritical once', () => {
    const w = world('need-crossing');
    const id = w.spawnDwarf({ at: w.index(10, 10, FLAT_TEST_SURFACE_Z) });
    w.setNeed(id, 'hunger', 49.2);
    expect(w.game.world.entities.get(id, C.Needs)?.hunger).toBe(49.2);
    expect(w.dwarves.hasInterrupt(id)).toBe(false);
    w.step(2 * TICKS_PER_HOUR + 1);
    expect(w.dwarves.hasInterrupt(id)).toBe(false);
    expect(w.game.world.entities.get(id, C.Needs)?.hunger).toBeGreaterThanOrEqual(50);
    w.step(TICKS_PER_HOUR);
    expect(w.dwarves.hasInterrupt(id)).toBe(false);
    w.setNeed(id, 'hunger', 84.2);
    w.step(TICKS_PER_HOUR + 1);
    expect(w.dwarves.hasInterrupt(id)).toBe(false);
    expect(w.events('NeedCritical').filter((e) => e['id'] === id && e['need'] === 'hunger')).toHaveLength(1);
    w.step(TICKS_PER_HOUR);
    expect(w.dwarves.hasInterrupt(id)).toBe(false);
    expect(w.events('NeedCritical').filter((e) => e['id'] === id && e['need'] === 'hunger')).toHaveLength(1);
    expect(crossed({ ...zero, hunger: 84 }, { ...zero, hunger: 85 }).critical).toEqual(['hunger']);
  });

  it('the sleep start hour flags a rested dwarf to consider bed', () => {
    const w = world('sleep-schedule');
    const id = w.spawnDwarf({ at: w.index(10, 10, FLAT_TEST_SURFACE_Z) });
    const schedule = w.game.world.entities.get(id, C.Schedule);
    if (schedule === undefined) throw new Error('no schedule');
    w.game.world.entities.add(id, C.Schedule, { ...schedule, sleepStartHour: 1 });
    w.setNeed(id, 'rest', 30);
    w.step(2 * TICKS_PER_HOUR + 1);
    expect(w.dwarves.hasInterrupt(id)).toBe(false);
    expect(w.game.world.entities.get(id, C.Brain)?.activity).toBe('sleep');
  });

  it('D-119: one Starving announcement per day when both needs are maxed', () => {
    const w = world('both-starving');
    const id = w.spawnDwarf({ at: w.index(10, 10, FLAT_TEST_SURFACE_Z) });
    w.setNeed(id, 'hunger', 100);
    w.setNeed(id, 'thirst', 100);
    w.step(3 * TICKS_PER_HOUR);
    const announced = w.events('Starving').filter((e) => e['id'] === id);
    expect(announced).toHaveLength(1);
    expect(announced[0]?.['need']).toBe('hunger');
  });

  it('Starvation damage eventually kills the dwarf through 17 health', () => {
    const w = world('starvation-kill');
    const id = w.spawnDwarf({ at: w.index(10, 10, FLAT_TEST_SURFACE_Z) });
    w.setNeed(id, 'hunger', 100);
    // STARVE_DAYS (7) + 13 daily damage days = 20 days until death
    for (let day = 0; day < 20; day += 1) {
      if (w.game.world.entities.alive(id)) {
        w.setNeed(id, 'thirst', 0);
      }
      w.step(TICKS_PER_DAY);
    }
    const starvEvents = w.events('Starvation').filter((e) => e['id'] === id);
    expect(starvEvents).toHaveLength(13);
    expect(w.events('CreatureDied').some((e) => e['id'] === id && e['cause'] === 'starvation')).toBe(true);
    expect(w.game.world.entities.alive(id)).toBe(false);
  });
});

describe('F-10 need rates', () => {
  it('the season arithmetic: seven dwarves consume about 100 food and 150 drink per season', () => {
    // 1 dwarf: interval between events is WANT[need] / rate hours.
    // Events per dwarf per day: 24 * rate / 50 = 0.48 * rate.
    const foodInterval = WANT.hunger / HUNGER_PER_HOUR;
    const drinkInterval = WANT.thirst / THIRST_PER_HOUR;
    expect(foodInterval).toBe(50);
    expect(drinkInterval).toBeCloseTo(31.25, 2);
    expect(Math.round(drinkInterval)).toBe(31);

    const foodPerDwarfPerDay = (24 * HUNGER_PER_HOUR) / WANT.hunger;
    const drinkPerDwarfPerDay = (24 * THIRST_PER_HOUR) / WANT.thirst;
    const foodSeasonTheoretical = foodPerDwarfPerDay * 7 * 28;
    const drinkSeasonTheoretical = drinkPerDwarfPerDay * 7 * 28;
    expect(foodSeasonTheoretical).toBeCloseTo(94.08, 2);
    expect(drinkSeasonTheoretical).toBeCloseTo(150.53, 2);

    // 7 dwarves, no interruptions, 28 days of advanceNeeds at Endurance 50 and thirstModifier 100
    let totalFoodEvents = 0;
    let totalDrinkEvents = 0;
    for (let dwarf = 0; dwarf < 7; dwarf += 1) {
      let n: Needs = { ...zero, hunger: 30, thirst: 30 };
      for (let hour = 0; hour < 28 * 24; hour += 1) {
        n = advanceNeeds(n, 50, 100, false, false);
        if (n.hunger >= WANT.hunger) {
          totalFoodEvents += 1;
          n.hunger = 0;
        }
        if (n.thirst >= WANT.thirst) {
          totalDrinkEvents += 1;
          n.thirst = 0;
        }
      }
    }
    // food events: 98 events (within ±5% of 100)
    // drink events: 154 events (within ±5% of 150)
    expect(totalFoodEvents).toBeGreaterThanOrEqual(100 * 0.95);
    expect(totalFoodEvents).toBeLessThanOrEqual(100 * 1.05);
    expect(totalDrinkEvents).toBeGreaterThanOrEqual(150 * 0.95);
    expect(totalDrinkEvents).toBeLessThanOrEqual(150 * 1.05);
  });

  it('rest, social, comfort, purpose and joy rates are unchanged (guards F-10b)', () => {
    expect(HUNGER_PER_HOUR).toBe(1);
    expect(THIRST_PER_HOUR).toBe(1.6);
    expect(REST_AWAKE_PER_HOUR).toBe(5);
    expect(REST_ASLEEP_PER_HOUR).toBe(-15);
    expect(SOCIAL_PER_HOUR).toBe(2);
    expect(COMFORT_PER_HOUR).toBe(3);
    expect(PURPOSE_IDLE_PER_HOUR).toBe(2);
    expect(PURPOSE_WORK_PER_HOUR).toBe(-10);
    expect(JOY_PER_HOUR).toBe(1.5);

    expect(WANT.rest).toBe(60);
    expect(WANT.social).toBe(50);
    expect(WANT.comfort).toBe(55);
    expect(WANT.purpose).toBe(60);
    expect(WANT.joy).toBe(60);

    expect(CRITICAL.rest).toBe(90);
    expect(CRITICAL.hunger).toBe(85);
    expect(CRITICAL.thirst).toBe(85);
  });
});
