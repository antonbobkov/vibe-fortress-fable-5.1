import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { FLAT_TEST_SURFACE_Z, buildFlatTestMap } from '@app/headless';
import { C, type Needs } from '@core/components';
import { TICKS_PER_HOUR } from '@core/constants';
import { advanceNeeds, crossed } from '@systems/dwarves';
import { TestWorld } from '../../scenarios/test-world';

const zero: Needs = { hunger: 0, thirst: 0, rest: 0, social: 0, comfort: 0, purpose: 0, joy: 0 };
const registry = contentRegistry();
const world = (seed: string): TestWorld => new TestWorld({ seed, registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none' });

describe('T-M4-05 needs', () => {
  it.each([[20, 3.9, 6.5], [50, 3, 5], [80, 2.1, 3.5]])('Endurance %i scales hunger and awake rest', (end, hunger, rest) => {
    const n = advanceNeeds(zero, end, 100, false, false);
    expect(n.hunger).toBeCloseTo(hunger);
    expect(n.rest).toBeCloseTo(rest);
    expect(n.thirst).toBe(5);
    expect(n.social).toBe(2);
    expect(n.comfort).toBe(3);
    expect(n.purpose).toBe(2);
    expect(n.joy).toBe(1.5);
    expect(advanceNeeds(zero, end, 100, true, true).purpose).toBe(0);
    expect(advanceNeeds({ ...zero, rest: 30 }, end, 100, true, true).rest).toBe(15);
  });

  it('D-117: heatwave raises thirst by 50 percent, independent of Endurance', () => {
    for (const end of [20, 50, 80]) expect(advanceNeeds(zero, end, 150, false, false).thirst).toBe(7.5);
    const w = world('heat-thirst');
    const id = w.spawnDwarf({ at: w.index(10, 10, FLAT_TEST_SURFACE_Z) });
    w.setNeed(id, 'thirst', 0);
    w.forceWeather('heatwave');
    w.step(TICKS_PER_HOUR + 1);
    expect(w.readers.of<{ need(id: number, n: keyof Needs): number }>('10').need(id, 'thirst')).toBe(7.5);
  });

  it('threshold crossings flag a new choice exactly once and emit NeedCritical once', () => {
    const w = world('need-crossing');
    const id = w.spawnDwarf({ at: w.index(10, 10, FLAT_TEST_SURFACE_Z) });
    w.setNeed(id, 'hunger', 49);
    expect(w.game.world.entities.get(id, C.Needs)?.hunger).toBe(49);
    expect(w.dwarves.hasInterrupt(id)).toBe(false);
    w.step(2 * TICKS_PER_HOUR + 1);
    expect(w.dwarves.hasInterrupt(id)).toBe(true);
    expect(w.dwarves.takeInterrupt(id)).toBe(true);
    w.step(TICKS_PER_HOUR);
    expect(w.dwarves.hasInterrupt(id)).toBe(false);
    w.setNeed(id, 'hunger', 84);
    w.step(TICKS_PER_HOUR + 1);
    expect(w.dwarves.hasInterrupt(id)).toBe(true);
    expect(w.events('NeedCritical').filter((e) => e['id'] === id && e['need'] === 'hunger')).toHaveLength(1);
    w.dwarves.takeInterrupt(id);
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
    expect(w.dwarves.hasInterrupt(id)).toBe(true);
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

  it.todo('M6: Starvation damage eventually kills the dwarf through 17 health');
});
