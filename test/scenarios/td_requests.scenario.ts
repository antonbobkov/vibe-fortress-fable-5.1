/** T-M7-02: a request is saved per civ and influences the next arrival. */
import { expect } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { TradeReader } from '@systems/trade/reader';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'td_requests', milestone: 7, seed: 'td-requests', world: 'flat-test', embark: 'none',
  startTick: 115 * TICKS_PER_DAY,
  setup: (w) => {
    w.game.world.fortress.reputation.hillfolk = -50;
    w.game.world.fortress.reputation.wildwood = -50;
  },
  run: (w) => {
    w.submit({ type: 'SetRequests', civ: 'mountainhome', entries: [{ itemType: 'bar', material: 'iron', priority: 3 }] });
    w.step(1);
    const trade = w.readers.of<TradeReader>('20');
    expect(trade.requests('mountainhome')).toEqual([{ itemType: 'bar', material: 'iron', priority: 3 }]);
    w.until((world) => world.events('CaravanArrived').some((e) => e['civ'] === 'mountainhome'), 20 * TICKS_PER_DAY);
    expect(trade.lastBrought('mountainhome')).toContain('bar');
    const types = w.game.registry.table('items');
    const materials = w.game.registry.table('materials');
    const units = trade.merchantItems().reduce((sum, id) => {
      const it = w.game.world.entities.get(id, C.Item);
      return sum + (it?.type === types.index('bar') && it.material === materials.index('iron') ? it.count : 0);
    }, 0);
    expect(units).toBeGreaterThanOrEqual(5);
  },
};
export default scenario;
