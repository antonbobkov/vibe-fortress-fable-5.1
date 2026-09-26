/**
 * `cb_squad_station` of `04-implementation/acceptance-tests.md` § 16 Combat:
 * "squad active at a station, raid arrives | members engage within perception; civilians flee"
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { CombatReader, SquadWithId } from '@systems/combat/reader';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';

let soldierId = 0;
let civilianId = 0;
let raiderId = 0;
let stationTile = 0;

const scenario: Scenario = {
  id: 'cb_squad_station',
  milestone: 6,
  seed: 'cb-squad-station',
  world: 'flat-test',
  embark: 'none',
  setup: (w: TestWorld) => {
    const z = FLAT_TEST_SURFACE_Z;
    stationTile = w.index(25, 25, z);
    const civTile = w.index(24, 25, z);
    const raiderTile = w.index(30, 25, z); // 5 tiles away, within perception (14) and threat (8)

    // Spawn soldier dwarf and equip with battleaxe
    soldierId = w.spawnDwarf({ at: stationTile });
    const itemsTable = w.game.registry.table('items');
    const materialsTable = w.game.registry.table('materials');
    const iron = materialsTable.index('iron');
    const axe = w.spawnItem(itemsTable.index('axe'), iron, stationTile);
    w.game.world.entities.add(soldierId, C.Equipment, {
      weapon: axe,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });
    w.setSkill(soldierId, 'axe', 4);

    // Spawn civilian dwarf
    civilianId = w.spawnDwarf({ at: civTile });

    // Create squad and configure active station
    w.game.world.applyCommand({ type: 'CreateSquad', name: 'Gate Guard' });
    const combat = w.readers.of<CombatReader>('16');
    const squads = combat.squads();
    expect(squads.length).toBeGreaterThan(0);
    const squad = squads[0] as SquadWithId;

    w.game.world.applyCommand({
      type: 'SetSquadStation',
      squadId: squad.id,
      tile: stationTile,
    });
    w.game.world.applyCommand({
      type: 'SetSquadMode',
      squadId: squad.id,
      mode: 'active',
    });
    w.game.world.applyCommand({
      type: 'SetSquadMembers',
      squadId: squad.id,
      members: [soldierId],
    });

    // Step once to settle squad state
    w.step(1);
    expect(combat.onDuty(soldierId)).toBe(true);
    expect(combat.onDuty(civilianId)).toBe(false);

    // Raid arrives: spawn hostile gloam warrior
    raiderId = w.spawnCreature('gloam_warrior', raiderTile, 'hostile:gloam');
  },
  run: (w: TestWorld) => {
    const combat = w.readers.of<CombatReader>('16');

    // Step to let combat perception scan run and threat scan emit ThreatNearby, then dwarves react
    w.step(2);

    // 1. Soldier engages hostile within perception
    expect(combat.targetOf(soldierId)).toBe(raiderId);

    // 2. Civilian flees from threat
    const civBrain = w.game.world.entities.get(civilianId, C.Brain);
    expect(civBrain?.behavior).toBe('flee');

    // 3. Soldier approaches and attacks
    w.until((world) => world.events('AttackResolved').length >= 1, 100);
    expect(w.events('AttackResolved').length).toBeGreaterThanOrEqual(1);
  },
};

export default scenario;
