import { expect } from 'vitest';
import { C } from '@core/components';
import type { MoraleReader } from '@systems/morale';
import { baseValue, personalityMultiplier, type ThoughtDef } from '@systems/morale';
import type { Scenario } from './runner';

/** M6 death and burial producers are absent; the events are scripted at their public boundary. */
const scenario: Scenario = {
  id: 'mo_grief', milestone: 4, seed: 'mo-grief', world: 'flat-test', embark: 'none',
  run: (w) => {
    const friend = w.spawnDwarf({ at: w.index(10, 10, 32) });
    const dead = w.spawnDwarf({ at: w.index(11, 10, 32) });
    const rel = w.game.world.entities.get(friend, C.Relationships)!;
    w.game.world.entities.add(friend, C.Relationships, { ...rel, friends: [dead] });
    w.step(1);
    w.game.world.emit({ type: 'DwarfDied', id: dead, cause: 'scripted' });
    w.step(1);
    const morale = w.readers.of<MoraleReader>('15');
    const def = w.game.registry.table<ThoughtDef>('thoughts').byId('friend_died')!;
    const traits = w.game.world.entities.get(friend, C.Personality)?.traits ?? [];
    expect(morale.thoughts(friend).find((t) => t.id === 'friend_died')?.value)
      .toBeCloseTo(baseValue(def) * personalityMultiplier(w.game.registry, traits, def, baseValue(def)), 2);
    w.game.world.emit({ type: 'Buried', dwarfId: dead, coffinId: 0, tombTier: 2 });
    w.step(1);
    expect(morale.thoughts(friend).some((t) => t.id === 'buried_friend' && t.value > 0)).toBe(true);
  },
};
export default scenario;
