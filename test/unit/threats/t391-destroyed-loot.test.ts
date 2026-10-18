/**
 * T-391: a raid party forgets loot that no longer exists. A meal carried off by a raider rots away
 * in the raider's hands (13 destroys it as `rotted`), and the party's loot list kept naming it.
 */
import { describe, expect, it } from 'vitest';
import { C, type Party } from '@core/components';
import { spawnHostileMember } from '@systems/threats/parties';
import { TestWorld } from '../../scenarios/test-world';
import { checkInvariants } from '../../scenarios/invariants';

function raiderWithLoot(seed: string) {
  const w = new TestWorld({ world: 'flat-test', embark: 'none', seed, surfaceWildlife: 'none' });
  const at = w.index(0, 0, 32);
  const partyId = w.game.world.entities.create('party');
  const party: Party = {
    civ: 'gloam', purpose: 'raid', members: [], leaderId: 0, state: 'loiter',
    goalTile: at, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: 1,
  };
  w.game.world.entities.add(partyId, C.Party, party);
  const raider = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'),
    partyId, 'gloam_warrior', 'warriors', at, 3, false);
  const meal = w.spawnItem('lavish_meal', 'pale_bell', at, 8);
  const axe = w.spawnItem('axe', 'iron', at);
  w.items.attachToCarrier(meal, raider);
  w.items.attachToCarrier(axe, raider);
  party.loot.push(meal, axe);
  return { w, party, raider, meal, axe };
}

describe('T-391 a party forgets destroyed loot', () => {
  it('drops a rotted item from the loot list at once, keeps the rest, and the checker finds nothing', () => {
    const { w, party, meal, axe } = raiderWithLoot('t391-rotted-loot');
    w.items.destroy(meal, 'rotted');
    expect(w.game.world.entities.alive(meal)).toBe(false);
    // The list is clean in the same tick, before any event is handled, so no save or check sees a dead id.
    expect(party.loot).toEqual([axe]);
    w.step(1);
    expect(checkInvariants(w.game).filter((f) => f.inv === 'party.loot-missing')).toEqual([]);
  });

  it('a party whose only loot rotted has no loot to escape with', () => {
    const { w, party, meal, axe } = raiderWithLoot('t391-only-loot');
    w.items.destroy(axe, 'burned');
    w.items.destroy(meal, 'rotted');
    expect(party.loot).toEqual([]);
    w.step(5);
    expect(w.events('ThiefEscaped')).toHaveLength(0);
  });
});
