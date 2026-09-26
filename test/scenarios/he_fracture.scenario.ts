/**
 * `he_fracture` of `04-implementation/acceptance-tests.md` § 17 Health:
 * "fracture untreated vs splinted | untreated: badly_healed_* permanent; splinted: none".
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'he_fracture',
  milestone: 6,
  seed: 'he-fracture',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    const Z = FLAT_TEST_SURFACE_Z;
    const bedTile = w.index(40, 40, Z);
    const chestTile = w.index(41, 40, Z);
    const medicTile = w.index(42, 40, Z);
    const patient2Tile = w.index(40, 41, Z);
    const supplyTile = w.index(41, 41, Z);

    // Build hospital zone with bed and chest
    w.zone('hospital', [bedTile, chestTile, patient2Tile, supplyTile]);
    w.build('bed', bedTile, 'oak');
    w.build('chest', chestTile, 'oak');

    // Spawn splints on walkable supply tile
    const splintType = w.game.registry.table('items').index('splint');
    const splintMat = w.game.registry.table('materials').index('oak');
    w.spawnItem(splintType, splintMat, supplyTile, 5);

    // Spawn medic dwarf
    const medicId = w.spawnDwarf({ at: medicTile });
    w.setSkill(medicId, 'medicine', 20);
    w.setLabor(medicId, 'medicine', true);

    // Spawn Dwarf 2 (splinted patient)
    const dwarf2 = w.spawnDwarf({ at: patient2Tile });

    // Spawn Dwarf 1 (untreated) far away
    const dwarf1 = w.spawnDwarf({ at: w.index(20, 20, Z) });
    // Turn off medicine labor on dwarf1 and dwarf2
    w.setLabor(dwarf1, 'medicine', false);
    w.setLabor(dwarf2, 'medicine', false);

    w.step(2);

    // Inflict blunt damage (15) to left_leg (maxHp = 36, 15 >= 30% -> fracture) on both dwarfs
    w.game.world.emit({
      type: 'DamageDealt',
      defenderId: dwarf2,
      part: 'left_leg',
      damageType: 'blunt',
      amount: 15,
      attackerId: 0,
    });
    w.game.world.emit({
      type: 'DamageDealt',
      defenderId: dwarf1,
      part: 'left_leg',
      damageType: 'blunt',
      amount: 15,
      attackerId: 0,
    });

    // Dwarf 2 admitted to hospital
    w.until((v) => v.events('PatientAdmitted').some((e) => e['id'] === dwarf2), 50);

    // Medic applies set_bone to Dwarf 2
    w.until(
      (v) =>
        v
          .events('TreatmentDone')
          .some((e) => e['patientId'] === dwarf2 && e['kind'] === 'set_bone'),
      350,
    );

    const b2 = w.game.world.entities.get(dwarf2, C.Body);
    const b1 = w.game.world.entities.get(dwarf1, C.Body);
    expect(b2).toBeDefined();
    expect(b1).toBeDefined();

    // Dwarf 2's leg fracture is now splinted
    const fracture2 = b2?.parts[4]?.wounds.find((wnd) => wnd.type === 'fracture');
    expect(fracture2).toBeDefined();
    expect(fracture2?.splinted).toBe(true);

    // Dwarf 1's leg fracture is untreated (not splinted)
    const fracture1 = b1?.parts[4]?.wounds.find((wnd) => wnd.type === 'fracture');
    expect(fracture1).toBeDefined();
    expect(fracture1?.splinted).toBe(false);

    // Advance both fractures to near completion to verify healing outcome
    if (fracture1) fracture1.healRemaining = 10;
    if (fracture2) fracture2.healRemaining = 10;

    // Step until fractures heal (10 / 1.25 = 8 health ticks = 40 ticks)
    w.step(50);

    // Dwarf 1 (untreated): permanent injury badly_healed_left_leg added
    expect(b1?.permanent).toContain('badly_healed_left_leg');

    // Dwarf 2 (splinted): no badly_healed_left_leg permanent injury
    expect(b2?.permanent).not.toContain('badly_healed_left_leg');
  },
};

export default scenario;
