/**
 * `jb_priority` of `04-implementation/acceptance-tests.md` § 11 Jobs: "two dig jobs at priority 1
 * and 9 equidistant | priority 1 claimed first". Dig jobs from designations (D-056).
 */

import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import type { Scenario } from './runner';
import { onlyMiner } from './m1-helpers';

let low = -1;
let high = -1;

const scenario: Scenario = {
  id: 'jb_priority',
  milestone: 1,
  seed: 'jb-priority',
  world: 'flat-test',
  embark: 'default',
  setup: (w) => {
    const miner = onlyMiner(w);
    const at = w.map.unpack(w.movement.tileOf(miner));
    const granite = w.game.registry.table('materials').index('granite');
    low = w.index(at.x - 5, at.y + 4, at.z);
    high = w.index(at.x + 5, at.y + 4, at.z);
    for (const t of [low, high]) w.game.world.services.terrain.setKind(t, TileKind.Wall, granite);
    const apply = (tile: number, priority: number): void => {
      const r = w.game.world.applyCommand({ type: 'Designate', tiles: [tile], kind: 'dig', priority });
      if (!r.ok) throw new Error(`designate: ${r.reason}`);
    };
    apply(low, 9);
    apply(high, 1);
  },
  run: 5,
  expect: (w) => {
    const claims = w.events('JobClaimed');
    expect(claims.length).toBeGreaterThanOrEqual(1);
    expect(claims[0]?.['target']).toBe(high);
    expect(claims[0]?.['workerId']).toBe(w.game.arrival?.dwarves[0]);
  },
};

export default scenario;
