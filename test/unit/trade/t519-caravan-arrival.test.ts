/**
 * T-519: in `three-years-p2-4` (shift 400) a Hillfolk caravan of twelve walked to the depot for good:
 * its twelfth member, a mule, arrived on an edge tile in a pocket below the surface that walks
 * nowhere, and the walk waits for every member. Members now arrive only where they can walk to a
 * depot (or, with none, to the first member's tile).
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { TradeSystem } from '@systems/trade';
import { TestWorld } from '../../scenarios/test-world';

/** A strip of the north edge, x 2 to 40, walled off from the rest of the map. */
function walledEdge(w: TestWorld): void {
  for (let x = 1; x <= 41; x += 1) w.build('wall', w.index(x, 1, 32), 'granite');
  w.build('wall', w.index(1, 0, 32), 'granite');
  w.build('wall', w.index(41, 0, 32), 'granite');
}

describe('T-519 a caravan arrives where it can walk', () => {
  it('spawns no member in a pocket of the edge, and reaches the depot', () => {
    const w = new TestWorld({ seed: 't519-pocket', world: 'flat-test', embark: 'none', startTick: 31 * TICKS_PER_DAY });
    const depot = w.build('trade_depot', w.index(45, 8, 32), 'granite');
    walledEdge(w);
    w.step(1);
    const pocket = w.index(10, 0, 32);
    expect(w.reachable(pocket, w.index(45, 8, 32)), 'the strip walks nowhere').toBe(false);
    w.until(() => w.events('CaravanArrived').length > 0, 20 * TICKS_PER_DAY);
    const trade = w.game.world.scheduler.byId('20') as TradeSystem;
    const caravan = trade.serialize().activeCaravan!;
    const depotTile = w.game.world.entities.get(depot, C.Building)!.origin;
    for (const id of [...caravan.merchants, ...caravan.guards, ...caravan.animals]) {
      const at = w.movement.tileOf(id);
      expect(w.reachable(at, depotTile), `member ${id} at ${w.map.xOf(at)},${w.map.yOf(at)},${w.map.zOf(at)}`).toBe(true);
    }
    w.until(() => w.events('CaravanAtDepot').length > 0, 2 * TICKS_PER_DAY);
    expect(w.events('CaravanAtDepot')).toHaveLength(1);
  });

  it('with no depot, every member arrives where it can walk to the first', () => {
    const w = new TestWorld({ seed: 't519-nodepot', world: 'flat-test', embark: 'none', startTick: 31 * TICKS_PER_DAY });
    walledEdge(w);
    w.step(1);
    w.until(() => w.events('CaravanArrived').length > 0, 20 * TICKS_PER_DAY);
    const trade = w.game.world.scheduler.byId('20') as TradeSystem;
    const caravan = trade.serialize().activeCaravan!;
    for (const id of [...caravan.merchants, ...caravan.guards, ...caravan.animals]) {
      expect(w.reachable(w.movement.tileOf(id), caravan.edgeTile), `member ${id}`).toBe(true);
    }
  });
});
