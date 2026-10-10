import { expect } from 'vitest';
import { C } from '@core/components';
import type { Scenario } from './runner';

/** T-157: a real severed-leg casualty receives a crutch through medical jobs. */
const scenario: Scenario = {
  id: 'he_crutch', milestone: 8, seed: 't157-crutch', world: 'flat-test', embark: 'none',
  run: (w) => {
    const at = w.index(20, 20, 32);
    const patient = w.spawnDwarf({ at });
    const medic = w.spawnDwarf({ at: w.index(21, 20, 32), skills: { medicine: 20 } });
    w.spawnItem('cloth', 'flax_cloth', at, 10);
    w.spawnItem('thread', 'flax_thread', at, 10);
    const crutch = w.spawnItem('crutch', 'oak', at);
    const leg = w.game.world.entities.get(patient, C.Body)!.parts[4]!;
    w.game.world.emit({ type: 'DamageDealt', defenderId: patient, attackerId: 0,
      part: 'left_leg', damageType: 'edge', amount: leg.maxHp * 2 });
    w.until((v) => v.events('TreatmentDone').some((e) => e['kind'] === 'give_crutch'), 600);
    expect(w.game.world.entities.get(patient, C.Body)?.permanent).toContain('lost_left_leg');
    expect(w.events('TreatmentDone')).toContainEqual(expect.objectContaining({
      patientId: patient, medicId: medic, kind: 'give_crutch' }));
    expect(w.game.world.entities.get(crutch, C.Item)?.carriedBy).toBe(patient);
    expect(w.events('CreatureDied')).toHaveLength(0);
  },
};
export default scenario;
