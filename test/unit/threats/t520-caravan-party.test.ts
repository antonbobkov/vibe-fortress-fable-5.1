/**
 * T-520: a caravan's party is 20's, not a threat party (18 § Party AI). 18's party think, casualty
 * check and morale skip it: a caravan that loses half its members or all of them is never put in
 * `retreat` or `gone`, never given an outcome or a morale, and never ends with a `RaidEnded` that
 * the legend, the thoughts or a count of repelled parties would read.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import type { TradeSystem } from '@systems/trade';
import { TestWorld } from '../../scenarios/test-world';

function atDepot(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', startTick: 31 * TICKS_PER_DAY });
  w.build('trade_depot', w.index(45, 8, 32), 'granite');
  w.until(() => w.events('CaravanAtDepot').length > 0, 20 * TICKS_PER_DAY);
  const trade = w.game.world.scheduler.byId('20') as TradeSystem;
  const caravan = trade.serialize().activeCaravan!;
  const party = () => w.game.world.entities.get(caravan.partyId, C.Party);
  const kill = (id: EntityId) => w.game.world.emit({
    type: 'DamageDealt', attackerId: 0, defenderId: id, part: 'head', damageType: 'edge', amount: 999, weaponId: 0,
  });
  // Every state the party passes through, sampled each tick for the next two threats thinks and more.
  const watch = (ticks: number): Set<string> => {
    const seen = new Set<string>();
    for (let t = 0; t < ticks; t += 1) {
      w.step(1);
      const P = party();
      if (P) seen.add(P.state);
      expect(P?.outcome).toBeUndefined();
      expect(P?.morale).toBeUndefined();
    }
    return seen;
  };
  return { w, caravan, party, kill, watch };
}

describe('T-520 the casualty check skips a caravan\'s party', () => {
  it('a caravan that loses half its guards and animals is not relabelled repelled', () => {
    const { w, caravan, party, kill, watch } = atDepot('t520-half');
    const members = [...caravan.guards, ...caravan.animals];
    const size = party()!.members.length;
    const lost = members.slice(0, Math.ceil(size / 2));
    expect(lost.length * 2).toBeGreaterThanOrEqual(size);
    for (const id of lost) kill(id);
    const seen = watch(150);
    for (const id of lost) expect(w.game.world.entities.alive(id)).toBe(false);
    expect(seen.has('retreat')).toBe(false);
    expect(seen.has('gone')).toBe(false);
    expect(w.events('RaidEnded')).toHaveLength(0);
  });

  it('a caravan whose every member dies ends as 20 ends it, not as a wiped raid', () => {
    const { w, caravan, kill, watch } = atDepot('t520-all');
    for (const id of [...caravan.merchants, ...caravan.guards, ...caravan.animals]) kill(id);
    const seen = watch(150);
    expect(seen.has('retreat')).toBe(false);
    expect(seen.has('gone')).toBe(false);
    expect(w.events('RaidEnded')).toHaveLength(0);
    expect(w.events('CaravanDeparted').map((e) => e['reason'])).toEqual(['lost']);
    expect(w.game.world.fortress.milestones.some((m) => m.id === 'm_raid')).toBe(false);
  });
});
