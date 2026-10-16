/** T-306: an open bandage job calls a worker off interruptible work. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

/** A hospital of one bed and one built chest holding five cloth. */
function hospital() {
  const w = new TestWorld({ seed: 't306-summon-for-patient', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const bedTile = w.index(40, 40, Z), chestTile = w.index(41, 40, Z);
  w.zone('hospital', [bedTile, chestTile]);
  w.build('bed', bedTile, 'oak');
  const chest = w.build('chest', chestTile, 'oak');
  const chestItem = w.game.world.entities.get(chest, C.Building)!.itemId;
  const cloth = w.spawnItem('cloth', 'flax_cloth', w.index(20, 40, Z), 5);
  w.game.world.services.items!.putIn(cloth, chestItem);
  const dwarf = (x: number, y: number): EntityId => {
    const id = w.spawnDwarf({ at: w.index(x, y, Z), skills: { medicine: 20 } });
    for (const need of NEEDS) w.setNeed(id, need, 0);
    return id;
  };
  const cut = (id: EntityId): void => {
    w.game.world.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0, part: 'torso', damageType: 'edge', amount: 20 });
  };
  return { w, chestItem, dwarf, cut };
}

describe('T-306 an open bandage job does not wait for a worker to finish its own job', () => {
  it('calls the nearest worker off interruptible work within two ticks', () => {
    const a = hospital();
    const world = a.w.game.world;
    const jobs = a.w.readers.of<JobsReader>('11');
    // Long interruptible work for the only free dwarf: thread to carry forty tiles to the chest.
    const thread = a.w.spawnItem('thread', 'flax_thread', a.w.index(2, 40, Z), 5);
    const worker = a.dwarf(3, 40);
    a.w.until(() => jobs.forWorker(worker)?.key === `haul:${thread}` && world.entities.get(worker, C.Worker)?.carrying === thread, 100);
    a.w.step(20);
    const haul = jobs.forWorker(worker)!;
    const patient = a.dwarf(40, 42);
    a.w.setLabor(patient, 'hauling', false);
    a.cut(patient);
    a.w.until(() => world.entities.has(patient, C.Patient), 10);
    a.w.step(2);
    // Not after the haul: at once. The haul is left open and the thread lies where the worker stood.
    expect(jobs.forWorker(worker)?.key).toBe(`stop_bleeding:${patient}`);
    expect(jobs.get(haul.id)).toMatchObject({ state: 'open', workerId: 0 });
    expect(world.entities.get(thread, C.Item)?.carriedBy).toBe(0);
    a.w.until(() => a.w.events('TreatmentDone').some((e) => e['patientId'] === patient && e['kind'] === 'stop_bleeding'), 800);
    // Somebody takes the haul up again and finishes it.
    a.w.until(() => world.entities.get(thread, C.Item)?.containerId === a.chestItem, 1200);
  });

  it('does not call a worker off a job for another patient', () => {
    const a = hospital();
    const world = a.w.game.world;
    const jobs = a.w.readers.of<JobsReader>('11');
    const first = a.dwarf(40, 42);
    a.w.setLabor(first, 'hauling', false);
    const medic = a.dwarf(10, 40);
    a.w.step(2);
    a.cut(first);
    a.w.until(() => jobs.forWorker(medic)?.key === `stop_bleeding:${first}`, 20);
    const second = a.dwarf(40, 44);
    a.w.setLabor(second, 'hauling', false);
    a.cut(second);
    a.w.until(() => world.entities.has(second, C.Patient), 10);
    a.w.step(3);
    expect(jobs.forWorker(medic)?.key).toBe(`stop_bleeding:${first}`);
  });

  it('gives the called worker the patient job even when its own labor ranks higher', () => {
    const a = hospital();
    const world = a.w.game.world;
    const jobs = a.w.readers.of<JobsReader>('11');
    // Hauling at labor priority 1 and medicine at 9: the haul ranks 2, the bandage 5.
    expect(world.applyCommand({ type: 'SetLaborPriority', labor: 'hauling', priority: 1 }).ok).toBe(true);
    expect(world.applyCommand({ type: 'SetLaborPriority', labor: 'medicine', priority: 9 }).ok).toBe(true);
    const thread = a.w.spawnItem('thread', 'flax_thread', a.w.index(2, 40, Z), 5);
    const worker = a.dwarf(3, 40);
    a.w.until(() => jobs.forWorker(worker)?.key === `haul:${thread}` && world.entities.get(worker, C.Worker)?.carrying === thread, 100);
    const patient = a.dwarf(40, 42);
    a.w.setLabor(patient, 'hauling', false);
    const claims = (): number => a.w.events('JobClaimed').filter((e) => e['workerId'] === worker).length;
    const before = claims();
    a.cut(patient);
    a.w.until(() => world.entities.has(patient, C.Patient), 10);
    a.w.step(20);
    // Called once: it holds the bandage job and has claimed nothing else since.
    expect(jobs.forWorker(worker)?.key).toBe(`stop_bleeding:${patient}`);
    expect(claims()).toBe(before + 1);
  });

  it('does not call a soldier on duty', () => {
    const a = hospital();
    const world = a.w.game.world;
    const jobs = a.w.readers.of<JobsReader>('11');
    const soldier = a.dwarf(40, 44);
    a.w.step(2);
    expect(world.applyCommand({ type: 'CreateSquad', name: 'Guard', leaderId: soldier }).ok).toBe(true);
    const squadId = a.w.readers.of<{ squads(): { id: EntityId }[] }>('16').squads()[0]!.id;
    expect(world.applyCommand({ type: 'SetSquadMode', squadId, mode: 'active' }).ok).toBe(true);
    const thread = a.w.spawnItem('thread', 'flax_thread', a.w.index(2, 40, Z), 5);
    const worker = a.dwarf(3, 40);
    a.w.until(() => jobs.forWorker(worker)?.key === `haul:${thread}` && world.entities.get(worker, C.Worker)?.carrying === thread, 100);
    expect(world.entities.get(soldier, C.Brain)?.behavior).toBe('duty');
    const patient = a.dwarf(40, 42);
    a.w.setLabor(patient, 'hauling', false);
    a.cut(patient);
    a.w.until(() => world.entities.has(patient, C.Patient), 10);
    a.w.step(2);
    expect(jobs.byKey(`stop_bleeding:${patient}`)?.workerId).toBe(worker);
    expect(jobs.forWorker(soldier)).toBeUndefined();
  });

  it('calls the worker nearest to an unconscious patient, not to its bed', () => {
    const w = new TestWorld({ seed: 't306-carry-nearest', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const world = w.game.world;
    const jobs = w.readers.of<JobsReader>('11');
    const bedTile = w.index(60, 40, Z), chestTile = w.index(61, 40, Z);
    w.zone('hospital', [bedTile, chestTile]);
    w.build('bed', bedTile, 'oak');
    w.build('chest', chestTile, 'oak');
    const hauler = (x: number, y: number): EntityId => {
      const id = w.spawnDwarf({ at: w.index(x, y, Z) });
      for (const need of NEEDS) w.setNeed(id, need, 0);
      w.setLabor(id, 'medicine', false);
      return id;
    };
    // Two hauls to the hospital chest: one that starts by the bed, one by the patient.
    const thread = w.spawnItem('thread', 'flax_thread', w.index(57, 10, Z), 5);
    const cloth = w.spawnItem('cloth', 'flax_cloth', w.index(13, 10, Z), 5);
    const byBed = hauler(57, 11), byPatient = hauler(13, 11);
    w.until(() => world.entities.get(byBed, C.Worker)?.carrying === thread && world.entities.get(byPatient, C.Worker)?.carrying === cloth, 100);
    const patient = w.spawnDwarf({ at: w.index(10, 40, Z) });
    for (const need of NEEDS) w.setNeed(patient, need, 0);
    const body = world.entities.get(patient, C.Body)!;
    body.blood = Math.floor(body.maxBlood * 0.3);
    body.conscious = false;
    world.emit({ type: 'DamageDealt', defenderId: patient, attackerId: 0, part: 'torso', damageType: 'edge', amount: 1 });
    w.until(() => jobs.byKey(`carry_patient:${patient}`) !== undefined, 20);
    w.step(2);
    expect(jobs.byKey(`carry_patient:${patient}`)?.workerId).toBe(byPatient);
  });
});
