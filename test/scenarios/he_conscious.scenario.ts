import { expect } from 'vitest';
import { C } from '@core/components';
import type { Scenario } from './runner';

/** T-157: a wounded creature whose blood and pain permit waking regains consciousness. */
const scenario: Scenario = {
  id: 'he_conscious', milestone: 8, seed: 'he-conscious', world: 'flat-test', embark: 'none',
  run: (w) => {
    const id = w.spawnDwarf({ at: w.index(20, 20, 32) });
    w.game.world.entities.get(id, C.Body)!.conscious = false;
    w.game.world.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0,
      part: 'torso', damageType: 'edge', amount: 1 });
    w.until((v) => v.events('CreatureConscious').length > 0, 20);
    expect(w.events('CreatureConscious')).toEqual([expect.objectContaining({ id })]);
    expect(w.game.world.entities.get(id, C.Body)?.conscious).toBe(true);
  },
};
export default scenario;
