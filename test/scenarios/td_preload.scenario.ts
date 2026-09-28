/** T-M7-02: prepare and remove stock at a depot before a caravan exists. */
import { expect } from 'vitest';
import { C, ItemFlag } from '@core/components';
import type { ItemsReader } from '@systems/items/reader';
import type { TradeReader } from '@systems/trade/reader';
import type { Scenario } from './runner';

let depot = 0;
const scenario: Scenario = {
  id: 'td_preload', milestone: 7, seed: 'td-preload', world: 'flat-test', embark: 'none',
  setup: (w) => { depot = w.build('trade_depot', w.index(45, 8, 32), 'granite'); },
  run: (w) => {
    expect(w.readers.of<TradeReader>('20').activeCaravan()).toBeNull();
    const tile = w.game.world.entities.get(depot, C.Building)?.footprint[0] as number;
    w.spawnDwarf({ at: tile });
    const bar = w.spawnItem('bar', 'iron', tile);
    w.submit({ type: 'MoveToDepot', itemIds: [bar] });
    w.until((world) => ((world.game.world.entities.get(bar, C.Item)?.flags ?? 0) & ItemFlag.AtDepot) !== 0, 300);
    const items = w.readers.of<ItemsReader>('13');
    expect(items.get(bar)?.containerId).toBe(depot);
    expect(items.available('bar')).toBe(0);
    w.submit({ type: 'RemoveFromDepot', itemIds: [bar] });
    w.step(1);
    expect((items.get(bar)?.flags ?? 0) & ItemFlag.AtDepot).toBe(0);
    expect(items.get(bar)?.containerId).toBe(0);
    expect(items.available('bar')).toBe(1);
  },
};
export default scenario;
