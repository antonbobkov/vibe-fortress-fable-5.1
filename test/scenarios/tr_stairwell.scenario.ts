/**
 * `tr_stairwell` of `04-implementation/acceptance-tests.md` § 03 Terrain: "`DesignateStairwell` 3
 * levels | up/down stairs carved; connectivity label equal across levels".
 *
 * From the `flat-test` surface (z = 32) down to z = 30: down stairs at the top, up/down stairs
 * between, up stairs at the bottom. The lower tiles are carved from the stairs above them (D-058).
 */

import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import type { Scenario } from './runner';
import { onlyMiner } from './m1-helpers';

const X = 52;
const Y = 16;

const scenario: Scenario = {
  id: 'tr_stairwell',
  milestone: 1,
  seed: 'tr-stairwell',
  world: 'flat-test',
  embark: 'default',
  setup: (w) => {
    onlyMiner(w);
    const r = w.game.world.applyCommand({ type: 'DesignateStairwell', x: X, y: Y, zTop: 32, zBottom: 30 });
    if (!r.ok) throw new Error(`stairwell: ${r.reason}`);
  },
  run: (w) => {
    w.until((world) => world.map.kindAt(world.index(X, Y, 30)) === TileKind.StairsUp, 3_000);
    w.step(2);
  },
  expect: (w) => {
    expect(w.map.kindAt(w.index(X, Y, 32))).toBe(TileKind.StairsDown);
    expect(w.map.kindAt(w.index(X, Y, 31))).toBe(TileKind.StairsUpDown);
    expect(w.map.kindAt(w.index(X, Y, 30))).toBe(TileKind.StairsUp);
    const label = (z: number): number => w.pathing.connectivity.label(w.index(X, Y, z), 'walker');
    expect(label(32)).toBeGreaterThan(0);
    expect(label(31)).toBe(label(32));
    expect(label(30)).toBe(label(32));
    expect(w.events('JobCompleted').filter((e) => e['jobType'] === 'carve_stairs')).toHaveLength(3);
  },
};

export default scenario;
