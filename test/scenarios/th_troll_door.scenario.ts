/**
 * `th_troll_door` of `04-implementation/acceptance-tests.md` § 18 Threats:
 * "trollkin at a locked door | DoorBroken after DOOR_BREAK_TICKS"
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import { DOOR_BREAK_TICKS } from '@systems/buildings/constants';
import { spawnHostileMember } from '@systems/threats';
import type { BuildingsReader } from '@systems/buildings/reader';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';

let doorBuildingId = 0;
let doorTile = 0;

const scenario: Scenario = {
  id: 'th_troll_door',
  milestone: 6,
  seed: 'th-troll-door',
  world: 'flat-test',
  embark: 'none',
  setup: (w: TestWorld) => {
    const z = FLAT_TEST_SURFACE_Z;
    doorTile = w.index(24, 24, z);

    // Wall off the row around the door first so the floor tile has flanking walls
    for (let x = 0; x < w.map.w; x++) {
      if (x !== 24) {
        const t = w.index(x, 24, z);
        w.carve(t, TileKind.Wall);
        w.setBuildingBlock(t, true);
      }
    }

    // Now (24, 24) is a floor_between_walls, so build door
    doorBuildingId = w.build('door', doorTile, 'granite');
    w.game.world.applyCommand({
      type: 'SetDoorMode',
      buildingId: doorBuildingId,
      mode: 'locked',
    });

    // Place a dwarf on the other side at (24, 26) as goal
    w.spawnDwarf({ at: w.index(24, 26, z) });

    // Create a siege party
    const partyId = w.game.world.entities.create('party');
    w.game.world.entities.add(partyId, C.Party, {
      civ: 'gloam',
      purpose: 'siege',
      members: [],
      leaderId: 0,
      state: 'approach',
      goalTile: w.index(24, 26, z),
      goalEntity: 0,
      arrivedTick: w.tick,
      stateSince: w.tick,
      loot: [],
      edge: 'n',
      size: 1,
    });

    // Spawn trollkin at (24, 23), directly adjacent to the locked door
    const trollkinTile = w.index(24, 23, z);
    spawnHostileMember(
      w.game.world,
      w.game.registry,
      w.game.world.rngFor('18'),
      partyId,
      'trollkin',
      'warriors',
      trollkinTile,
      1,
      false,
    );
  },
  run: (w: TestWorld) => {
    const buildings = w.readers.of<BuildingsReader>('14');

    // 1. Trollkin is adjacent to locked door and begins breaking it
    w.step(1);
    expect(w.events('DoorBreakAttempt').length).toBeGreaterThan(0);

    // 2. Step until DOOR_BREAK_TICKS has elapsed
    // At tick 600, DoorBroken is emitted and the door building is removed
    w.until((world) => world.events('DoorBroken').some((e) => e['id'] === doorBuildingId), DOOR_BREAK_TICKS + 10);

    const doorBroken = w.events('DoorBroken').find((e) => e['id'] === doorBuildingId);
    expect(doorBroken).toBeDefined();

    // 3. The door building is removed and no door remains at the tile
    expect(buildings.doorAt(doorTile)).toBe(false);
    expect(buildings.at(doorTile)).toBe(0);
  },
};

export default scenario;
