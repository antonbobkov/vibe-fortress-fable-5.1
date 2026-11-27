import { expect } from 'vitest';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import type { EntityId } from '@core/types';
import { advanceSulkCounter, type MoraleReader } from '@systems/morale';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'mo_misery_needs',
  milestone: 4,
  seed: 'mo-misery-needs',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    const dwarves = Array.from({ length: 7 }, (_, i) => w.spawnDwarf({ at: w.index(10 + i, 10, 32) }));
    w.spawnItem('drink', 'ale', w.index(10, 12, 32), 400);
    w.step(2);

    const morale = w.readers.of<MoraleReader>('15');
    // 15 § Sulks: the hours of each day the dwarf was Miserable, sampled after each hour's recompute.
    const dailyHours = new Map<EntityId, number[]>();
    const cumulativeSulks = new Map<EntityId, number[]>();
    const day7Moods = new Map<EntityId, number>();

    for (const id of dwarves) {
      dailyHours.set(id, []);
      cumulativeSulks.set(id, []);
    }

    for (let day = 1; day <= 14; day += 1) {
      const hours = new Map<EntityId, number>(dwarves.map((id) => [id, 0]));
      for (let hour = 0; hour < TICKS_PER_DAY / TICKS_PER_HOUR; hour += 1) {
        w.step(TICKS_PER_HOUR);
        for (const id of dwarves) if (morale.tier(id) === 0) hours.set(id, (hours.get(id) as number) + 1);
      }
      for (const id of dwarves) {
        dailyHours.get(id)!.push(hours.get(id) as number);
        const count = w.events('SulkHappened').filter((e) => e['id'] === id).length;
        cumulativeSulks.get(id)!.push(count);
        if (day === 7) {
          day7Moods.set(id, morale.mood(id));
        }
      }
    }

    for (const id of dwarves) {
      const hoursByDay = dailyHours.get(id)!;
      const sulks = cumulativeSulks.get(id)!;
      let counter = 0;
      const expectedSulkDays: number[] = [];
      for (let d = 0; d < 14; d += 1) {
        const res = advanceSulkCounter(counter, hoursByDay[d]!);
        counter = res.days;
        if (res.sulk) {
          expectedSulkDays.push(d + 1);
        }
      }

      const actualSulkDays: number[] = [];
      for (let d = 0; d < 14; d += 1) {
        const prev = d === 0 ? 0 : sulks[d - 1]!;
        if (sulks[d]! > prev) {
          actualSulkDays.push(d + 1);
        }
      }

      expect(actualSulkDays).toEqual(expectedSulkDays);
    }

    expect(Array.from(day7Moods.values()).some((m) => m < 20)).toBe(true);
    expect(w.events('SulkHappened').length).toBeGreaterThanOrEqual(1);
    expect(w.events('CreatureDied')).toHaveLength(0);
  },
};

export default scenario;
