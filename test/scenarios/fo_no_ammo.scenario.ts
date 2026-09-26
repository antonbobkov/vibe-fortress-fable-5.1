/**
 * `fo_no_ammo` of `04-implementation/acceptance-tests.md` § 09 Foraging and hunting:
 * "hunter with crossbow and no bolts | no `hunt` job; jobs panel reason `no_tool`".
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { JobsReader } from '@systems/jobs';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'fo_no_ammo',
  milestone: 6,
  seed: 'fo-no-ammo',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    const z = FLAT_TEST_SURFACE_Z;
    const hunterTile = w.index(20, 20, z);
    const deerTile = w.index(25, 20, z);

    // Spawn hunter dwarf
    const hunter = w.spawnDwarf({
      at: hunterTile,
      skills: { crossbow: 5, hunting: 5 },
    });

    // Equip hunter with crossbow and NO bolts
    const itemsTable = w.game.registry.table('items');
    const materialsTable = w.game.registry.table('materials');
    const iron = materialsTable.index('iron');

    const crossbow = w.spawnItem(itemsTable.index('crossbow'), iron, hunterTile);

    w.game.world.entities.add(hunter, C.Equipment, {
      weapon: crossbow,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });

    // Spawn 1 wild deer
    const creaturesTable = w.game.registry.table('creatures');
    const deer = w.game.world.services.spawn.creature(creaturesTable.index('deer'), deerTile, 'wild');
    expect(deer).toBeGreaterThan(0);

    // Step world for assignment cycle
    w.step(20);

    // Hunter should not be executing a hunt job
    const worker = w.game.world.entities.get(hunter, C.Worker);
    expect(worker?.jobId ?? 0).toBe(0);

    // Jobs reader shows the hunt job is blocked with reason 'no_tool'
    const jobs = w.readers.of<JobsReader>('11');
    const huntJob = jobs.byKey(`hunt:${deer}`);
    expect(huntJob).toBeDefined();
    expect(huntJob?.state).toBe('blocked');
    expect(huntJob?.blockedReason).toBe('no_tool');

    // JobBlocked event emitted with reason 'no_tool'
    const blockedEvents = w.events('JobBlocked');
    expect(blockedEvents.some((e) => e['reason'] === 'no_tool' && e['jobType'] === 'hunt')).toBe(true);
  },
};

export default scenario;
