import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import type { Job, JobBoard } from '@systems/jobs';
import type { HealthSystem } from '@systems/health';
import { HealthProducer } from '@systems/health/producer';
import { TestWorld } from '../../scenarios/test-world';

describe('T-190 animal bandaging uses its catalogue job', () => {
  it('an animal-care worker completes one bandage_animal job for all bleeding wounds', () => {
    const w = new TestWorld({ seed: 't190-bandage-animal', world: 'flat-test', embark: 'none' });
    const worker = w.spawnDwarf({ at: w.index(10, 10, 32), skills: { animal_care: 20 } });
    w.setLabor(worker, 'medicine', false);
    const animal = w.spawnTame('cow', w.index(12, 10, 32));
    const cloth = w.spawnItem('cloth', 'flax_cloth', w.index(10, 10, 32));
    for (const part of ['torso', 'left_leg']) w.game.world.emit({ type: 'DamageDealt',
      defenderId: animal, attackerId: 0, part, damageType: 'edge', amount: 5 });
    w.step(3);
    const created = w.events('JobCreated').filter((e) => e['target'] === animal &&
      ['bandage_animal', 'stop_bleeding'].includes(e['jobType'] as string));
    expect(created.map((e) => e['jobType'])).toEqual(['bandage_animal']);
    const board = w.game.world.services.jobs as JobBoard;
    expect(board.byKey(`bandage_animal:${animal}`)?.data['labor']).toBe('animal_care');
    expect(board.byKey(`bandage_animal:${animal}`)?.producer).toBe('health');
    w.until((v) => v.events('JobCompleted').some((e) => e['jobType'] === 'bandage_animal' && e['target'] === animal), 600);
    expect(w.events('JobCompleted').filter((e) => e['jobType'] === 'bandage_animal')).toHaveLength(1);
    expect(w.events('TreatmentDone')).toContainEqual(expect.objectContaining({ patientId: animal,
      medicId: worker, kind: 'bandage_animal' }));
    const wounds = w.game.world.entities.get(animal, C.Body)!.parts.flatMap((p) => p.wounds);
    expect(wounds).toHaveLength(2);
    expect(wounds.every((wound) => wound.bandaged && wound.bleed === 0)).toBe(true);
    expect(w.game.world.entities.alive(cloth)).toBe(false);
    expect(w.game.world.entities.alive(animal)).toBe(true);
  });

  it('uses the catalogue duration of 100 base ticks, rather than human treatment time', () => {
    const w = new TestWorld({ seed: 't190-bandage-duration', world: 'flat-test', embark: 'none' });
    const health = w.game.world.scheduler.byId('17') as HealthSystem;
    const producer = new HealthProducer({ rng: health.rng, entities: w.game.world.entities,
      map: w.map, registry: w.game.registry, pendingTreatments: new Map(), wounded: new Set() });
    const type = w.game.registry.table('jobTypes').index('bandage_animal');
    expect(producer.workCentiTicks({ type } as Job)).toBe(100 * 100);
  });

  it('does not offer bandaging to an untamed creature', () => {
    const w = new TestWorld({ seed: 't190-no-wild-care', world: 'flat-test', embark: 'none' });
    const animal = w.spawnCreature('deer', w.index(12, 10, 32), 'wild');
    w.game.world.emit({ type: 'DamageDealt', defenderId: animal, attackerId: 0,
      part: 'torso', damageType: 'edge', amount: 5 });
    w.step(3);
    expect(w.events('JobCreated').filter((e) => e['target'] === animal &&
      ['bandage_animal', 'stop_bleeding'].includes(e['jobType'] as string))).toHaveLength(0);
  });
});
