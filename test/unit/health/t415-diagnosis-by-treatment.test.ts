/**
 * T-415: the medic who diagnoses (the Chief Medic, or any medic when there is none) diagnoses a
 * dwarf while treating it. A medic kept busy by one fracture a day left `diagnose` (priority 4)
 * for weeks; the dwarf, discharged with a splinted leg, waited for it until its leg healed.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { DIAGNOSE_XP } from '@systems/health';
import type { JobBoard } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

/** A broken leg, a medic beside cloth and a splint; optionally a Chief Medic who does not treat. */
function brokenLeg(seed: string, chief: boolean) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  const labors = w.game.registry.table<{ id: string }>('labors').ids();
  const patient = w.spawnDwarf({ at: w.index(10, 10, Z) });
  for (const l of labors) w.setLabor(patient, l, false);
  const medic = w.spawnDwarf({ at: w.index(12, 10, Z), skills: { medicine: 20 } });
  for (const l of labors) w.setLabor(medic, l, l === 'medicine');
  let chiefId = 0;
  if (chief) {
    chiefId = w.spawnDwarf({ at: w.index(40, 40, Z), skills: { medicine: 20 } });
    for (const l of labors) w.setLabor(chiefId, l, false);
    expect(world.applyCommand({ type: 'AssignTitle', dwarfId: chiefId, title: 'chief_medic' }).ok).toBe(true);
  }
  w.spawnItem('cloth', 'flax_cloth', w.index(12, 11, Z), 3);
  w.spawnItem('splint', 'oak', w.index(13, 11, Z), 2);
  for (const id of [patient, medic, chiefId].filter((x) => x !== 0)) for (const need of NEEDS) w.setNeed(id, need, 0);
  world.emit({ type: 'DamageDealt', defenderId: patient, attackerId: 0, part: 'left_leg', damageType: 'blunt', amount: 13 });
  w.step(3);
  const body = world.entities.get(patient, C.Body)!;
  expect(body.parts.flatMap((p) => p.wounds)[0]?.type).toBe('fracture');
  const xp = () => {
    const skills = world.entities.get(medic, C.Skills)!;
    return skills.xp[w.game.registry.table('skills').index('medicine')] ?? 0;
  };
  const done = (kind: string) => w.events('TreatmentDone').filter((e) => e['patientId'] === patient && e['kind'] === kind);
  return { w, world, patient, medic, body, xp, done, board: world.services.jobs as JobBoard };
}

describe('T-415 the medic diagnoses while treating', () => {
  it('the first treatment diagnoses the dwarf, gives DIAGNOSE_XP and ends the diagnose job', () => {
    const a = brokenLeg('t415-treat', false);
    expect(a.board.byKey(`diagnose:${a.patient}`)).toBeDefined();
    const start = a.xp();
    a.w.until(() => a.done('stop_bleeding').length === 1, 600);
    a.w.step(2);
    const before = a.xp();
    // The bandage's own experience (10 in the job table, give or take a point) and the diagnosis's.
    expect(before - start).toBeGreaterThanOrEqual(10 + DIAGNOSE_XP);
    expect(before - start).toBeLessThan(10 + 2 * DIAGNOSE_XP);
    expect(a.body.diagnosed).toBe(true);
    expect(a.done('diagnose')).toHaveLength(1);
    expect(a.done('diagnose')[0]!['medicId']).toBe(a.medic);
    a.w.step(10);
    expect(a.board.byKey(`diagnose:${a.patient}`)).toBeUndefined();
    a.w.until(() => a.done('set_bone').length === 1, 1200);
    expect(a.done('diagnose')).toHaveLength(1);
    expect(a.xp() - before).toBeLessThan(DIAGNOSE_XP);
  });

  it('a dwarf discharged with a splinted leg has been diagnosed within a day', () => {
    const a = brokenLeg('t415-day', false);
    a.w.until(() => !a.world.entities.has(a.patient, C.Patient), TICKS_PER_DAY);
    expect(a.done('set_bone')).toHaveLength(1);
    expect(a.body.diagnosed).toBe(true);
  });

  it('with a Chief Medic another medic\'s treatment does not diagnose; the Chief Medic does', () => {
    const a = brokenLeg('t415-chief', true);
    a.w.until(() => a.done('stop_bleeding').length === 1, 600);
    expect(a.body.diagnosed).toBe(false);
    expect(a.done('diagnose')).toHaveLength(0);
    expect(a.board.byKey(`diagnose:${a.patient}`)).toBeDefined();
  });
});
