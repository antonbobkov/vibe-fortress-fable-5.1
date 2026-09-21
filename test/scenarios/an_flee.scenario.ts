/**
 * `an_flee` of `04-implementation/acceptance-tests.md` § 08 Animals: "deer 8 tiles from a dwarf |
 * deer enters `flee` within 10 ticks; distance increases".
 *
 * `08` § Perception and brains: a wild animal within `NEAR_DWARF_RADIUS` of a dwarf thinks every
 * tick; § Wild behavior: a `timid` species fears dwarves, and `flee` runs to the tile of the
 * sampled directions that maximises the distance from them.
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { AnimalsReader } from '@systems/animals';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';

const DWARF_X = 40;
const DEER_X = 48;
const Y = 48;

let deer = 0;
let dwarf = 0;
let startDistance = 0;

function distance(w: TestWorld): number {
  const p = w.movement.tileOf(deer);
  const d = w.movement.tileOf(dwarf);
  return Math.max(Math.abs(w.map.xOf(p) - w.map.xOf(d)), Math.abs(w.map.yOf(p) - w.map.yOf(d)));
}

const scenario: Scenario = {
  id: 'an_flee',
  milestone: 4,
  seed: 'an-flee',
  world: 'flat-test',
  embark: 'none',
  setup: (w: TestWorld) => {
    dwarf = w.spawnDwarf({ at: w.index(DWARF_X, Y, FLAT_TEST_SURFACE_Z) });
    deer = w.spawnCreature('deer', w.index(DEER_X, Y, FLAT_TEST_SURFACE_Z), 'wild');
    startDistance = DEER_X - DWARF_X;
    expect(startDistance).toBe(8);
  },
  run: (w: TestWorld) => {
    const animals = w.readers.of<AnimalsReader>('08');
    expect(animals.isWild(deer)).toBe(true);
    const ticks = w.until((world) => world.readers.of<AnimalsReader>('08').state(deer) === 'flee', 10);
    expect(ticks).toBeLessThanOrEqual(10);
    expect(animals.state(deer)).toBe('flee');
    expect(distance(w)).toBeGreaterThanOrEqual(startDistance);
    w.step(60);
    // The deer keeps its distance and never walks back towards the dwarf.
    expect(distance(w)).toBeGreaterThan(startDistance);
  },
};

export default scenario;
