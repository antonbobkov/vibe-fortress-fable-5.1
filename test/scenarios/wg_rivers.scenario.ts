/**
 * `wg_rivers` of `04-implementation/acceptance-tests.md` § 01 World generation:
 * "any seed | every river ends in ocean, a lake or a confluence; class monotone along the path".
 *
 * World generation runs before any world exists and outside the tick loop (`01` § Purpose), so
 * the driver generates the standard world itself; the flat-test world of the runner is unused.
 */

import { expect } from 'vitest';
import { WORLD_SIZE_STANDARD } from '@core/constants';
import { generate, type WorldMap } from '@systems/worldgen';
import { SEA_LEVEL } from '@systems/worldgen/constants';
import { classRank } from '@systems/worldgen/stages/rivers';
import type { Scenario } from './runner';

function checkRivers(world: WorldMap): void {
  expect(world.rivers.length).toBeGreaterThan(0);
  const earlier = new Set<number>();
  for (const river of world.rivers) {
    const path = river.regions;
    const last = world.regions[path[path.length - 1] as number];
    if (last === undefined) throw new Error('river ends outside the world');
    const ocean = last.elevation < SEA_LEVEL;
    const confluence = earlier.has(last.id);
    expect(ocean || last.lake || confluence, `river ${river.id} ends at ${last.id}`).toBe(true);
    for (let i = 0; i < path.length; i += 1) {
      const r = world.regions[path[i] as number];
      expect(r?.river).not.toBeNull();
      if (i > 0) {
        const prev = world.regions[path[i - 1] as number]?.river?.class ?? 'brook';
        expect(classRank(r?.river?.class ?? 'brook')).toBeGreaterThanOrEqual(classRank(prev));
      }
      if (i < path.length - 1) expect(r?.river?.outflow).not.toBeNull();
    }
    expect(river.class).toBe(last.river?.class);
    for (const id of path) earlier.add(id);
  }
}

const scenario: Scenario = {
  id: 'wg_rivers',
  milestone: 1,
  seed: 'wg-rivers',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    for (const seed of [w.game.world.seed, 'wg-rivers-2', 'wg-rivers-3']) {
      checkRivers(generate(seed, WORLD_SIZE_STANDARD, w.game.registry));
    }
  },
};

export default scenario;
