/**
 * `ws_out_of_reach` of `04-implementation/acceptance-tests.md` § 12 Workshops; `12` § Operation 2.
 *
 * T-648: the smelter's first order, a steel bar, counts the charcoal locked in a walled pen as its
 * fuel, but none of it lies within its worker's reach. The smelter skips that order for its next
 * one, a lignite smelt, and says why ("charcoal out of reach"); it looks at the steel again after
 * `OUT_OF_REACH_RETRY_TICKS` and finds it still out of reach; when the pen's door opens it makes it.
 * The lignite's one coal bar is fuel within reach, but a steel bar takes two (one into the steel,
 * one burned), so the steel waits on the charcoal in the pen.
 */

import { expect } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import type { WorkshopsReader } from '@systems/workshops';
import { OUT_OF_REACH_RETRY_TICKS } from '@systems/workshops/constants';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';

const Z = 32;
const X0 = 30;
const Y0 = 10;
const SIZE = 5;
let door: EntityId = 0;
let smelter: EntityId = 0;

const crafted = (w: TestWorld, recipe: string): number =>
  w.events('ItemCrafted').filter((e) => e['recipeId'] === recipe).length;

const scenario: Scenario = {
  id: 'ws_out_of_reach',
  milestone: 5,
  seed: 'ws-out-of-reach',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    const terrain = w.game.world.services.terrain;
    const granite = w.game.registry.table('materials').index('granite');
    for (let k = 0; k < SIZE; k += 1) {
      for (const [x, y] of [[X0 + k, Y0], [X0 + k, Y0 + SIZE - 1], [X0, Y0 + k], [X0 + SIZE - 1, Y0 + k]] as const) {
        terrain.setKind(w.index(x, y, Z), TileKind.Wall, granite);
      }
    }
    const gate = w.index(X0 + 2, Y0 + SIZE - 1, Z);
    terrain.setKind(gate, TileKind.Floor, granite);
    door = w.build('door', gate, 'oak');
    const locked = w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'locked' });
    if (!locked.ok) throw new Error(`lock: ${locked.reason}`);
    w.spawnItem('charcoal_bar', 'charcoal', w.index(X0 + 2, Y0 + 2, Z), 2);
    smelter = w.build('smelter', w.index(15, 15, Z));
    w.spawnItem('bar', 'iron', w.index(18, 17, Z));
    w.spawnItem('raw_stone', 'limestone', w.index(19, 17, Z));
    w.spawnItem('ore', 'lignite', w.index(19, 18, Z));
    w.spawnItem('easy_meal', 'dimcap', w.index(22, 22, Z), 20);
    w.spawnItem('drink', 'ale', w.index(23, 22, Z), 20);
    w.spawnDwarf({ at: w.index(18, 19, Z), skills: { smelting: 8 } });
  },
  run: (w) => {
    w.step(1);
    for (const recipeId of ['alloy_steel', 'smelt_lignite']) {
      expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: smelter,
        order: { recipeId, mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
    }
    const workshops = w.readers.of<WorkshopsReader>('12');
    // The steel is skipped while the door is locked: the lignite is smelted, and no steel job is made.
    w.until((x) => crafted(x, 'smelt_lignite') > 0, 2_000);
    expect(crafted(w, 'alloy_steel')).toBe(0);
    expect(w.events('JobCreated').filter((e) => e['jobType'] === 'craft')).toHaveLength(1);
    expect(workshops.isRunnable('alloy_steel', smelter)).toEqual({ runnable: false, reason: 'out of reach charcoal_bar' });
    w.step(5);
    expect(w.events('WorkshopBlocked').filter((e) => e['workshopId'] === smelter))
      .toEqual([expect.objectContaining({ reason: 'out_of_reach', input: 'charcoal_bar' })]);
    // Looked at again after a while, the charcoal is still out of reach.
    w.step(OUT_OF_REACH_RETRY_TICKS + 10);
    expect(crafted(w, 'alloy_steel')).toBe(0);
    expect(w.game.world.entities.get(smelter, C.Workshop)?.currentJobId).toBe(0);
    expect(workshops.isRunnable('alloy_steel', smelter).reason).toBe('out of reach charcoal_bar');
    // The door opens: the smelter starts the steel at once and makes it.
    expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'open' })).toEqual({ ok: true });
    const started = w.until(() => (w.game.world.entities.get(smelter, C.Workshop)?.currentJobId ?? 0) !== 0, 10);
    expect(started).toBeLessThan(10);
    w.until((x) => crafted(x, 'alloy_steel') > 0, 2_000);
    expect(crafted(w, 'alloy_steel')).toBe(1);
  },
};

export default scenario;
