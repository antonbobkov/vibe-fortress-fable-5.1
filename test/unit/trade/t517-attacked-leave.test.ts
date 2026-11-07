/** T-517: an attacked caravan leaves the map within its limit, and never turns on its own. */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import { CARAVAN_GUARD_FIGHT_DAYS, CARAVAN_LEAVE_DAYS, type TradeSystem } from '@systems/trade';
import { TestWorld } from '../../scenarios/test-world';

function atDepot(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', startTick: 31 * TICKS_PER_DAY });
  w.build('trade_depot', w.index(45, 8, 32), 'granite');
  w.until(() => w.events('CaravanAtDepot').length > 0, 20 * TICKS_PER_DAY);
  const trade = w.game.world.scheduler.byId('20') as TradeSystem;
  const caravan = trade.serialize().activeCaravan!;
  // A sealed pocket under the ground: nothing in it reaches the surface.
  w.digRoom(10, 60, 29, 3, 3);
  const pocket = w.index(11, 61, 29);
  const raider = w.spawnCreature('gloam_warrior', pocket, 'hostile:gloam');
  w.step(1);
  expect(w.reachable(pocket, w.index(45, 8, 32))).toBe(false);
  const attack = (attackerId: EntityId, defenderId: EntityId) => w.game.world.emit({
    type: 'AttackResolved', attackerId, defenderId, part: 'torso', damageType: 'pierce', amount: 1, outcome: 'hit',
  });
  return { w, trade, caravan, raider, pocket, attack };
}

describe('T-517 an attacked caravan leaves within its limit', () => {
  it('a comrade\'s stray shot neither sends the caravan away nor turns its guards on the shooter', () => {
    const { w, trade, caravan, attack } = atDepot('t517-friendly');
    const [shooter, hit] = caravan.guards as [EntityId, EntityId];
    attack(shooter, hit);
    w.step(1);
    expect(trade.reader().activeCaravan()?.state).toBe('atDepot');
    for (const guard of caravan.guards) expect(w.game.world.services.combat?.targetOf(guard)).not.toBe(shooter);
    expect(w.events('CaravanAttacked')).toHaveLength(0);
  });

  it('sets the party to leave, and departs though a guard\'s target is never dropped', () => {
    const { w, trade, caravan, raider, attack } = atDepot('t517-held');
    const combat = w.game.world.services.combat!;
    const guard = caravan.guards[0]!;
    // A target 16 never drops: the guard reports it whatever is cleared.
    const targetOf = combat.targetOf.bind(combat);
    combat.targetOf = (id) => (id === guard ? raider : targetOf(id));
    attack(raider, caravan.merchants[0]!);
    w.step(1);
    expect(trade.reader().activeCaravan()?.state).toBe('leave');
    expect(w.game.world.entities.get(caravan.partyId, C.Party)?.state).toBe('leave');
    const since = trade.serialize().activeCaravan!.stateSince;
    w.until(() => w.events('CaravanDeparted').length > 0, (CARAVAN_LEAVE_DAYS + 1) * TICKS_PER_DAY);
    expect(w.events('CaravanDeparted')).toHaveLength(1);
    expect(w.tick - since).toBeGreaterThanOrEqual(CARAVAN_GUARD_FIGHT_DAYS * TICKS_PER_DAY);
    expect(w.tick - since).toBeLessThanOrEqual(CARAVAN_LEAVE_DAYS * TICKS_PER_DAY + 1);
    expect(trade.reader().activeCaravan()).toBeNull();
    expect(w.game.world.entities.alive(caravan.partyId)).toBe(false);
    expect(w.game.world.entities.alive(guard)).toBe(false);
  });

  it('departs at the limit with a member that cannot reach the edge, and the next caravan can come', () => {
    const { w, trade, caravan, raider, pocket, attack } = atDepot('t517-stuck');
    const merchant = caravan.merchants[0]!;
    w.movement.teleport(merchant, pocket);
    attack(raider, merchant);
    w.step(1);
    const since = trade.serialize().activeCaravan!.stateSince;
    w.until(() => w.events('CaravanDeparted').length > 0, (CARAVAN_LEAVE_DAYS + 1) * TICKS_PER_DAY);
    expect(w.events('CaravanDeparted')).toHaveLength(1);
    expect(w.tick - since).toBeGreaterThanOrEqual(CARAVAN_LEAVE_DAYS * TICKS_PER_DAY);
    expect(w.tick - since).toBeLessThanOrEqual(CARAVAN_LEAVE_DAYS * TICKS_PER_DAY + 1);
    expect(w.game.world.entities.alive(merchant)).toBe(false);
    expect(trade.reader().activeCaravan()).toBeNull();
  });

  it('counts the limit from the first attack, not the last', () => {
    const { w, trade, caravan, raider, attack } = atDepot('t517-repeated');
    attack(raider, caravan.merchants[0]!);
    w.step(1);
    const since = trade.serialize().activeCaravan!.stateSince;
    for (let i = 0; i < 5; i += 1) {
      w.step(50);
      const a = trade.serialize().activeCaravan;
      if (!a) break;
      expect(a.stateSince).toBe(since);
      attack(raider, caravan.merchants[0]!);
    }
  });
});
