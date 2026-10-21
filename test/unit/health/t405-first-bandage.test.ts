/**
 * T-405: the first bandage decides a serious wound. `stop_bleeding` does not fail, and a bleeding
 * patient is bandaged where it lies: a conscious one waits on its tile before it walks to its bed,
 * an unconscious one is bandaged before it is carried, both for at most `RESERVE_KEEP_TICKS` after
 * the wound. A patient in danger still flees first.
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { RngStream, seedFor } from '@core/rng';
import type { EntityId } from '@core/types';
import { TREAT_FAIL_PERMILLE } from '@systems/health';
import type { ItemsReader } from '@systems/items';
import type { JobBoard } from '@systems/jobs';
import { RESERVE_KEEP_TICKS } from '@systems/jobs/constants';
import { TestWorld } from '../../scenarios/test-world';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

/** A hurt dwarf at (10, 10), its bed thirty tiles east, and (unless `medic` is null) a medic beside the cloth. */
function ward(seed: string, medic: number | null, wound: { part: string; damageType: string; amount: number }, cloth = 3, clothAt: [number, number] = [13, 13]) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  const start = w.index(10, 10, Z), bedTile = w.index(40, 10, Z);
  w.build('bed', bedTile, 'oak');
  const patient = w.spawnDwarf({ at: start });
  for (const l of w.game.registry.table<{ id: string }>('labors').ids()) w.setLabor(patient, l, false);
  const ids: EntityId[] = [patient];
  let medicId = 0;
  if (medic !== null) {
    medicId = w.spawnDwarf({ at: w.index(12, 13, Z), skills: { medicine: medic } });
    for (const l of w.game.registry.table<{ id: string }>('labors').ids()) w.setLabor(medicId, l, l === 'medicine');
    if (cloth > 0) w.spawnItem('cloth', 'flax_cloth', w.index(clothAt[0], clothAt[1], Z), cloth);
    ids.push(medicId);
  }
  for (const id of ids) for (const need of NEEDS) w.setNeed(id, need, 0);
  world.emit({ type: 'DamageDealt', defenderId: patient, attackerId: 0, ...wound });
  w.step(3);
  expect(world.entities.has(patient, C.Patient)).toBe(true);
  const body = world.entities.get(patient, C.Body)!;
  const bleeding = body.parts.flatMap((p) => p.wounds).find((x) => x.bleed > 0)!;
  expect(bleeding).toBeDefined();
  const board = world.services.jobs as JobBoard;
  const tileOf = (id: EntityId): number => w.game.movement.tileOf(id);
  const bandages = () => w.events('TreatmentDone').filter((e) => e['patientId'] === patient && e['kind'] === 'stop_bleeding');
  return { w, world, patient, medicId, start, bedTile, body, bleeding, board, tileOf, bandages };
}

describe('T-405 the first bandage decides a serious wound', () => {
  it('a failing roll on stop_bleeding still bandages, with one cloth', () => {
    const a = ward('t405-no-fail', 0, { part: 'torso', damageType: 'edge', amount: 21 });
    expect(a.bleeding.severity).toBe('serious');
    const key = `stop_bleeding:${a.patient}`;
    a.w.until(() => a.board.byKey(key)?.state === 'working', 800);
    const job = a.board.jobs.get(a.board.byKey(key)!.id)!;
    // A real saved RNG state whose next draw is under the skill-0 failure chance; no mocked roll.
    let selected = false;
    for (let n = 0; n < 100; n += 1) {
      const rng = new RngStream(seedFor(`t405-failure-${n}`, '17'));
      const state = rng.state();
      if (rng.int(0, 999) >= TREAT_FAIL_PERMILLE) continue;
      a.world.rngFor('17').setState(state); selected = true; break;
    }
    expect(selected).toBe(true);
    a.w.until(() => job.state === 'done', 800);
    expect(a.bandages()).toHaveLength(1);
    expect(a.bleeding.bandaged).toBe(true);
    expect(a.bleeding.bleed).toBe(0);
    expect(a.w.readers.of<ItemsReader>('13').count('cloth')).toBe(2);
    a.w.step(20);
    expect(a.board.byKey(key)).toBeUndefined();
  });

  it('a bleeding conscious patient is bandaged on its tile, then walks to its bed', () => {
    // A broken leg bleeds, and with no splint in the fortress it keeps the dwarf a patient after the bandage.
    const a = ward('t405-on-tile', 5, { part: 'left_leg', damageType: 'blunt', amount: 13 });
    expect(a.world.entities.get(a.patient, C.Brain)?.behavior).toBe('patient');
    let moved = false;
    a.w.until(() => { if (a.tileOf(a.patient) !== a.start) moved = true; return a.bandages().length > 0; }, RESERVE_KEEP_TICKS);
    expect(a.bandages()).toHaveLength(1);
    expect(moved).toBe(false);
    expect(a.bleeding.bandaged).toBe(true);
    expect(roundTrip(a.w.game).game.hash()).toBe(a.w.game.hash());
        a.w.until(() => a.tileOf(a.patient) === a.bedTile, 400);
    expect(a.world.entities.get(a.patient, C.Brain)?.behavior).toBe('patient');
  });

  it('waits for its bandage at most RESERVE_KEEP_TICKS after the wound, then walks to its bed', () => {
    // The only cloth lies at the far corner of the map: the medic cannot be back within the wait.
    // A broken leg bleeds slowly, so the patient stays awake.
    const a = ward('t405-bounded', 5, { part: 'left_leg', damageType: 'blunt', amount: 13 }, 3, [92, 92]);
    a.w.until(() => a.w.tick >= a.bleeding.createdTick + RESERVE_KEEP_TICKS - 5, RESERVE_KEEP_TICKS);
    expect(a.bandages()).toHaveLength(0);
    expect(a.tileOf(a.patient)).toBe(a.start);
    a.w.until(() => a.tileOf(a.patient) === a.bedTile, 400);
    expect(a.world.entities.get(a.patient, C.Body)?.conscious).toBe(true);
  });

  it.each([['no one has the medicine labor', null, 3], ['there is no cloth', 5, 0]] as const)('a patient walks to its bed at once when %s', (_, medic, cloth) => {
    const a = ward(`t405-unserved-${cloth}`, medic, { part: 'left_leg', damageType: 'blunt', amount: 13 }, cloth);
    a.w.until(() => a.tileOf(a.patient) === a.bedTile, 400);
    expect(a.bandages()).toHaveLength(0);
  });

  it('an unconscious bleeding patient is bandaged before it is carried', () => {
    const a = ward('t405-carry', 5, { part: 'left_leg', damageType: 'blunt', amount: 13 });
    // Low on blood: unconscious, with a slow bleed that leaves time for the bandage.
    a.body.blood = Math.floor((a.body.maxBlood * 38) / 100);
    a.w.until(() => !a.body.conscious, 10);
    const carryKey = `carry_patient:${a.patient}`;
    let carriedEarly = false;
    a.w.until(() => { if (a.board.byKey(carryKey) !== undefined && a.bandages().length === 0) carriedEarly = true; return a.bandages().length > 0; }, RESERVE_KEEP_TICKS);
    expect(a.bandages()).toHaveLength(1);
    expect(carriedEarly).toBe(false);
    expect(a.tileOf(a.patient)).toBe(a.start);
    a.w.until(() => a.board.byKey(carryKey) !== undefined, 20);
    a.w.until(() => a.tileOf(a.patient) === a.bedTile, 600);
  });

  it('a bleeding patient in danger flees first', () => {
    const a = ward('t405-flee', 5, { part: 'torso', damageType: 'edge', amount: 21 });
    a.w.spawnCreature('gloam_warrior', a.w.index(13, 10, Z), 'hostile:gloam');
    a.w.until(() => a.world.entities.get(a.patient, C.Brain)?.behavior === 'flee', 30);
    a.w.step(10);
    expect(a.tileOf(a.patient)).not.toBe(a.start);
  });
});
