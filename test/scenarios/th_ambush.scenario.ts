import { expect } from 'vitest';
import { C } from '@core/components';
import { arriveParty } from '@systems/threats';
import type { Scenario } from './runner';

/** T-157: a real ambush party advances toward an outdoor dwarf and springs in range. */
const scenario: Scenario = {
  id: 'th_ambush', milestone: 8, seed: 'th-ambush', world: 'flat-test', embark: 'none',
  run: (w) => {
    w.spawnDwarf({ at: w.index(24, 12, 32) });
    const { partyId } = arriveParty(w.game.world, w.game.registry, w.game.world.rngFor('18'),
      'ambush', 'gloam', 2, 'n', w.tick, 0, 2, false);
    w.until((v) => v.events('AmbushSprung').length > 0, 500);
    expect(w.events('AmbushSprung')).toEqual([expect.objectContaining({ partyId })]);
    const party = w.game.world.entities.get(partyId, C.Party)!;
    expect(party.members.length).toBeGreaterThan(0);
    for (const id of party.members) expect(w.game.world.entities.get(id, C.Hostile)?.stealthed).toBe(false);
  },
};
export default scenario;
