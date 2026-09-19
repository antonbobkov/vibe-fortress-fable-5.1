/**
 * `bd_support` of `04-implementation/acceptance-tests.md` § 14 Buildings: "construct a wall on open
 * space with no neighbor | rejected `bad_placement`" (via building placement, T-M2-05). A wall on
 * open space with a face neighbour to hold it is accepted.
 */

import { expect } from 'vitest';
import type { Scenario } from './runner';

const Z = 32;

const scenario: Scenario = {
  id: 'bd_support',
  milestone: 2,
  seed: 'bd-support',
  world: 'flat-test',
  embark: 'default',
  commands: [],
  run: (w) => {
    w.step(1);
    const alone = w.index(40, 40, Z + 4);
    const held = w.index(40, 40, Z + 1);
    w.discover(alone);
    w.discover(held);
    w.submit({ type: 'PlaceBuilding', buildingType: 'wall', origin: alone, orientation: 0, materialChoice: 0, priority: 5 });
    w.submit({ type: 'PlaceBuilding', buildingType: 'wall', origin: held, orientation: 0, materialChoice: 0, priority: 5 });
    w.step(1);
    const rejected = w.events('CommandRejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ reason: 'bad_placement' });
    expect((rejected[0]?.['command'] as { origin: number }).origin).toBe(alone);
    // The embark wagon (T-M2-08) is placed at arrival; the one wall is the only other placement.
    expect(w.events('BuildingPlaced').filter((e) => e['buildingType'] !== 'wagon')).toEqual([expect.objectContaining({ buildingType: 'wall' })]);
    expect(w.readers.of<{ at(i: number): number }>('14').at(alone)).toBe(0);
    expect(w.readers.of<{ at(i: number): number }>('14').at(held)).not.toBe(0);
  },
};

export default scenario;
