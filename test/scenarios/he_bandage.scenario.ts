/**
 * `he_bandage` of `04-implementation/acceptance-tests.md` § 17 Health:
 * "same, with a hospital, cloth (no thread) and a medic of medicine skill 20 |
 * stop_bleeding within 300 ticks of admission; survives; PatientHealed at day 15 ± 1".
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'he_bandage',
  milestone: 6,
  seed: 'he-bandage',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    const Z = FLAT_TEST_SURFACE_Z;
    const bedTile = w.index(40, 40, Z);
    const chestTile = w.index(41, 40, Z);
    const medicTile = w.index(42, 40, Z);
    const patientTile = w.index(40, 41, Z);

    // Build hospital zone
    w.zone('hospital', [bedTile, chestTile, patientTile, w.index(41, 41, Z)]);
    // Build bed and chest
    w.build('bed', bedTile, 'oak');
    w.build('chest', chestTile, 'oak');

    // Spawn cloth item (no thread) on chest tile
    const clothType = w.game.registry.table('items').index('cloth');
    const clothMat = w.game.registry.table('materials').index('flax_cloth');
    const supplyTile = w.index(41, 41, Z);
    w.spawnItem(clothType, clothMat, supplyTile, 5);
    w.spawnItem('drink', 'ale', w.index(42, 41, Z), 100);
    w.spawnItem('easy_meal', 'dimcap', w.index(42, 42, Z), 50);

    // Spawn patient dwarf
    const patientId = w.spawnDwarf({ at: patientTile });
    const attrs = w.game.world.entities.get(patientId, C.Attributes);
    if (attrs) w.game.world.entities.add(patientId, C.Attributes, { ...attrs, tou: 50 });
    const body = w.game.world.entities.get(patientId, C.Body);
    if (body) {
      body.maxBlood = 600;
      body.blood = 600;
    }

    // Spawn medic dwarf with skill 20
    const medicId = w.spawnDwarf({ at: medicTile });
    w.setSkill(medicId, 'medicine', 20);
    w.setLabor(medicId, 'medicine', true);

    // Step a couple ticks to let world settle
    w.step(2);

    // Inflict serious cut on torso
    w.game.world.emit({
      type: 'DamageDealt',
      defenderId: patientId,
      part: 'torso',
      damageType: 'edge',
      amount: 20,
      attackerId: 0,
    });

    // Patient admitted
    w.until((v) => v.events('PatientAdmitted').some((e) => e['id'] === patientId), 50);
    const admissionEvent = w.events('PatientAdmitted').find((e) => e['id'] === patientId);
    expect(admissionEvent).toBeDefined();
    const admissionTick = w.tick;

    // stop_bleeding within 300 ticks of admission
    w.until(
      (v) =>
        v
          .events('TreatmentDone')
          .some((e) => e['patientId'] === patientId && e['kind'] === 'stop_bleeding'),
      350,
    );
    const treatEvent = w.events('TreatmentDone').find(
      (e) => e['patientId'] === patientId && e['kind'] === 'stop_bleeding',
    );
    expect(treatEvent).toBeDefined();
    const treatTick = w.tick;
    expect(treatTick - admissionTick).toBeLessThanOrEqual(300);

    // Dwarf survives and reaches PatientHealed at day 15 ± 1 (18,000 ± 1200 ticks from injury)
    w.until(
      (v) => v.events('PatientHealed').some((e) => e['id'] === patientId),
      20000,
    );
    const healedEvent = w.events('PatientHealed').find((e) => e['id'] === patientId);
    expect(healedEvent).toBeDefined();
    const day = w.tick / 1200;
    expect(day).toBeGreaterThanOrEqual(14);
    expect(day).toBeLessThanOrEqual(16);

    // Ensure dwarf did not die
    expect(
      w.events('CreatureDied').some((e) => e['id'] === patientId && e['cause'] === 'bled_out'),
    ).toBe(false);
  },
};

export default scenario;
