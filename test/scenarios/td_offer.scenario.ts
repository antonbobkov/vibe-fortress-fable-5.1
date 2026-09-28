/** T-M7-02: the depot job, broker session, offer arithmetic, and ownership transfer. */
import { expect } from 'vitest';
import { C, ItemFlag } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { TradeReader } from '@systems/trade/reader';
import { requiredValue } from '@systems/trade/valuation';
import type { Scenario } from './runner';

let depot = 0;
const scenario: Scenario = {
  id: 'td_offer', milestone: 7, seed: 'td-offer', world: 'flat-test', embark: 'none',
  startTick: 31 * TICKS_PER_DAY,
  setup: (w) => { depot = w.build('trade_depot', w.index(45, 8, 32), 'granite'); },
  run: (w) => {
    w.until((world) => world.events('CaravanAtDepot').length > 0, 20 * TICKS_PER_DAY);
    const building = w.game.world.entities.get(depot, C.Building);
    const tile = building?.footprint[0] as number;
    const broker = w.spawnDwarf({ at: tile });
    w.spawnDwarf({ at: tile });
    w.submit({ type: 'AssignTitle', dwarfId: broker, title: 'broker' });
    w.step(1);
    const bar = w.spawnItem('bar', 'deepsilver', tile, 10);
    const chair = w.spawnItem('chair', 'pine', tile);
    w.submit({ type: 'MoveToDepot', itemIds: [bar, chair] });
    w.until((world) => [bar, chair].every((id) => ((world.game.world.entities.get(id, C.Item)?.flags ?? 0) & ItemFlag.AtDepot) !== 0), 300);
    expect(w.game.world.entities.get(bar, C.Item)?.containerId).toBe(depot);
    w.submit({ type: 'TradeOpen', depotId: depot });
    const trade = w.readers.of<TradeReader>('20');
    w.until(() => trade.sessionOpen(), 300);
    expect(trade.session()?.traderId).toBe(broker);
    const merchant = trade.merchantItems().filter((id) => {
      const it = w.game.world.entities.get(id, C.Item);
      return it?.containerId === depot && (it.occupantId ?? 0) === 0;
    }).sort((a, b) => trade.price('hillfolk', b) / (w.game.world.entities.get(b, C.Item)?.count ?? 1) - trade.price('hillfolk', a) / (w.game.world.entities.get(a, C.Item)?.count ?? 1))[0];
    expect(merchant).toBeDefined();
    w.submit({ type: 'TradeOffer', give: [{ itemId: chair, count: 1 }], take: [{ itemId: merchant, count: 1 }] });
    w.step(1);
    const merchantCount = w.game.world.entities.get(merchant as number, C.Item)?.count ?? 1;
    const requested = trade.price('hillfolk', merchant as number) / merchantCount;
    expect(w.events('TradeRefused')[0]?.['shortfall']).toBe(Math.ceil(requiredValue(requested, trade.marginPercent('hillfolk')) - trade.valuation('hillfolk', chair)));
    w.submit({ type: 'TradeOffer', give: [{ itemId: bar, count: w.game.world.entities.get(bar, C.Item)?.count }], take: [{ itemId: merchant, count: 1 }] });
    w.step(1);
    expect(w.events('TradeCompleted')).toHaveLength(1);
    expect(w.game.world.fortress.reputation.hillfolk).toBeGreaterThan(0);
    expect(trade.reputationLog('hillfolk').some((entry) => entry.reason === 'trade')).toBe(true);
    const acquired = w.game.world.entities.get(depot, C.Container)?.contents.some((id) => {
      const it = w.game.world.entities.get(id, C.Item);
      return it !== undefined && it.type === w.game.world.entities.get(merchant as number, C.Item)?.type && (it.flags & ItemFlag.Merchant) === 0;
    });
    expect(acquired).toBe(true);
    const beforeGift = trade.reputation('hillfolk');
    const giftValue = trade.valuation('hillfolk', chair);
    w.submit({ type: 'TradeOffer', give: [{ itemId: chair, count: 1 }], take: [] });
    w.step(1);
    expect(w.events('GiftGiven')).toHaveLength(1);
    expect(trade.reputation('hillfolk')).toBeCloseTo(beforeGift + giftValue / 100);
    expect((w.game.world.entities.get(chair, C.Item)?.flags ?? 0) & ItemFlag.Merchant).toBeTruthy();
    w.submit({ type: 'TradeCancel' });
    w.step(1);
    expect(trade.sessionOpen()).toBe(false);
    w.submit({ type: 'TradeOpen', depotId: depot });
    w.until(() => trade.sessionOpen(), 300);
  },
};
export default scenario;
