/** T-407: a thief that escapes with a corpse takes the kit the corpse still wears. */
import { describe, expect, it } from 'vitest';
import { C, type Party } from '@core/components';
import type { ItemsReader } from '@systems/items';
import { spawnHostileMember } from '@systems/threats/parties';
import { TestWorld } from '../../scenarios/test-world';
import { checkInvariants } from '../../scenarios/invariants';

function thiefWithCorpse(seed: string) {
  const w = new TestWorld({ world: 'flat-test', embark: 'none', seed });
  const world = w.game.world;
  const at = w.index(0, 0, 32);
  const party = (): Party => ({
    civ: 'gloam', purpose: 'thief', members: [], leaderId: 0, state: 'engage',
    goalTile: at, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: 1,
  });
  const partyId = world.entities.create('party');
  const P = party();
  world.entities.add(partyId, C.Party, P);
  const thief = spawnHostileMember(world, w.game.registry, world.rngFor('18'), partyId, 'gloam_warrior', 'warriors', at, 3, false);
  // A raider of an earlier party falls inside the map; its kit stays on its corpse.
  const earlierId = world.entities.create('party');
  world.entities.add(earlierId, C.Party, party());
  const fallen = spawnHostileMember(world, w.game.registry, world.rngFor('18'), earlierId, 'gloam_warrior', 'warriors', w.index(20, 20, 32), 3, false);
  const kit = w.readers.of<ItemsReader>('13').carriedItems(fallen);
  expect(kit.length).toBeGreaterThan(0);
  world.emit({ type: 'DamageDealt', defenderId: fallen, attackerId: 0, part: 'torso', damageType: 'edge',
    amount: world.entities.get(fallen, C.Body)!.parts[1]!.maxHp * 2 });
  w.step(2);
  expect(world.entities.alive(fallen)).toBe(false);
  const corpse = world.entities.with(C.Corpse)[0]!;
  for (const id of kit) expect(world.entities.get(id, C.Item)?.carriedBy).toBe(corpse);
  w.items.attachToCarrier(corpse, thief);
  P.loot.push(corpse);
  return { w, P, corpse, kit, items: w.readers.of<ItemsReader>('13') };
}

describe('T-407 an escaped corpse leaves the map with what it wears', () => {
  it('destroys the stolen corpse\'s kit as stolen, and leaves no item without a place', () => {
    const { w, P, corpse, kit, items } = thiefWithCorpse('t407-stolen-corpse');
    P.state = 'retreat';
    w.step(11);
    expect(w.events('ThiefEscaped').some((e) => e['itemId'] === corpse)).toBe(true);
    w.step(2);
    expect(items.get(corpse)).toBeUndefined();
    for (const id of kit) {
      expect(items.get(id)).toBeUndefined();
      expect(w.events('ItemDestroyed').find((e) => e['id'] === id)?.['reason']).toBe('stolen');
    }
    expect(checkInvariants(w.game).filter((f) => f.inv === 'item.nowhere')).toEqual([]);
  });
});
