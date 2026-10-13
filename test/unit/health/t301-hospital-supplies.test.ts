/** T-301: a hospital's built chest is stocked, and its supplies reach the patient. */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

/** A hospital of one bed and one built chest, and five cloth in one stack lying twenty tiles away. */
function hospital() {
  const w = new TestWorld({ seed: 't301-hospital-supplies', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const bedTile = w.index(40, 40, Z), chestTile = w.index(41, 40, Z);
  w.zone('hospital', [bedTile, chestTile]);
  w.build('bed', bedTile, 'oak');
  const chest = w.build('chest', chestTile, 'oak');
  const chestItem = w.game.world.entities.get(chest, C.Building)!.itemId;
  const cloth = w.spawnItem('cloth', 'flax_cloth', w.index(20, 40, Z), 5);
  const dwarf = (x: number, y: number): EntityId => {
    const id = w.spawnDwarf({ at: w.index(x, y, Z), skills: { medicine: 20 } });
    for (const need of NEEDS) w.setNeed(id, need, 0);
    return id;
  };
  const clothUnits = (): number => {
    const type = w.game.registry.table('items').index('cloth');
    return w.game.world.entities.with(C.Item).reduce((sum, id) => {
      const item = w.game.world.entities.get(id, C.Item)!;
      return sum + (item.type === type ? item.count : 0);
    }, 0);
  };
  const cut = (id: EntityId): void => {
    w.game.world.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0, part: 'torso', damageType: 'edge', amount: 20 });
  };
  return { w, chest, chestItem, chestTile, bedTile, cloth, dwarf, clothUnits, cut };
}

describe('T-301 a bleeding patient is treated from the hospital chest', () => {
  it('hauls cloth into the built chest of a hospital from a tile beside it', () => {
    const a = hospital();
    const jobs = a.w.readers.of<JobsReader>('11');
    const items = a.w.readers.of<ItemsReader>('13');
    a.dwarf(21, 40);
    a.w.step(5);
    // The chest's own tile is not walked: the haul is not left blocked `unreachable`.
    expect(jobs.byKey(`haul:${a.cloth}`)?.state).not.toBe('blocked');
    a.w.until(() => a.w.game.world.entities.get(a.cloth, C.Item)?.containerId === a.chestItem, 600);
    expect(items.tileOf(a.cloth)).toBe(a.chestTile);
    expect(a.w.game.world.entities.get(a.chestItem, C.Container)?.contents).toEqual([a.cloth]);
    // Stored: no second haul is asked for.
    a.w.step(20);
    expect(jobs.list().filter((job) => job.producer === 'items')).toEqual([]);
  });

  it('bandages a patient with cloth taken from the chest', () => {
    const a = hospital();
    const world = a.w.game.world;
    world.services.items!.putIn(a.cloth, a.chestItem);
    const patient = a.dwarf(40, 42);
    const medic = a.dwarf(44, 44);
    a.w.step(2);
    a.cut(patient);
    a.w.until(() => a.w.events('TreatmentDone').some((e) => e['patientId'] === patient && e['kind'] === 'stop_bleeding'), 600);
    expect(a.w.events('TreatmentDone').find((e) => e['kind'] === 'stop_bleeding')?.['medicId']).toBe(medic);
    // Cloth in the chest is in stock for the job: it is neither `missing_input` nor `unreachable`.
    expect(a.w.events('JobBlocked').filter((e) => e['jobType'] === 'stop_bleeding')).toEqual([]);
    expect(a.clothUnits()).toBe(4);
  });

  it('saves a fetch from the chest and keeps its next 50 hashes', () => {
    const a = hospital();
    const world = a.w.game.world;
    world.services.items!.putIn(a.cloth, a.chestItem);
    const patient = a.dwarf(40, 42);
    a.dwarf(60, 44);
    a.w.step(2);
    a.cut(patient);
    a.w.until(() => a.w.readers.of<JobsReader>('11').byKey(`stop_bleeding:${patient}`)?.state === 'fetching', 50);
    const loaded = roundTrip(a.w.game).game;
    expect(loaded.hash()).toBe(a.w.hash());
    for (let tick = 0; tick < 50; tick += 1) { a.w.step(1); loaded.step(1); expect(loaded.hash()).toBe(a.w.hash()); }
  });
});

describe('T-301 a job held by a soldier called to duty returns to the board', () => {
  it('lets another medic bandage the patient when the first is called to duty', () => {
    const a = hospital();
    const world = a.w.game.world;
    const jobs = a.w.readers.of<JobsReader>('11');
    world.services.items!.putIn(a.cloth, a.chestItem);
    const patient = a.dwarf(40, 42);
    const soldier = a.dwarf(20, 44);
    a.w.step(2);
    expect(world.applyCommand({ type: 'CreateSquad', name: 'Guard', leaderId: soldier }).ok).toBe(true);
    const squadId = a.w.readers.of<{ squads(): { id: EntityId }[] }>('16').squads()[0]!.id;
    expect(world.applyCommand({ type: 'SetSquadMode', squadId, mode: 'off' }).ok).toBe(true);
    a.w.step(2);
    a.cut(patient);
    a.w.until(() => jobs.byKey(`stop_bleeding:${patient}`)?.workerId === soldier, 20);
    // The squad goes on duty with the bandage job in its member's hands.
    expect(world.applyCommand({ type: 'SetSquadMode', squadId, mode: 'active' }).ok).toBe(true);
    a.w.step(3);
    expect(world.entities.get(soldier, C.Brain)?.behavior).toBe('duty');
    expect(jobs.forWorker(soldier)).toBeUndefined();
    expect(jobs.byKey(`stop_bleeding:${patient}`)).toMatchObject({ state: 'open', workerId: 0 });
    const medic = a.dwarf(44, 44);
    a.w.until(() => a.w.events('TreatmentDone').some((e) => e['patientId'] === patient && e['kind'] === 'stop_bleeding'), 600);
    expect(a.w.events('TreatmentDone').find((e) => e['kind'] === 'stop_bleeding')?.['medicId']).toBe(medic);
  });
});
