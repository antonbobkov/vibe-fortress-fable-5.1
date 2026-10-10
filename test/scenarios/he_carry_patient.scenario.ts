import { expect } from 'vitest';
import { C } from '@core/components';
import type { Scenario } from './runner';

/** T-157: an unconscious casualty away from the hospital is carried to its bed. */
const scenario: Scenario = {
  id: 'he_carry_patient', milestone: 8, seed: 'he-carry-patient', world: 'flat-test', embark: 'none',
  run: (w) => {
    const bedTile = w.index(24, 20, 32);
    w.build('bed', bedTile, 'oak');
    w.build('chest', w.index(25, 20, 32), 'oak');
    w.zone('hospital', [bedTile, w.index(25, 20, 32)]);
    const patient = w.spawnDwarf({ at: w.index(20, 20, 32) });
    w.spawnDwarf({ at: w.index(23, 20, 32), skills: { medicine: 20 } });
    const body = w.game.world.entities.get(patient, C.Body)!;
    body.blood = Math.floor(body.maxBlood * 0.3);
    body.conscious = false;
    w.game.world.emit({ type: 'DamageDealt', defenderId: patient, attackerId: 0,
      part: 'torso', damageType: 'edge', amount: 1 });
    w.until((v) => v.events('JobCompleted').some((e) => e['jobType'] === 'carry_patient'), 400);
    const pos = w.game.world.entities.get(patient, C.Position)!;
    expect(w.index(pos.x, pos.y, pos.z)).toBe(bedTile);
    expect(w.game.world.entities.get(patient, C.Body)?.conscious).toBe(false);
    expect(w.events('CreatureDied')).toHaveLength(0);
  },
};
export default scenario;
