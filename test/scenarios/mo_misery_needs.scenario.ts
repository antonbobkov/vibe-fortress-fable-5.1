import { expect } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId, MoodTier } from '@core/types';
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
    const dailyTiers = new Map<EntityId, MoodTier[]>();
    const cumulativeSulks = new Map<EntityId, number[]>();
    const day7Moods = new Map<EntityId, number>();

    for (const id of dwarves) {
      dailyTiers.set(id, []);
      cumulativeSulks.set(id, []);
    }

    for (let day = 1; day <= 14; day += 1) {
      w.step(TICKS_PER_DAY);
      for (const id of dwarves) {
        dailyTiers.get(id)!.push(morale.tier(id));
        const count = w.events('SulkHappened').filter((e) => e['id'] === id).length;
        cumulativeSulks.get(id)!.push(count);
        if (day === 7) {
          day7Moods.set(id, morale.mood(id));
        }
      }
    }

    for (const id of dwarves) {
      const tiers = dailyTiers.get(id)!;
      const sulks = cumulativeSulks.get(id)!;
      let counter = 0;
      const expectedSulkDays: number[] = [];
      for (let d = 0; d < 14; d += 1) {
        const isMiserable = tiers[d] === 0;
        const res = advanceSulkCounter(counter, isMiserable);
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
