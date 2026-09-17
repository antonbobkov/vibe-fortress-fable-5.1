/**
 * `pf_labels` of `04-implementation/acceptance-tests.md` § 22 Pathfinding:
 * "wall off a room | labels differ; open a door → equal after the next tick".
 *
 * The room and the corridor are dug one level below the `flat-test` surface and joined by a single
 * doorway tile. The door is the building-dependent passability hook of `22` § Passability, which
 * 14 buildings will own from M2 and which `TestWorld.setBuildingBlock` drives here; closing it and
 * opening it dirties the chunk exactly as `BuildingStateChanged` will.
 */

import { expect } from 'vitest';
import type { Scenario } from './runner';

const Z = 31;
const DOORWAY: [number, number] = [25, 20];

const scenario: Scenario = {
  id: 'pf_labels',
  milestone: 0,
  seed: 'pf-labels',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    w.digRoom(20, 20, Z, 5, 1); // corridor, x 20..24
    w.digRoom(DOORWAY[0], DOORWAY[1], Z, 1, 1); // the doorway tile
    w.digRoom(26, 18, Z, 5, 5); // the room, x 26..30, y 18..22
  },
  run: (w) => {
    const corridor = w.index(20, 20, Z);
    const room = w.index(28, 20, Z);
    const doorway = w.index(DOORWAY[0], DOORWAY[1], Z);

    // The labels are rebuilt at the end of a tick, so the dug shapes take effect on the first one.
    w.step(1);
    expect(w.reachable(corridor, room)).toBe(true);
    expect(w.pathing.connectivity.label(corridor, 'walker')).toBe(
      w.pathing.connectivity.label(room, 'walker'),
    );

    // Wall the room off: a locked door on the only doorway.
    w.setDoor(doorway, true);
    w.setBuildingBlock(doorway, true);
    w.step(1);
    expect(w.reachable(corridor, room)).toBe(false);
    expect(w.pathing.connectivity.label(corridor, 'walker')).not.toBe(
      w.pathing.connectivity.label(room, 'walker'),
    );

    // Open the door: equal again after the next tick, and not before it.
    w.setBuildingBlock(doorway, false);
    expect(w.reachable(corridor, room)).toBe(false);
    w.step(1);
    expect(w.reachable(corridor, room)).toBe(true);
    expect(w.pathing.connectivity.label(corridor, 'walker')).toBe(
      w.pathing.connectivity.label(room, 'walker'),
    );
  },
};

export default scenario;
