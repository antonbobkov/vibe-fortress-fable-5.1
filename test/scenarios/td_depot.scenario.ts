/** T-M7-01: a reachable depot receives merchant cargo and holds the caravan for five days. */
import { expect } from 'vitest';
import { C, ItemFlag } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { Scenario } from './runner';

let depot = 0;
const scenario: Scenario = {
  id: 'td_depot', milestone: 7, seed: 'td-depot', world: 'flat-test', embark: 'none',
  startTick: 31 * TICKS_PER_DAY,
  setup: (w) => { depot = w.build('trade_depot', w.index(45, 8, 32), 'granite'); },
  run: (w) => {
    w.until((world) => world.events('CaravanAtDepot').length > 0, 20 * TICKS_PER_DAY);
    expect(w.events('CaravanWaiting')).toHaveLength(0);
    const container = w.game.world.entities.get(depot, C.Container);
    expect(container?.contents.length).toBeGreaterThan(0);
    const arrived = w.events('CaravanArrived')[0];
    const footprint = w.game.world.entities.get(depot, C.Building)?.footprint ?? [];
    for (const id of arrived?.['merchants'] as number[]) {
      const pos = w.game.world.entities.get(id, C.Position);
      expect(pos && footprint.includes(w.index(pos.x, pos.y, pos.z))).toBeTruthy();
    }
    for (const id of [...(arrived?.['guards'] as number[]), ...(arrived?.['animals'] as number[])]) {
      const pos = w.game.world.entities.get(id, C.Position);
      expect(pos && footprint.includes(w.index(pos.x, pos.y, pos.z))).toBeFalsy();
    }
    for (const itemId of container?.contents ?? []) {
      expect((w.game.world.entities.get(itemId, C.Item)?.flags ?? 0) & ItemFlag.Merchant).toBeTruthy();
    }
    const atDepotTick = w.tick;
    w.until((world) => world.events('CaravanDeparted').length > 0, 6 * TICKS_PER_DAY);
    expect(w.tick - atDepotTick).toBeGreaterThanOrEqual(5 * TICKS_PER_DAY - 1);
    expect(w.game.world.entities.get(depot, C.Container)?.contents).toHaveLength(0);
  },
};
export default scenario;
