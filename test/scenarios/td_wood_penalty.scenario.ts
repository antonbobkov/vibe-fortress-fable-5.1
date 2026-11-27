/** T-M7-02: offering wooden goods to Wildwood reduces reputation once per item per session. */
import { expect } from 'vitest';
import { C, ItemFlag } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { TradeReader } from '@systems/trade/reader';
import type { Scenario } from './runner';

let depot = 0;
const scenario: Scenario = {
  id: 'td_wood_penalty', milestone: 7, seed: 'td-wood-penalty', world: 'flat-test', embark: 'none',
  startTick: 59 * TICKS_PER_DAY,
  setup: (w) => {
    depot = w.build('trade_depot', w.index(45, 8, 32), 'granite');
    w.game.world.fortress.reputation.hillfolk = -50;
  },
  run: (w) => {
    w.until((world) => world.events('CaravanAtDepot').length > 0, 20 * TICKS_PER_DAY);
    expect(w.readers.of<TradeReader>('20').activeCaravan()?.civ).toBe('wildwood');
    const tile = w.game.world.entities.get(depot, C.Building)?.footprint[0] as number;
    w.spawnDwarf({ at: tile });
    const chairs = Array.from({ length: 3 }, () => w.spawnItem('chair', 'oak', tile));
    w.submit({ type: 'MoveToDepot', itemIds: chairs });
    w.until((world) => chairs.every((chair) => ((world.game.world.entities.get(chair, C.Item)?.flags ?? 0) & ItemFlag.AtDepot) !== 0), 300);
    w.submit({ type: 'TradeOpen', depotId: depot });
    const trade = w.readers.of<TradeReader>('20');
    w.until(() => trade.sessionOpen(), 300);
    const selected = trade.merchantItems().filter((id) => w.game.world.entities.get(id, C.Item)?.containerId === depot).sort((a, b) => trade.price('wildwood', b) - trade.price('wildwood', a))[0];
    expect(selected).toBeDefined();
    w.submit({ type: 'TradeOffer', give: chairs.map((itemId) => ({ itemId, count: 1 })), take: [{ itemId: selected, count: 1 }] });
    w.step(1);
    expect(w.events('TradeRefused')).toHaveLength(1);
    expect(trade.reputation('wildwood')).toBe(-6);
    expect(trade.session()?.woodWarning).toBe(true);
    w.submit({ type: 'TradeOffer', give: chairs.map((itemId) => ({ itemId, count: 1 })), take: [{ itemId: selected, count: 1 }] });
    w.step(1);
    expect(trade.reputation('wildwood')).toBe(-6);
    const bar = w.spawnItem('bar', 'deepsilver', tile, 10);
    w.submit({ type: 'MoveToDepot', itemIds: [bar] });
    w.until((world) => ((world.game.world.entities.get(bar, C.Item)?.flags ?? 0) & ItemFlag.AtDepot) !== 0, 300);
    w.submit({ type: 'TradeOffer', give: [...chairs.map((itemId) => ({ itemId, count: 1 })), { itemId: bar, count: w.game.world.entities.get(bar, C.Item)?.count }], take: [{ itemId: selected, count: 1 }] });
    w.step(1);
    expect(w.game.world.commandLog.all().at(-1)?.result).toEqual({ ok: true });
    expect(w.events('TradeCompleted')).toHaveLength(1);
    expect(trade.reputationLog('wildwood').filter((entry) => entry.reason === 'wood_offered').reduce((sum, entry) => sum + entry.delta, 0)).toBe(-6);
  },
};
export default scenario;
