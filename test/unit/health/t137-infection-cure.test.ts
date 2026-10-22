import { describe, expect, it, vi } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { INFECTION_CURE_DAYS, HEALTH_CADENCE } from '@systems/health/constants';
import type { HealthSystem } from '@systems/health';
import type { JobBoard } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

function infectedPatient(wounds = 1, medicine = 20) {
  const w = new TestWorld({ seed: `t137-cure-${wounds}-${medicine}`, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const at = w.index(10, 10, FLAT_TEST_SURFACE_Z);
  w.build('bed', at, 'oak');
  const patient = w.spawnDwarf({ at });
  w.setLabor(patient, 'medicine', false);
  const medic = w.spawnDwarf({ at: w.index(11, 10, FLAT_TEST_SURFACE_Z), skills: { medicine } });
  w.spawnItem('easy_meal', 'dimcap', w.index(12, 10, FLAT_TEST_SURFACE_Z), 10);
  w.spawnItem('drink', 'ale', w.index(12, 11, FLAT_TEST_SURFACE_Z), 10);
  for (const part of ['torso', 'left_leg'].slice(0, wounds)) w.game.world.emit({ type: 'DamageDealt',
    defenderId: patient, attackerId: 0, part, damageType: 'edge', amount: 15 });
  w.step(1); // Stage the infection before 11 creates its treatment job.
  const entities = w.game.world.entities;
  const body = entities.get(patient, C.Body)!;
  const cuts = body.parts.flatMap(part => part.wounds);
  expect(cuts).toHaveLength(wounds);
  // A previously bandaged/sutured wound has developed an infection requiring brightleaf.
  for (const cut of cuts) Object.assign(cut, { bandaged: true, bleed: 0, sutured: true,
    cleaned: true, infected: true, infectedSince: w.tick });
  body.diagnosed = true;
  w.step(HEALTH_CADENCE);
  const supplies = w.index(11, 11, FLAT_TEST_SURFACE_Z);
  const bucket = w.spawnItem('bucket', 'oak', supplies);
  w.spawnItem('brightleaf', 'brightleaf', supplies, 10);
  const brightleaf = w.game.registry.table('items').index('brightleaf');
  const stock = () => entities.with(C.Item).reduce((count, id) => count +
    (entities.get(id, C.Item)!.type === brightleaf ? entities.get(id, C.Item)!.count : 0), 0);
  const treatments = () => w.events('TreatmentDone').filter(event => event['patientId'] === patient && event['kind'] === 'clean_wound');
  const completions = () => w.events('JobCompleted').filter(event => event['target'] === patient && event['jobType'] === 'clean_wound');
  return { w, patient, medic, cuts, bucket, stock, treatments, completions, entities };
}

describe('T-137 successful infection cleaning keeps its original cure deadline', () => {
  it('uses one brightleaf and one cleaning, remains admitted, and cures on the original deadline', () => {
    const { w, patient, cuts, bucket, stock, treatments, entities } = infectedPatient();
    w.until(() => treatments().length === 1, 600);
    const deadline = cuts[0]!.curedAt!;
    expect(deadline).toBe(w.tick - 1 + INFECTION_CURE_DAYS * TICKS_PER_DAY);
    expect(stock()).toBe(9);
    expect(entities.get(patient, C.Patient)?.needs).not.toContain('clean_wound');
    while (cuts[0]!.infected && w.tick <= deadline + HEALTH_CADENCE) {
      expect(cuts[0]!.curedAt).toBe(deadline);
      expect(entities.has(patient, C.Patient)).toBe(true);
      w.step(1);
    }
    expect(cuts[0]!.infected).toBe(false);
    expect(w.events('InfectionCured').filter(event => event['id'] === patient)).toHaveLength(1);
    expect(treatments()).toHaveLength(1);
    expect(stock()).toBe(9);
    expect(entities.alive(bucket)).toBe(true);
    expect((w.game.world.services.jobs as JobBoard).byKey(`clean_wound:${patient}`)).toBeUndefined();
  });

  it('cleans the second untreated infection instead of restarting the first cure', () => {
    const { w, cuts, stock, treatments } = infectedPatient(2);
    w.until(() => treatments().length === 1, 600);
    const first = cuts[0]!.curedAt;
    expect(first).toBeDefined();
    expect(cuts[1]!.curedAt).toBeUndefined();
    w.until(() => treatments().length === 2, 600);
    expect(cuts[0]!.curedAt).toBe(first);
    expect(cuts[1]!.curedAt).toBeGreaterThan(first!);
    expect(stock()).toBe(8);
  });

  it('cleans an uninfected wound without another brightleaf while a different cure is pending', () => {
    const { w, cuts, stock, treatments } = infectedPatient(2);
    // An uncovered wound asks for cleaning (a bandaged or sutured one does not, T-413).
    Object.assign(cuts[1]!, { infected: false, cleaned: false, bandaged: false, sutured: false });
    w.until(() => treatments().length === 1, 600);
    const first = cuts[0]!.curedAt;
    w.until(() => treatments().length === 2, 600);
    expect(cuts[0]!.curedAt).toBe(first);
    expect(cuts[1]!.cleaned).toBe(true);
    expect(cuts[1]!.curedAt).toBeUndefined();
    expect(stock()).toBe(9);
  });

  it('a failed treatment consumes its brightleaf, keeps the need, then successful retry starts one cure', () => {
    const { w, patient, medic, cuts, stock, treatments, completions, entities } = infectedPatient(1, 0);
    const health = w.game.world.scheduler.byId('17') as HealthSystem;
    const roll = vi.spyOn(health.rng, 'int').mockReturnValueOnce(0);
    try { w.until(() => completions().length === 1, 600); } finally { roll.mockRestore(); }
    expect(treatments()).toHaveLength(0);
    expect(cuts[0]!.curedAt).toBeUndefined();
    expect(entities.get(patient, C.Patient)?.needs).toContain('clean_wound');
    expect(stock()).toBe(9);
    w.setSkill(medic, 'medicine', 20);
    w.until(() => treatments().length === 1, 600);
    expect(cuts[0]!.curedAt).toBeDefined();
    expect(stock()).toBe(8);
    expect(entities.get(patient, C.Patient)?.needs).not.toContain('clean_wound');
  });
});
