/** T-262: a failed treatment outlives discharge without re-admitting the dwarf. */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { RngStream, seedFor } from '@core/rng';
import { TREAT_FAIL_PERMILLE, type HealthSystem } from '@systems/health';
import type { ItemsReader } from '@systems/items';
import type { JobBoard } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

function surgery() {
  const w = new TestWorld({ seed: 't262-discharge-retry', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const at = w.index(10, 10, Z); w.build('bed', at, 'oak');
  const patient = w.spawnDwarf({ at }); w.setLabor(patient, 'medicine', false);
  const medic = w.spawnDwarf({ at: w.index(11, 10, Z), skills: { medicine: 20 } });
  const supply = w.index(11, 11, Z);
  w.spawnItem('cloth', 'flax_cloth', supply, 3);
  w.spawnItem('thread', 'flax_thread', supply, 3);
  w.spawnItem('easy_meal', 'dimcap', supply, 10);
  w.spawnItem('drink', 'ale', supply, 10);
  w.game.world.emit({ type: 'DamageDealt', defenderId: patient, attackerId: 0, part: 'torso', damageType: 'edge', amount: 15 });
  w.step(2);
  const body = w.game.world.entities.get(patient, C.Body)!;
  const cut = body.parts[1]!.wounds[0]!;
  expect(cut.severity).toBe('serious');
  expect(w.game.world.entities.has(patient, C.Patient)).toBe(true);
  // Isolate bandaging and suturing; cleaning and diagnosis are already finished.
  cut.cleaned = true; body.diagnosed = true;
  const board = w.game.world.services.jobs as JobBoard;
  const key = `suture:${patient}`;
  w.until(() => board.byKey(key)?.state === 'working' && !w.game.world.entities.has(patient, C.Patient), 800);
  const first = board.jobs.get(board.byKey(key)!.id)!;
  expect(first.workerId).toBe(medic);
  expect(cut.bandaged).toBe(true); expect(cut.sutured).toBe(false);
  const threads = () => w.readers.of<ItemsReader>('13').count('thread');
  const treatments = () => w.events('TreatmentDone').filter(e => e['patientId'] === patient && e['kind'] === 'suture');
  const fail = () => {
    w.setSkill(medic, 'medicine', 0);
    // A real saved RNG state chooses the existing low-skill failure branch; no mocked roll.
    let selected = false;
    for (let n = 0; n < 100; n += 1) {
      const rng = new RngStream(seedFor(`t262-failure-${n}`, '17'));
      const state = rng.state();
      if (rng.int(0, 999) >= TREAT_FAIL_PERMILLE) continue;
      w.game.world.rngFor('17').setState(state); selected = true; break;
    }
    expect(selected).toBe(true);
    w.until(() => first.state === 'done', 1000);
    expect(treatments()).toHaveLength(0);
    expect(threads()).toBe(2); expect(cut.sutured).toBe(false);
    expect(w.game.world.entities.has(patient, C.Patient)).toBe(false);
  };
  return { w, patient, medic, cut, board, key, first, threads, treatments, fail };
}

describe('T-262 treatment retry after discharge', () => {
  it('recreates the failed suture with a fresh thread and completes without re-admission', () => {
    const a = surgery(); a.fail(); a.w.setSkill(a.medic, 'medicine', 20);
    a.w.until(() => a.board.byKey(a.key)?.id !== undefined && a.board.byKey(a.key)?.id !== a.first.id, 50);
    expect(a.w.game.world.entities.has(a.patient, C.Patient)).toBe(false);
    expect(a.board.byKey(a.key)?.inputs[0]?.count).toBe(1);
    a.w.until(() => a.treatments().length === 1, 600);
    expect(a.cut.sutured).toBe(true); expect(a.threads()).toBe(1);
    expect(a.w.game.world.entities.has(a.patient, C.Patient)).toBe(false);
  });

  it('saves a pending failed request and preserves its next 50 continuation hashes', () => {
    const a = surgery(); a.fail();
    const loaded = roundTrip(a.w.game).game;
    expect(loaded.hash()).toBe(a.w.hash());
    for (let tick = 0; tick < 50; tick += 1) {
      a.w.step(1); loaded.step(1); expect(loaded.hash()).toBe(a.w.hash());
    }
    expect(a.board.byKey(a.key)?.id).toBeDefined();
    expect(a.board.byKey(a.key)?.id).not.toBe(a.first.id);
    expect(a.w.game.world.entities.has(a.patient, C.Patient)).toBe(false);
  });

  it('does not repeat a successful suture after discharge', () => {
    const a = surgery();
    a.w.until(() => a.treatments().length === 1, 600);
    expect(a.cut.sutured).toBe(true); expect(a.threads()).toBe(2);
    a.w.step(200);
    expect(a.board.byKey(a.key)).toBeUndefined();
    expect(a.treatments()).toHaveLength(1); expect(a.threads()).toBe(2);
  });

  it('ends the failed request if another care path has already sutured the wound', () => {
    const a = surgery(); a.fail(); a.cut.sutured = true;
    a.w.step(100);
    expect(a.board.byKey(a.key)).toBeUndefined();
    expect(a.threads()).toBe(2); expect(a.treatments()).toHaveLength(0);
    expect(a.w.game.world.entities.has(a.patient, C.Patient)).toBe(false);
  });
  it('cancels an already recreated request if its wound stops needing that treatment', () => {
    const a = surgery(); a.fail();
    a.w.until(() => a.board.byKey(a.key)?.id !== undefined && a.board.byKey(a.key)?.id !== a.first.id, 50);
    a.cut.sutured = true; a.w.step(50);
    expect(a.board.byKey(a.key)).toBeUndefined();
    expect(a.threads()).toBe(2); expect(a.treatments()).toHaveLength(0);
  });

  it('ends outstanding retries when the target dies, releasing any recreated job', () => {
    const a = surgery(); a.fail();
    a.w.until(() => a.board.byKey(a.key)?.id !== undefined && a.board.byKey(a.key)?.id !== a.first.id, 50);
    const body = a.w.game.world.entities.get(a.patient, C.Body)!;
    a.w.game.world.emit({ type: 'DamageDealt', defenderId: a.patient, attackerId: 0,
      part: 'torso', damageType: 'blunt', amount: body.parts[1]!.maxHp * 2 });
    a.w.until(() => !a.w.game.world.entities.alive(a.patient), 5);
    a.w.step(50);
    expect(a.board.byKey(a.key)).toBeUndefined();
    const state = (a.w.game.world.scheduler.byId('17') as HealthSystem).serialize();
    expect(state.pendingTreatments).toBeUndefined();
    expect(a.threads()).toBe(2);
  });

  it('preserves continuation when two failed kinds were recorded in a different insertion order', () => {
    const a = surgery(); a.fail(); a.cut.cleaned = false;
    // Completion can coincide with a producer poll; model the before-poll boundary for both kinds.
    a.board.cancelKey(a.key, 'test_pending_request_fixture');
    expect(a.board.byKey(a.key)).toBeUndefined();
    const world = a.w.game.world;
    const health = world.scheduler.byId('17') as HealthSystem;
    // Two concurrent treatments can fail before the next producer phase. Seed that saved state.
    health.deserialize({ ...health.serialize(), pendingTreatments: [[a.patient, ['suture', 'clean_wound']]] }, {
      world, registry: a.w.game.registry, readers: world.readers,
      rng: world.rngFor('17'), register: world.registrations,
    });
    const loaded = roundTrip(a.w.game).game;
    expect(loaded.hash()).toBe(a.w.hash());
    for (let tick = 0; tick < 50; tick += 1) {
      a.w.step(1); loaded.step(1); expect(loaded.hash()).toBe(a.w.hash());
    }
  });

});
