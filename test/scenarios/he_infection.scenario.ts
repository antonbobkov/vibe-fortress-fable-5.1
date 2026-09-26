/**
 * `he_infection` of `04-implementation/acceptance-tests.md` § 17 Health:
 * "a serious untreated cut, the dwarf sleeping in a bed, no miasma, 10 days |
 * 49–74% infected over 100 runs (model 1 − 0.9⁹ = 61%); brightleaf cures in 3 days".
 */

import { expect } from 'vitest';
import { buildFlatTestMap, FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { Scenario } from './runner';
import { TestWorld } from './test-world';

const RUNS = 100;

const scenario: Scenario = {
  id: 'he_infection',
  milestone: 6,
  seed: 'he-infection',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    // -------------------------------------------------------------
    // Part A: 100 runs over 10 days (model: 1 - 0.9^9 = 61%)
    // -------------------------------------------------------------
    let infectedCount = 0;
    const Z = FLAT_TEST_SURFACE_Z;

    for (let k = 0; k < RUNS; k += 1) {
      const run = new TestWorld({
        seed: `he-infection-${k}`,
        map: buildFlatTestMap(w.game.registry, 16, 16),
        embark: 'none',
      });
      const bedTile = run.index(8, 8, Z);
      const foodTile = run.index(8, 9, Z);
      const drinkTile = run.index(9, 8, Z);

      run.build('bed', bedTile, 'oak');
      run.spawnItem('drink', 'ale', drinkTile, 50);
      run.spawnItem('easy_meal', 'dimcap', foodTile, 50);

      const dwarf = run.spawnDwarf({ at: bedTile });
      // Disable medicine labor so wound remains untreated
      run.setLabor(dwarf, 'medicine', false);

      // Step to settle and let dwarf claim bed
      run.step(1);

      // Inflict serious cut on torso at tick 1 (damage 20 on torso maxHp 60)
      run.game.world.emit({
        type: 'DamageDealt',
        defenderId: dwarf,
        part: 'torso',
        damageType: 'edge',
        amount: 20,
        attackerId: 0,
      });

      run.step(1);
      const body = run.game.world.entities.get(dwarf, C.Body);
      const cutWound = body?.parts[1]?.wounds.find((wnd) => wnd.type === 'cut');
      if (cutWound) {
        cutWound.bleed = 0;
      }

      // Step across 10 days (ticks 1..12000)
      for (let day = 1; day <= 10; day += 1) {
        run.step(TICKS_PER_DAY);
        if (run.events('InfectionStarted').length > 0) {
          infectedCount += 1;
          break;
        }
      }
    }

    // 49–74% infected over 100 runs
    expect(infectedCount).toBeGreaterThanOrEqual(49);
    expect(infectedCount).toBeLessThanOrEqual(74);

    // -------------------------------------------------------------
    // Part B: brightleaf cures in 3 days
    // -------------------------------------------------------------
    const hospitalBed = w.index(40, 40, Z);
    const hospitalChest = w.index(41, 40, Z);
    const medicTile = w.index(42, 40, Z);
    const supplyTile = w.index(41, 41, Z);
    const patientTile = w.index(40, 41, Z);

    w.zone('hospital', [hospitalBed, hospitalChest, supplyTile, patientTile]);
    w.build('bed', hospitalBed, 'oak');
    w.build('chest', hospitalChest, 'oak');

    // Supplies: bucket, brightleaf, food, drink
    w.spawnItem('bucket', 'oak', supplyTile, 1);
    w.spawnItem('brightleaf', 'oak', supplyTile, 5);
    w.spawnItem('drink', 'ale', w.index(42, 41, Z), 50);
    w.spawnItem('easy_meal', 'dimcap', w.index(42, 42, Z), 50);

    // Spawn medic
    const medicId = w.spawnDwarf({ at: medicTile });
    w.setSkill(medicId, 'medicine', 20);
    w.setLabor(medicId, 'medicine', true);

    // Spawn patient dwarf
    const patientId = w.spawnDwarf({ at: patientTile });
    w.setLabor(patientId, 'medicine', false);

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

    w.step(2);

    // Manually mark wound infected (simulating infection start)
    const body = w.game.world.entities.get(patientId, C.Body);
    const wound = body?.parts[1]?.wounds.find((wnd) => wnd.type === 'cut');
    expect(wound).toBeDefined();
    if (wound) {
      wound.infected = true;
      wound.infectedSince = w.tick;
      wound.bleed = 0;
    }

    // Patient admitted with clean_wound need
    w.until((v) => v.events('PatientAdmitted').some((e) => e['id'] === patientId), 50);

    // Medic performs clean_wound with brightleaf
    w.until(
      (v) =>
        v
          .events('TreatmentDone')
          .some((e) => e['patientId'] === patientId && e['kind'] === 'clean_wound'),
      400,
    );

    const treatEvent = w.events('TreatmentDone').find(
      (e) => e['patientId'] === patientId && e['kind'] === 'clean_wound',
    );
    expect(treatEvent).toBeDefined();
    expect(wound?.cleaned).toBe(true);
    expect(wound?.curedAt).toBeDefined();

    // Brightleaf cures infection in 3 days (3 * 1200 = 3600 ticks)
    w.until((v) => v.events('InfectionCured').some((e) => e['id'] === patientId), 4500);
    expect(wound?.infected).toBe(false);
  },
};

export default scenario;
