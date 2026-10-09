import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C, ItemFlag } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { Registrations, type TickContext } from '@core/system';
import { despawnMember, pickUpLoot } from '@systems/threats/ai';
import { spawnHostileMember } from '@systems/threats/parties';
import { spawnCaravan, DEPOT_WAIT_DAYS, type TradeSystem } from '@systems/trade';
import { ItemsSystem } from '@systems/items';
import { TestWorld } from '../scenarios/test-world';

function setup() {
  const w = new TestWorld({ seed: 't163-gear', world: 'flat-test', embark: 'none' });
  const ctx: TickContext = { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick,
    rng: w.game.world.rngFor('18'), register: new Registrations(),
    terrain: w.game.world.services.terrain, jobs: w.game.world.services.jobs, spawn: w.game.world.services.spawn,
    emit: (event) => w.game.world.emit(event) };
  const partyId = w.game.world.entities.create('party');
  w.game.world.entities.add(partyId, C.Party, { civ: 'gloam', purpose: 'raid', members: [], leaderId: 0,
    state: 'retreat', goalTile: 0, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: 1 });
  const member = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'),
    partyId, 'gloam_captain', 'archers', w.index(30, 0, 32), 4, true);
  const party = w.game.world.entities.get(partyId, C.Party)!;
  const gear = w.game.world.entities.with(C.Item).filter((id) => w.game.world.entities.get(id, C.Item)?.carriedBy === member);
  expect(gear.length).toBeGreaterThan(0);
  return { w, ctx, partyId, party, member, gear };
}
function references(w: TestWorld, members: readonly number[]) {
  return w.game.world.entities.with(C.Item).filter((id) => {
    const item = w.game.world.entities.get(id, C.Item)!;
    return members.includes(item.carriedBy) || members.includes(item.ownerId);
  });
}

describe('T-163 carried gear leaves with its creature', () => {
  it('spawned hostile gear has a single location and contributes no fortress wealth', () => {
    const { w, member, gear } = setup();
    for (const id of gear) {
      expect(w.game.world.entities.has(id, C.Position)).toBe(false);
      expect(w.game.world.entities.get(id, C.Item)).toMatchObject({ carriedBy: member, ownerId: member, containerId: 0 });
      expect(w.game.world.entities.get(id, C.Item)!.flags & ItemFlag.Foreign).not.toBe(0);
    }
    expect((w.game.world.scheduler.byId('13') as ItemsSystem).core.wealth).toBe(0);
    expect(roundTrip(w.game).game.hash()).toBe(w.game.hash());
  });
  it('edge departure destroys every held item including spare weapons and ammunition', () => {
    const { w, ctx, partyId, party, member, gear } = setup();
    const slots = w.game.world.entities.get(member, C.Equipment)!;
    expect(gear.some((id) => ![slots.weapon, slots.shield, slots.quiver, ...Object.values(slots.armor)].includes(id))).toBe(true);
    despawnMember(member, partyId, party, ctx);
    expect(w.game.world.entities.alive(member)).toBe(false);
    expect(references(w, [member])).toEqual([]);
    for (const id of gear) expect(w.game.world.entities.alive(id)).toBe(false);
    w.step(1);
    for (const id of gear) expect(w.events('ItemDestroyed').some((e) => e['id'] === id && e['reason'] === 'left_map')).toBe(true);
  });
  it('a carried container and its contents leave without orphaning either', () => {
    const { w, ctx, partyId, party, member } = setup();
    const items = w.game.world.services.items!;
    const chest = w.spawnItem('chest', 'oak', w.index(30, 0, 32));
    const spare = w.spawnItem('dagger', 'iron', w.index(30, 0, 32));
    expect(items.putIn(spare, chest)).toBe(true);
    items.attachToCarrier(chest, member);
    items.setOwner(chest, member);
    despawnMember(member, partyId, party, ctx);
    expect(w.game.world.entities.alive(chest)).toBe(false);
    expect(w.game.world.entities.alive(spare)).toBe(false);
    expect(references(w, [member])).toEqual([]);
  });
  it('death keeps all carried gear on an unowned corpse, including ammunition outside worn slots', () => {
    const { w, party, member, gear } = setup();
    party.state = 'engage';
    w.game.world.entities.add(member, C.Position, w.map.unpack(w.index(30, 10, 32)));
    const torso = w.game.world.entities.get(member, C.Body)!.parts[1]!;
    w.game.world.emit({ type: 'DamageDealt', defenderId: member, attackerId: 0, part: 'torso', damageType: 'blunt', amount: torso.maxHp * 2 });
    w.until(() => w.events('CorpseCreated').some((e) => e['creatureId'] === member), 20);
    const corpse = w.events('CorpseCreated').find((e) => e['creatureId'] === member)!['itemId'] as number;
    expect(w.game.world.entities.get(corpse, C.Corpse)?.wornItems).toEqual(gear.slice().sort((a, b) => a - b));
    for (const id of gear) {
      expect(w.game.world.entities.get(id, C.Item)).toMatchObject({ carriedBy: corpse, ownerId: 0 });
      expect(w.game.world.entities.has(id, C.Position)).toBe(false);
    }
    expect(references(w, [member])).toEqual([]);
    expect(roundTrip(w.game).game.hash()).toBe(w.game.hash());
  });
  it('departing Wildwood guards take their daggers and arrows as well as worn slots', () => {
    const { w, ctx } = setup();
    const trade = w.game.world.scheduler.byId('20') as TradeSystem;
    const caravan = spawnCaravan(ctx, 'wildwood', 'n', 0, false, 0, [], w.game.world.rngFor('20'));
    const members = [...caravan.merchants, ...caravan.guards, ...caravan.animals];
    const gear = references(w, members);
    const types = w.game.registry.table('items');
    expect(gear.some((id) => types.idOf(w.game.world.entities.get(id, C.Item)!.type) === 'dagger')).toBe(true);
    expect(gear.some((id) => types.idOf(w.game.world.entities.get(id, C.Item)!.type) === 'arrow')).toBe(true);
    caravan.state = 'waiting';
    caravan.stateSince = -DEPOT_WAIT_DAYS * TICKS_PER_DAY;
    trade.deserialize({ ...trade.serialize(), activeCaravan: caravan }, ctx);
    trade.tick(ctx);
    expect(trade.reader().activeCaravan()).toBeNull();
    expect(references(w, members)).toEqual([]);
    for (const id of gear) expect(w.game.world.entities.alive(id)).toBe(false);
  });
  it('stolen loot is removed by ThiefEscaped exactly once, separately from departing gear', () => {
    const { w, ctx, partyId, party, member, gear } = setup();
    party.purpose = 'thief';
    const loot = w.spawnItem('ring', 'gold', w.index(30, 0, 32));
    pickUpLoot(member, loot, party, ctx);
    despawnMember(member, partyId, party, ctx);
    expect(w.game.world.entities.alive(loot)).toBe(true);
    for (const id of gear) expect(w.game.world.entities.alive(id)).toBe(false);
    w.step(2);
    expect(w.game.world.entities.alive(loot)).toBe(false);
    expect(w.events('ItemDestroyed').filter((e) => e['id'] === loot)).toHaveLength(1);
    expect(w.events('ItemDestroyed').find((e) => e['id'] === loot)?.['reason']).toBe('stolen');
    expect(references(w, [member])).toEqual([]);
  });
});
