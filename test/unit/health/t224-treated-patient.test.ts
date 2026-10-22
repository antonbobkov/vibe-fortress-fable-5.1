import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { createWound, PAIN_DISCHARGE } from '@systems/health';
import type { JobBoard } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

function treatedPatient(cleaned = true) {
  const w = new TestWorld({ seed: 't224-treated-patient', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const at = w.index(10, 10, FLAT_TEST_SURFACE_Z);
  const patient = w.spawnDwarf({ at });
  const entities = w.game.world.entities;
  entities.add(patient, C.Attributes, { ...entities.get(patient, C.Attributes)!, wil: 40 });
  w.game.world.emit({ type: 'DamageDealt', defenderId: patient, attackerId: 0,
    part: 'head', damageType: 'blunt', amount: 18 });
  w.step(2);
  const body = entities.get(patient, C.Body)!;
  const wound = body.parts[0]!.wounds[0]!;
  expect(wound.type).toBe('fracture');
  expect(wound.severity).toBe('grievous');
  expect(entities.has(patient, C.Patient)).toBe(true);
  // Successful treatment has finished; pain from the healing fracture remains.
  wound.bandaged = true;
  wound.bleed = 0;
  wound.splinted = true;
  wound.cleaned = cleaned;
  body.diagnosed = true;
  w.step(5);
  expect(body.pain).toBeGreaterThanOrEqual(PAIN_DISCHARGE);
  return { w, patient, body, at };
}

describe('T-224 treatment needs reflect the wounds of a patient waiting for discharge', () => {
  it('keeps a fully treated painful fracture admitted with no treatment needs', () => {
    const { w, patient } = treatedPatient();
    expect(w.game.world.entities.get(patient, C.Patient)?.needs).toEqual([]);
    expect(w.events('PatientDischarged')).toHaveLength(0);
  });

  it('posts no repeated treatment and consumes no spare splint while pain keeps the patient admitted', () => {
    const { w, patient, at } = treatedPatient();
    w.spawnItem('splint', 'oak', at, 10);
    const entities = w.game.world.entities;
    const splintType = w.game.registry.table('items').index('splint');
    // Spawning ten splints makes multiple stacks; count all of them, including reserved items.
    const splintCount = () => entities.with(C.Item).reduce((sum, id) => {
      const item = entities.get(id, C.Item)!;
      return sum + (item.type === splintType ? item.count : 0);
    }, 0);
    expect(splintCount()).toBe(10);
    w.spawnDwarf({ at: w.index(11, 10, FLAT_TEST_SURFACE_Z), skills: { medicine: 20 } });
    const board = w.game.world.services.jobs as JobBoard;
    w.step(600);
    expect(w.game.world.entities.has(patient, C.Patient)).toBe(true);
    expect(board.byKey(`set_bone:${patient}`)).toBeUndefined();
    expect(w.events('TreatmentDone').filter((event) => event['patientId'] === patient)).toEqual([]);
    expect(splintCount()).toBe(10);
  });

  it('retains only an unfinished cleaning need and discharges when pain falls below the threshold', () => {
    const { w, patient, body } = treatedPatient(false);
    // A fracture cannot be infected and asks for no cleaning (T-413); an uncovered cut on an arm does.
    expect(w.game.world.entities.get(patient, C.Patient)?.needs).toEqual([]);
    const cut = { ...createWound('cut', 'light', 3, w.tick), bleed: 0 };
    body.parts[2]!.wounds.push(cut);
    w.step(5);
    expect(w.game.world.entities.get(patient, C.Patient)?.needs).toEqual(['clean_wound']);
    cut.cleaned = true;
    body.parts[0]!.wounds[0]!.pain = PAIN_DISCHARGE - 1;
    w.step(5);
    expect(w.game.world.entities.has(patient, C.Patient)).toBe(false);
    expect(w.events('PatientDischarged').filter((event) => event['id'] === patient)).toHaveLength(1);
  });

  it('refreshes an admitted patient after the last wound leaves the wounded set', () => {
    const { w, patient, body } = treatedPatient();
    body.parts[0]!.wounds[0]!.healRemaining = 1;
    w.step(5);
    expect(body.parts[0]!.wounds).toEqual([]);
    expect(w.game.world.entities.get(patient, C.Patient)?.needs).toEqual([]);
    expect(w.game.world.entities.has(patient, C.Patient)).toBe(true);
    w.step(5);
    expect(body.pain).toBe(0);
    expect(w.game.world.entities.has(patient, C.Patient)).toBe(false);
    expect(w.events('PatientDischarged').filter((event) => event['id'] === patient)).toHaveLength(1);
  });
});
