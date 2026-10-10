import { expect } from 'vitest';
import { C } from '@core/components';
import { arriveParty } from '@systems/threats';
import type { Scenario } from './runner';

/** T-157: a living low-blood hostile chooses fleeing during the real threat tick. */
const scenario: Scenario = {
  id: 'th_fled', milestone: 8, seed: 'th-fled', world: 'flat-test', embark: 'none',
  run: (w) => {
    const { partyId } = arriveParty(w.game.world, w.game.registry, w.game.world.rngFor('18'),
      'thief', 'gloam', 1, 'n', w.tick, 0, 1, false);
    const id = w.game.world.entities.get(partyId, C.Party)!.members[0]!;
    w.movement.teleport(id, w.index(24, 12, 32));
    const body = w.game.world.entities.get(id, C.Body)!;
    body.blood = Math.floor(body.maxBlood * 0.5);
    w.until((v) => v.events('HostileFled').length > 0, 100);
    expect(w.events('HostileFled')).toEqual([expect.objectContaining({ id })]);
    expect(w.game.world.entities.get(id, C.Hostile)?.behaviorState).toBe('flee');
  },
};
export default scenario;
