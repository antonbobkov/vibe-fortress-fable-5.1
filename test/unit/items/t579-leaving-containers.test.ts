/**
 * T-579: nothing is left inside a container that is gone. A raider that leaves takes its bags and
 * what is in them; a caravan's pack animal that dies drops its load where it fell, and one that
 * leaves takes it.
 */
import { describe, expect, it } from 'vitest';
import { C, ItemFlag, type Party } from '@core/components';
import { Registrations, type TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import type { ItemsReader } from '@systems/items';
import { despawnMember, pickUpLoot } from '@systems/threats/ai';
import { spawnHostileMember } from '@systems/threats/parties';
import { spawnCaravan, DEPOT_WAIT_DAYS, type TradeSystem } from '@systems/trade';
import { TICKS_PER_DAY } from '@core/constants';
import { TestWorld } from '../../scenarios/test-world';
import { checkInvariants } from '../../scenarios/invariants';

function world(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const ctx: TickContext = { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick,
    rng: w.game.world.rngFor('18'), register: new Registrations(),
    terrain: w.game.world.services.terrain, jobs: w.game.world.services.jobs, spawn: w.game.world.services.spawn,
    emit: (event) => w.game.world.emit(event) };
  return { w, ctx };
}

const itemFindings = (w: TestWorld) => checkInvariants(w.game).filter((f) => f.inv.startsWith('item.'));
const reason = (w: TestWorld, id: EntityId) => w.events('ItemDestroyed').find((e) => e['id'] === id)?.['reason'];

function packCaravan(seed: string) {
  const { w, ctx } = world(seed);
  const items = w.game.registry.table('items');
  const materials = w.game.registry.table('materials');
  const caravan = spawnCaravan(ctx, 'hillfolk', 'n', 0, false, 0,
    [{ type: items.index('ring'), material: materials.index('gold'), count: 2, value: 50 }], w.game.world.rngFor('20'));
  const trade = w.game.world.scheduler.byId('20') as TradeSystem;
  trade.deserialize({ ...trade.serialize(), activeCaravan: caravan }, ctx);
  const mule = caravan.animals[0] as EntityId;
  const load = w.game.world.entities.get(mule, C.Container)!.contents.slice();
  expect(load.length).toBeGreaterThan(0);
  return { w, ctx, trade, caravan, mule, load };
}

describe('T-579 nothing is left in a container that is gone', () => {
  it('a raider leaves with a bag of loot and its own bag: both go with what they hold', () => {
    const { w, ctx } = world('t579-raider-bag');
    const at = w.index(30, 0, 32);
    const partyId = w.game.world.entities.create('party');
    const party: Party = { civ: 'gloam', purpose: 'raid', members: [], leaderId: 0, state: 'retreat',
      goalTile: 0, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: 1 };
    w.game.world.entities.add(partyId, C.Party, party);
    const raider = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'),
      partyId, 'gloam_warrior', 'warriors', at, 3, false);
    // The fortress's bag of seed, picked up as loot.
    const lootBag = w.spawnItem('bag', 'flax_cloth', at);
    const lootSeed = w.spawnItem('seed', 'barley', at, 10);
    expect(w.items.putIn(lootSeed, lootBag)).toBe(true);
    pickUpLoot(raider, lootBag, party, ctx);
    // The raider's own bag, with something in it.
    const ownBag = w.spawnItem('bag', 'flax_cloth', at);
    const ownSeed = w.spawnItem('seed', 'barley', at, 5);
    expect(w.items.putIn(ownSeed, ownBag)).toBe(true);
    w.items.attachToCarrier(ownBag, raider);
    w.items.setOwner(ownBag, raider);

    despawnMember(raider, partyId, party, ctx);
    w.step(2);
    for (const id of [lootBag, lootSeed, ownBag, ownSeed]) expect(w.game.world.entities.alive(id)).toBe(false);
    expect(reason(w, lootBag)).toBe('stolen');
    expect(reason(w, lootSeed)).toBe('stolen');
    expect(reason(w, ownBag)).toBe('left_map');
    expect(reason(w, ownSeed)).toBe('left_map');
    expect(party.escapedLootCount).toBe(1);
    expect(itemFindings(w)).toEqual([]);
  });

  it('a pack animal that dies drops its load on its tile, no longer the merchants\'', () => {
    const { w, ctx, trade, caravan, mule, load } = packCaravan('t579-mule-dies');
    const torso = w.game.world.entities.get(mule, C.Body)!.parts[1]!;
    w.game.world.emit({ type: 'DamageDealt', defenderId: mule, attackerId: 0, part: 'torso', damageType: 'blunt', amount: torso.maxHp * 5 });
    w.until(() => w.events('CreatureDied').some((e) => e['id'] === mule), 20);
    w.step(2);
    expect(w.game.world.entities.alive(mule)).toBe(false);
    const tile = w.events('CreatureDied').find((e) => e['id'] === mule)!['tile'] as number;
    for (const id of load) {
      const it = w.game.world.entities.get(id, C.Item)!;
      expect(it).toMatchObject({ containerId: 0, carriedBy: 0 });
      expect(it.flags & ItemFlag.Merchant).toBe(0);
      expect(w.readers.of<ItemsReader>('13').tileOf(id)).toBe(tile);
    }
    expect(itemFindings(w)).toEqual([]);
    // The caravan leaves without it.
    caravan.state = 'waiting';
    caravan.stateSince = -DEPOT_WAIT_DAYS * TICKS_PER_DAY;
    trade.deserialize({ ...trade.serialize(), activeCaravan: caravan }, ctx);
    w.until(() => trade.reader().activeCaravan() === null, 200);
    for (const id of load) expect(w.game.world.entities.alive(id)).toBe(true);
    expect(itemFindings(w)).toEqual([]);
  });

  it('a pack animal that leaves takes its whole load, goods or not', () => {
    const { w, ctx, trade, caravan, mule, load } = packCaravan('t579-mule-leaves');
    const stray = w.spawnItem('log', 'oak', w.index(30, 0, 32));
    expect(w.items.putIn(stray, mule)).toBe(true);
    caravan.state = 'waiting';
    caravan.stateSince = -DEPOT_WAIT_DAYS * TICKS_PER_DAY;
    trade.deserialize({ ...trade.serialize(), activeCaravan: caravan }, ctx);
    trade.tick(ctx);
    expect(trade.reader().activeCaravan()).toBeNull();
    for (const id of [...load, stray]) expect(w.game.world.entities.alive(id)).toBe(false);
    w.step(1);
    expect(reason(w, stray)).toBe('left_map');
    expect(itemFindings(w)).toEqual([]);
  });
});
