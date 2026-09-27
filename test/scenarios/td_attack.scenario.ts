/** T-M7-01: a fortress killer loses the caravan and closes trade for two years. */
import { expect } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import { C, ItemFlag } from '@core/components';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'td_attack', milestone: 7, seed: 'td-attack', world: 'flat-test', embark: 'none',
  startTick: 31 * TICKS_PER_DAY,
  setup: (w) => { w.build('trade_depot', w.index(45, 8, 32), 'granite'); },
  run: (w) => {
    w.until((world) => world.events('CaravanAtDepot').length > 0, 20 * TICKS_PER_DAY);
    const arrived = w.events('CaravanArrived')[0];
    const depotId = w.events('CaravanAtDepot')[0]?.['depotId'] as number;
    const stock = w.game.world.entities.get(depotId, C.Container)?.contents.slice() ?? [];
    expect(stock.length).toBeGreaterThan(0);
    const merchant = (arrived?.['merchants'] as number[])[0] as number;
    const killer = w.spawnCreature('dwarf', w.index(1, 1, 32), 'fortress');
    w.game.world.emit({ type: 'AttackResolved', attackerId: killer, defenderId: merchant, part: 'torso', damageType: 'blunt', amount: 1, outcome: 'hit' });
    w.step(1);
    const guard = (arrived?.['guards'] as number[])[0] as number;
    expect(w.game.world.services.combat?.targetOf(guard)).toBe(killer);
    w.game.world.emit({ type: 'DamageDealt', defenderId: merchant, attackerId: killer, part: 'torso', damageType: 'cut', amount: 100000 });
    w.until((world) => world.events('CaravanLost').length > 0, 8);
    expect(w.game.world.fortress.reputation.hillfolk).toBe(-60);
    expect(w.readers.of<{ isBanned(civ: 'hillfolk'): boolean }>('20').isBanned('hillfolk')).toBe(true);
    w.until((world) => world.events('CaravanDeparted').length > 0, TICKS_PER_DAY);
    for (const itemId of stock) expect((w.game.world.entities.get(itemId, C.Item)?.flags ?? 0) & ItemFlag.Merchant).toBe(0);
  },
};
export default scenario;
