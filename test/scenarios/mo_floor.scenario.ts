import { expect } from 'vitest';
import { C, type ActiveThought } from '@core/components';
import { TICKS_PER_HOUR } from '@core/constants';
import { baseValue, personalityMultiplier, type MoraleReader, type ThoughtDef } from '@systems/morale';
import type { Scenario } from './runner';

const NEED_KEYS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

const scenario: Scenario = {
  id: 'mo_floor',
  milestone: 4,
  seed: 'mo-floor',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    const dwarves = [
      w.spawnDwarf({ at: w.index(10, 10, 32) }),
      w.spawnDwarf({ at: w.index(11, 10, 32) }),
      w.spawnDwarf({ at: w.index(12, 10, 32) }),
    ];

    const p = w.game.registry.table('personality');
    const excluded = new Set(['sensitive', 'timid', 'stoic', 'brave']);
    const filler = p.ids().filter((id) => !excluded.has(id)).map((id) => p.index(id));

    const traits0: [number, number, number] = [p.index('sensitive'), p.index('timid'), filler[0]!];
    const traits1: [number, number, number] = [p.index('stoic'), p.index('brave'), filler[0]!];
    const traits2: [number, number, number] = [filler[0]!, filler[1]!, filler[2]!];

    w.game.world.entities.add(dwarves[0]!, C.Personality, { traits: traits0 });
    w.game.world.entities.add(dwarves[1]!, C.Personality, { traits: traits1 });
    w.game.world.entities.add(dwarves[2]!, C.Personality, { traits: traits2 });

    w.step(1);

    const thoughtTable = w.game.registry.table<ThoughtDef>('thoughts');
    const now = w.game.world.calendar.tick;

    for (const dwarf of dwarves) {
      const mood = w.game.world.entities.get(dwarf, C.Mood)!;
      const traits = w.game.world.entities.get(dwarf, C.Personality)?.traits ?? [];
      const thoughtsToAdd: ActiveThought[] = [];
      for (const id of thoughtTable.ids()) {
        const def = thoughtTable.byId(id)!;
        if (def.decay !== 'standing') {
          const val = baseValue(def);
          if (val < 0) {
            const scaled = val * personalityMultiplier(w.game.registry, traits, def, val);
            thoughtsToAdd.push({
              thought: thoughtTable.index(id),
              startTick: now,
              baseValue: scaled,
            });
          }
        }
      }
      w.game.world.entities.add(dwarf, C.Mood, {
        ...mood,
        thoughts: [...mood.thoughts, ...thoughtsToAdd],
      });
    }

    for (let cycle = 0; cycle < 3; cycle += 1) {
      for (const dwarf of dwarves) {
        for (const need of NEED_KEYS) {
          w.setNeed(dwarf, need, 0);
        }
      }
      w.step(TICKS_PER_HOUR);
    }

    const morale = w.readers.of<MoraleReader>('15');
    for (const dwarf of dwarves) {
      expect(morale.mood(dwarf)).toBeGreaterThanOrEqual(20);
    }
    expect(morale.mood(dwarves[0]!)).toBe(20);
  },
};

export default scenario;
