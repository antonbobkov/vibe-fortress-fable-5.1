/** T-302: a thief that escapes with a container takes what is in it. */
import { describe, expect, it } from 'vitest';
import { C, type Party } from '@core/components';
import type { EntityId } from '@core/types';
import type { ItemsReader } from '@systems/items';
import { spawnHostileMember } from '@systems/threats/parties';
import { TestWorld } from '../../scenarios/test-world';
import { checkInvariants } from '../../scenarios/invariants';

function thiefWithBag(seed: string) {
  const w = new TestWorld({ world: 'flat-test', embark: 'none', seed });
  const at = w.index(0, 0, 32);
  const partyId = w.game.world.entities.create('party');
  const party: Party = {
    civ: 'gloam', purpose: 'thief', members: [], leaderId: 0, state: 'engage',
    goalTile: at, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: 1,
  };
  w.game.world.entities.add(partyId, C.Party, party);
  const thief = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'),
    partyId, 'gloam_warrior', 'warriors', at, 3, false);
  const items = w.readers.of<ItemsReader>('13');
  const bag = w.spawnItem('bin', 'oak', at);
  const inside: EntityId[] = [w.spawnItem('log', 'oak', at), w.spawnItem('log', 'pine', at)];
  for (const id of inside) expect(w.items.putIn(id, bag)).toBe(true);
  w.items.attachToCarrier(bag, thief);
  party.loot.push(bag);
  return { w, party, thief, items, bag, inside };
}

describe('T-302 escaped loot leaves the map with its contents', () => {
  it('destroys what a stolen container holds as stolen, and leaves no item without a place', () => {
    const { w, party, items, bag, inside } = thiefWithBag('t302-stolen-container');
    const value = items.value(bag) + inside.reduce((sum, id) => sum + items.value(id), 0);
    expect(items.wealth()).toBe(value);
    party.state = 'retreat';
    w.step(11);
    expect(w.events('ThiefEscaped').some((e) => e['itemId'] === bag)).toBe(true);
    w.step(2);
    expect(items.get(bag)).toBeUndefined();
    for (const id of inside) {
      expect(items.get(id)).toBeUndefined();
      expect(w.events('ItemDestroyed').find((e) => e['id'] === id)?.['reason']).toBe('stolen');
    }
    expect(items.wealth()).toBe(0);
    expect(checkInvariants(w.game).filter((f) => f.inv === 'item.nowhere')).toEqual([]);
  });
});
