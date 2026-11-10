/**
 * T-542: in `three-years-p2-2` (shifts 100 and 150) a Hillfolk caravan walked to the depot for
 * good: a mule's place on the ring around the depot grew a tree while the mule walked there, and the
 * walk waits for every member. A member whose place can no longer be reached now takes another.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { TradeSystem } from '@systems/trade';
import { TestWorld } from '../../scenarios/test-world';

function growTree(w: TestWorld, t: TileIndex): void {
  w.game.world.services.terrain.setKind(t, TileKind.Tree, w.game.registry.table('materials').index('oak'));
}

function caravanOf(w: TestWorld): ReturnType<TradeSystem['serialize']>['activeCaravan'] {
  return (w.game.world.scheduler.byId('20') as TradeSystem).serialize().activeCaravan;
}

describe('T-542 a caravan member whose place at the depot is blocked takes another', () => {
  it('a tree grown on every non-merchant place on the way still lets the caravan reach the depot', () => {
    const w = new TestWorld({ seed: 't542-tree', world: 'flat-test', embark: 'none', startTick: 31 * TICKS_PER_DAY });
    const depot = w.build('trade_depot', w.index(45, 8, 32), 'granite');
    w.step(1);
    w.until(() => w.events('CaravanArrived').length > 0, 20 * TICKS_PER_DAY);
    const caravan = caravanOf(w)!;
    expect(caravan.state).toBe('toDepot');
    const footprint = w.game.world.entities.get(depot, C.Building)!.footprint;
    // The places of the guards and animals around the depot grow trees before anyone gets there.
    const blocked = new Set<TileIndex>();
    for (const id of [...caravan.guards, ...caravan.animals]) {
      const place = caravan.destinations[id]!;
      expect(footprint.includes(place), `member ${id} stands around the depot`).toBe(false);
      if (!blocked.has(place)) growTree(w, place);
      blocked.add(place);
    }
    w.step(1);
    for (const t of blocked) expect(w.reachable(t, footprint[0]!), 'a tree is no place to stand').toBe(false);
    w.until(() => w.events('CaravanAtDepot').length > 0, 3 * TICKS_PER_DAY);
    expect(w.events('CaravanAtDepot')).toHaveLength(1);
    const after = caravanOf(w)!;
    for (const id of [...after.guards, ...after.animals]) {
      const at = w.movement.tileOf(id);
      expect(blocked.has(after.destinations[id]!), `member ${id} is bound elsewhere`).toBe(false);
      expect(at, `member ${id} stands at its new place`).toBe(after.destinations[id]);
    }
  });

  it('a merchant whose place inside the depot is cut off stands at another inside it', () => {
    const w = new TestWorld({ seed: 't542-inside', world: 'flat-test', embark: 'none', startTick: 31 * TICKS_PER_DAY });
    w.build('trade_depot', w.index(45, 8, 32), 'granite');
    w.step(1);
    w.until(() => w.events('CaravanArrived').length > 0, 20 * TICKS_PER_DAY);
    const caravan = caravanOf(w)!;
    const merchant = caravan.merchants[0]!;
    const place = caravan.destinations[merchant]!;
    w.setBuildingBlock(place, true);
    w.step(1);
    w.until(() => w.events('CaravanAtDepot').length > 0, 3 * TICKS_PER_DAY);
    expect(w.events('CaravanAtDepot')).toHaveLength(1);
    const after = caravanOf(w)!;
    expect(after.destinations[merchant]).not.toBe(place);
    expect(w.game.world.entities.get(after.depotId, C.Building)!.footprint).toContain(after.destinations[merchant]);
  });
});
