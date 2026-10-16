/** T-336: a container built after an item found no home gives that item a home. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

describe('T-336 a hospital chest built after its zone is stocked', () => {
  it('hauls cloth that had no home into the chest when the chest is built', () => {
    const w = new TestWorld({ seed: 't336-hospital-chest', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const world = w.game.world;
    const jobs = w.readers.of<JobsReader>('11');
    const bedTile = w.index(40, 40, Z), chestTile = w.index(41, 40, Z);
    w.zone('hospital', [bedTile, chestTile]);
    w.build('bed', bedTile, 'oak');
    const cloth = w.spawnItem('cloth', 'flax_cloth', w.index(20, 40, Z), 5);
    const hauler = w.spawnDwarf({ at: w.index(21, 40, Z) });
    for (const need of NEEDS) w.setNeed(hauler, need, 0);
    // The cloth is looked at while the hospital has no chest: it has no home, and no haul is made.
    w.step(60);
    expect(jobs.byKey(`haul:${cloth}`)).toBeUndefined();
    const chest = w.build('chest', chestTile, 'oak');
    const chestItem = world.entities.get(chest, C.Building)!.itemId;
    w.until(() => world.entities.get(cloth, C.Item)?.containerId === chestItem, 600);
  });
});
