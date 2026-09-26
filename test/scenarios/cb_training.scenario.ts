/**
 * `cb_training` of `04-implementation/acceptance-tests.md` § 16 Combat:
 * "squad in barracks with training axes, 10 days | weapon skill rises; no wounds"
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { CombatReader, SquadWithId } from '@systems/combat/reader';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';

const scenario: Scenario = {
  id: 'cb_training',
  milestone: 6,
  seed: 'cb-training',
  world: 'flat-test',
  embark: 'none',
  run: (w: TestWorld) => {
    const Z = FLAT_TEST_SURFACE_Z;
    const barracksTiles: number[] = [];
    for (let x = 20; x <= 23; x++) {
      for (let y = 20; y <= 23; y++) {
        barracksTiles.push(w.index(x, y, Z));
      }
    }

    const barracksZoneId = w.zone('barracks', barracksTiles);

    // Food and drink near barracks to survive 10 days
    const foodTile = w.index(24, 20, Z);
    const drinkTile = w.index(24, 21, Z);
    w.spawnItem('drink', 'ale', drinkTile, 50);
    w.spawnItem('easy_meal', 'dimcap', foodTile, 50);

    // Spawn 2 dwarves in barracks
    const tile0 = barracksTiles[0]!;
    const tile1 = barracksTiles[1]!;
    const d1 = w.spawnDwarf({ at: tile0 });
    const d2 = w.spawnDwarf({ at: tile1 });

    // Spawn and equip training axes
    const trainingAxeType = w.game.registry.table('items').index('training_axe');
    const oakMat = w.game.registry.table('materials').index('oak');
    const axe1 = w.spawnItem(trainingAxeType, oakMat, tile0);
    const axe2 = w.spawnItem(trainingAxeType, oakMat, tile1);

    w.game.world.entities.add(d1, C.Equipment, {
      weapon: axe1,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });
    w.game.world.entities.add(d2, C.Equipment, {
      weapon: axe2,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });

    // Initial skill level / xp
    const skillsTable = w.game.registry.table('skills');
    const axeSkillIdx = skillsTable.index('axe');

    const skills1Before = w.game.world.entities.get(d1, C.Skills);
    const xp1Before = skills1Before?.xp[axeSkillIdx] ?? 0;

    const skills2Before = w.game.world.entities.get(d2, C.Skills);
    const xp2Before = skills2Before?.xp[axeSkillIdx] ?? 0;

    // Create squad, assign barracks, mode train
    w.game.world.applyCommand({ type: 'CreateSquad', name: 'Training Squad' });
    const combat = w.readers.of<CombatReader>('16');
    const squads = combat.squads();
    expect(squads.length).toBeGreaterThan(0);
    const squad = squads[0] as SquadWithId;

    w.game.world.applyCommand({
      type: 'SetSquadMembers',
      squadId: squad.id,
      members: [d1, d2],
    });
    w.game.world.applyCommand({
      type: 'SetSquadEquipment',
      squadId: squad.id,
      equipment: { weaponClass: 'axe' },
    });
    w.game.world.applyCommand({
      type: 'SetSquadMode',
      squadId: squad.id,
      mode: 'train',
    });

    const squadComp = w.game.world.entities.get(squad.id, C.Squad);
    if (squadComp) {
      squadComp.barracksZoneId = barracksZoneId;
    }

    // Step for 10 days (10 * 1200 = 12000 ticks)
    for (let day = 0; day < 10; day++) {
      w.step(TICKS_PER_DAY);
    }

    // Both dwarves must be alive
    expect(w.game.world.entities.alive(d1)).toBe(true);
    expect(w.game.world.entities.alive(d2)).toBe(true);

    // Weapon skill rises
    const skills1After = w.game.world.entities.get(d1, C.Skills);
    const xp1After = skills1After?.xp[axeSkillIdx] ?? 0;
    expect(xp1After).toBeGreaterThan(xp1Before);

    const skills2After = w.game.world.entities.get(d2, C.Skills);
    const xp2After = skills2After?.xp[axeSkillIdx] ?? 0;
    expect(xp2After).toBeGreaterThan(xp2Before);

    // Training sessions occurred
    expect(w.events('TrainingSession').length).toBeGreaterThan(0);

    // No wounds with training weapons!
    const body1 = w.game.world.entities.get(d1, C.Body);
    const body2 = w.game.world.entities.get(d2, C.Body);
    expect(body1?.parts.every((p) => p.wounds.length === 0)).toBe(true);
    expect(body2?.parts.every((p) => p.wounds.length === 0)).toBe(true);
  },
};

export default scenario;
