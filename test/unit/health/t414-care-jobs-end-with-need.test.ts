/**
 * T-414: a treatment job ends once no wound of its dwarf needs that treatment, admitted or not, even
 * while it is under way; `diagnose` ends at discharge when no wound needs a treatment.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { CLOT_TICKS } from '@systems/health';
import type { ItemsReader } from '@systems/items';
import type { JobBoard } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

/** A light cut on a dwarf at (10, 10); the medic and its cloth stand far enough off that the cut clots first. */
function lightCut(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  const patient = w.spawnDwarf({ at: w.index(10, 10, Z) });
  for (const l of w.game.registry.table<{ id: string }>('labors').ids()) w.setLabor(patient, l, false);
  const medic = w.spawnDwarf({ at: w.index(30, 30, Z), skills: { medicine: 20 } });
  for (const l of w.game.registry.table<{ id: string }>('labors').ids()) w.setLabor(medic, l, l === 'medicine');
  w.spawnItem('cloth', 'flax_cloth', w.index(31, 31, Z), 3);
  for (const id of [patient, medic]) for (const need of ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const) w.setNeed(id, need, 0);
  world.emit({ type: 'DamageDealt', defenderId: patient, attackerId: 0, part: 'torso', damageType: 'edge', amount: 9 });
  w.step(2);
  const cut = world.entities.get(patient, C.Body)!.parts.flatMap((p) => p.wounds)[0]!;
  expect(cut.severity).toBe('light');
  expect(world.entities.has(patient, C.Patient)).toBe(true);
  const board = world.services.jobs as JobBoard;
  const cloth = () => w.readers.of<ItemsReader>('13').count('cloth');
  return { w, world, patient, medic, cut, board, cloth };
}

describe('T-414 care jobs end with their need', () => {
  it('a light cut that clots before its bandage uses no cloth; the bandage under way is cancelled', () => {
    const a = lightCut('t414-clot');
    const key = `stop_bleeding:${a.patient}`;
    a.w.until(() => a.board.byKey(key)?.workerId === a.medic, 50);
    const job = a.board.jobs.get(a.board.byKey(key)!.id)!;
    a.w.until(() => !a.world.entities.has(a.patient, C.Patient), CLOT_TICKS + 20);
    expect(a.cut.bleed).toBe(0);
    a.w.step(10);
    expect(job.state).toBe('cancelled');
    expect(a.board.byKey(key)).toBeUndefined();
    a.w.step(400);
    expect(a.w.events('TreatmentDone').filter((e) => e['patientId'] === a.patient && e['kind'] === 'stop_bleeding')).toHaveLength(0);
    expect(a.cloth()).toBe(3);
    expect(a.cut.bandaged).toBe(false);
  });

  it('diagnose ends at discharge when no wound needs a treatment', () => {
    const a = lightCut('t414-diagnose');
    expect(a.board.byKey(`diagnose:${a.patient}`)).toBeDefined();
    a.cut.cleaned = true;
    a.w.until(() => !a.world.entities.has(a.patient, C.Patient), CLOT_TICKS + 20);
    a.w.step(10);
    expect(a.board.byKey(`diagnose:${a.patient}`)).toBeUndefined();
    a.w.step(400);
    expect(a.w.events('TreatmentDone').filter((e) => e['patientId'] === a.patient)).toHaveLength(0);
  });

  it('a treatment still needed after discharge goes on: the uncovered cut is cleaned', () => {
    const a = lightCut('t414-clean');
    a.w.until(() => !a.world.entities.has(a.patient, C.Patient), CLOT_TICKS + 20);
    a.w.step(10);
    expect(a.board.byKey(`clean_wound:${a.patient}`)).toBeDefined();
    expect(a.board.byKey(`diagnose:${a.patient}`)).toBeDefined();
  });
});
