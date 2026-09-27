/** T-M7-01: a caravan waits three days for a depot, then costs two reputation. */
import { expect } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import { C } from '@core/components';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'td_no_depot', milestone: 7, seed: 'td-no-depot', world: 'flat-test', embark: 'none',
  startTick: 31 * TICKS_PER_DAY,
  run: (w) => {
    w.until((world) => world.events('CaravanWaiting').length > 0, 20 * TICKS_PER_DAY);
    const partyId = w.events('CaravanWaiting')[0]?.['partyId'] as number;
    const atArrival = w.game.world.entities.get(partyId, C.Party)?.arrivedTick ?? -1;
    w.until((world) => world.events('CaravanDeparted').length > 0, 4 * TICKS_PER_DAY);
    expect(w.tick - atArrival).toBeGreaterThanOrEqual(3 * TICKS_PER_DAY);
    expect(w.events('CaravanDeparted')[0]?.['reason']).toBe('no_depot');
    expect(w.game.world.fortress.reputation.hillfolk).toBe(-2);
  },
};
export default scenario;
