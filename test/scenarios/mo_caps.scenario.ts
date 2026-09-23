import { expect } from 'vitest';
import { C } from '@core/components';
import { MOOD_BASELINE } from '@core/constants';
import type { MoraleReader } from '@systems/morale';
import { personalityBase } from '@systems/morale';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'mo_caps', milestone: 4, seed: 'mo-caps', world: 'flat-test', embark: 'none',
  run: (w) => {
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, 32) });
    w.step(1);
    for (let i = 0; i < 20; i += 1) w.game.world.emit({ type: 'SawMasterwork', id: dwarf, itemId: i + 1 });
    w.step(51);
    const morale = w.readers.of<MoraleReader>('15');
    const traits = w.game.world.entities.get(dwarf, C.Personality)?.traits ?? [];
    expect(morale.mood(dwarf)).toBeLessThanOrEqual(MOOD_BASELINE + 40 + personalityBase(w.game.registry, traits));
    expect(morale.thoughts(dwarf).filter((t) => t.id === 'saw_masterwork')).toHaveLength(3);
  },
};
export default scenario;
