/** T-517: an attacked caravan whose guard holds a target it cannot reach still leaves the map. */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { CARAVAN_LEAVE_DAYS, type TradeSystem } from '@systems/trade';
import { TestWorld } from '../../scenarios/test-world';

function atDepot(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', startTick: 31 * TICKS_PER_DAY });
  w.build('trade_depot', w.index(45, 8, 32), 'granite');
  w.until(() => w.events('CaravanAtDepot').length > 0, 20 * TICKS_PER_DAY);
  const trade = w.game.world.scheduler.byId('20') as TradeSystem;
  const caravan = trade.serialize().activeCaravan!;
  // A raider sealed in a pocket under the ground: alive, hostile, out of every guard's reach.
  w.digRoom(10, 60, 29, 3, 3);
  const raider = w.spawnCreature('gloam_warrior', w.index(11, 61, 29), 'hostile:gloam');
  w.step(1);
  expect(w.reachable(w.index(11, 61, 29), w.index(45, 8, 32))).toBe(false);
  return { w, trade, caravan, raider };
}

describe('T-517 an attacked caravan leaves within its limit', () => {
  it('sets the party to leave with the caravan, and departs though a guard keeps an unreachable target', () => {
    const { w, trade, caravan, raider } = atDepot('t517-unreachable');
    const merchant = caravan.merchants[0]!;
    const guard = caravan.guards[0]!;
    w.game.world.emit({ type: 'AttackResolved', attackerId: raider, defenderId: merchant, part: 'torso', damageType: 'blunt', amount: 1, outcome: 'hit' });
    w.step(1);
    expect(trade.reader().activeCaravan()?.state).toBe('leave');
    expect(w.game.world.entities.get(caravan.partyId, C.Party)?.state).toBe('leave');
    expect(w.game.world.services.combat?.targetOf(guard)).toBe(raider);
    const attackTick = w.tick;
    w.until(() => w.events('CaravanDeparted').length > 0, (CARAVAN_LEAVE_DAYS + 1) * TICKS_PER_DAY);
    expect(w.events('CaravanDeparted').length).toBe(1);
    expect(w.tick - attackTick).toBeLessThanOrEqual(CARAVAN_LEAVE_DAYS * TICKS_PER_DAY + 1);
    expect(trade.reader().activeCaravan()).toBeNull();
    expect(w.game.world.entities.alive(caravan.partyId)).toBe(false);
    for (const id of [...caravan.merchants, ...caravan.guards, ...caravan.animals]) expect(w.game.world.entities.alive(id)).toBe(false);
    expect(w.game.world.entities.alive(raider)).toBe(true);
  });

  it('keeps the limit from the first attack, not the last', () => {
    const { w, trade, caravan, raider } = atDepot('t517-repeated');
    const merchant = caravan.merchants[0]!;
    const attack = () => w.game.world.emit({ type: 'AttackResolved', attackerId: raider, defenderId: merchant, part: 'torso', damageType: 'blunt', amount: 1, outcome: 'hit' });
    attack();
    w.step(1);
    const since = trade.serialize().activeCaravan!.stateSince;
    for (let i = 0; i < 5; i += 1) { w.step(100); if (trade.reader().activeCaravan()) attack(); }
    expect(trade.serialize().activeCaravan?.stateSince ?? since).toBe(since);
  });
});
