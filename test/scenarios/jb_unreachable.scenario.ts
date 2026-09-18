/**
 * `jb_unreachable` of `04-implementation/acceptance-tests.md` § 11 Jobs: "dig target behind a
 * locked door | `JobBlocked { unreachable }`; unlock → `JobUnblocked` within `BLOCKED_RETRY_TICKS`".
 *
 * A pen of walls on the `flat-test` surface whose one gap is held by a blocking building through
 * `TestWorld`'s passability hook (22's `blocksMovementAt`), standing in for the locked door of 14
 * (M2). The dig target is inside. Unlocking takes the block away, which dirties the chunk but
 * changes no tile, so only the periodic retry can see it.
 */

import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import { BLOCKED_RETRY_TICKS } from '@systems/jobs/constants';
import type { Scenario } from './runner';
import { onlyMiner } from './m1-helpers';

const X0 = 60;
const Y0 = 30;
const SIZE = 7;
const Z = 32;

const scenario: Scenario = {
  id: 'jb_unreachable',
  milestone: 1,
  seed: 'jb-unreachable',
  world: 'flat-test',
  embark: 'default',
  setup: (w) => {
    onlyMiner(w);
    const terrain = w.game.world.services.terrain;
    const granite = w.game.registry.table('materials').index('granite');
    for (let k = 0; k < SIZE; k += 1) {
      for (const [x, y] of [
        [X0 + k, Y0],
        [X0 + k, Y0 + SIZE - 1],
        [X0, Y0 + k],
        [X0 + SIZE - 1, Y0 + k],
      ] as const) {
        terrain.setKind(w.index(x, y, Z), TileKind.Wall, granite);
      }
    }
    const gate = w.index(X0 + 3, Y0, Z);
    terrain.setKind(gate, TileKind.Floor, granite);
    w.setBuildingBlock(gate, true);
    const target = w.index(X0 + 3, Y0 + 3, Z);
    terrain.setKind(target, TileKind.Wall, granite);
    const r = w.game.world.applyCommand({ type: 'Designate', tiles: [target], kind: 'dig' });
    if (!r.ok) throw new Error(`designate: ${r.reason}`);
  },
  run: (w) => {
    w.step(20);
    const blocked = w.events('JobBlocked');
    expect(blocked).toHaveLength(1);
    expect(blocked[0]).toMatchObject({ reason: 'unreachable', jobType: 'dig' });
    expect(w.events('JobUnblocked')).toHaveLength(0);
    // Unlock.
    w.setBuildingBlock(w.index(X0 + 3, Y0, Z), false);
    const spent = w.until((world) => world.events('JobUnblocked').length > 0, BLOCKED_RETRY_TICKS + 1);
    expect(spent).toBeLessThanOrEqual(BLOCKED_RETRY_TICKS);
    w.until((world) => world.map.kindAt(world.index(X0 + 3, Y0 + 3, Z)) === TileKind.Floor, 1_500);
  },
};

export default scenario;
