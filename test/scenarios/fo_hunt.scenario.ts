/**
 * `fo_hunt` of `04-implementation/acceptance-tests.md` § 09 Foraging and hunting:
 * "hunter with crossbow + 20 bolts, one deer | `HuntKill` within a day;
 * corpse hauled to the butcher; meat 3, hide 1, bones 1".
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'fo_hunt',
  milestone: 6,
  seed: 'fo-hunt',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    const z = FLAT_TEST_SURFACE_Z;
    const butcherTile = w.index(20, 20, z);
    const hunterTile = w.index(21, 20, z);
    const deerTile = w.index(25, 20, z);

    // Build butcher workshop
    const workshop = w.build('butcher', butcherTile);
    expect(workshop).toBeGreaterThan(0);

    // Spawn hunter dwarf
    const hunter = w.spawnDwarf({
      at: hunterTile,
      skills: { crossbow: 10, hunting: 5, butchery: 5 },
    });

    // Equip hunter with crossbow and 20 bolts in quiver
    const itemsTable = w.game.registry.table('items');
    const materialsTable = w.game.registry.table('materials');
    const iron = materialsTable.index('iron');

    const crossbow = w.spawnItem(itemsTable.index('crossbow'), iron, hunterTile);
    const bolts = w.spawnItem(itemsTable.index('bolt'), iron, hunterTile, 20);

    w.game.world.entities.add(hunter, C.Equipment, {
      weapon: crossbow,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: bolts,
    });

    // Spawn 1 wild deer
    const creaturesTable = w.game.registry.table('creatures');
    const deer = w.game.world.services.spawn.creature(creaturesTable.index('deer'), deerTile, 'wild');
    expect(deer).toBeGreaterThan(0);

    // Step world until HuntKill occurs (within 1 day = 1200 ticks)
    w.until((v) => v.events('HuntKill').length > 0, TICKS_PER_DAY);
    const killEvents = w.events('HuntKill');
    expect(killEvents.length).toBeGreaterThan(0);
    expect(killEvents[0]).toMatchObject({
      type: 'HuntKill',
      hunterId: hunter,
      targetId: deer,
    });

    // Continue until corpse is hauled to butcher and butchered
    w.until((v) => v.events('ButcheryDone').length > 0, TICKS_PER_DAY);
    const butcheryEvents = w.events('ButcheryDone');
    expect(butcheryEvents.length).toBeGreaterThan(0);

    const done = butcheryEvents[0];
    expect(done?.['yields']).toMatchObject({
      meat: 3,
      hide: 1,
      bone: 1,
    });
  },
};

export default scenario;
