/** T-261 infection changes the required inputs of an existing cleaning job. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { effortRequired, workCentiTicks, type JobBoard } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

function planned() {
  const w = new TestWorld({ seed: 't137-cure-1-20', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const at = w.index(10, 10, FLAT_TEST_SURFACE_Z); w.build('bed', at, 'oak');
  const patient = w.spawnDwarf({ at }); w.setLabor(patient, 'medicine', false);
  w.spawnDwarf({ at: w.index(11, 10, FLAT_TEST_SURFACE_Z), skills: { medicine: 20 } });
  w.spawnItem('easy_meal', 'dimcap', w.index(12, 10, FLAT_TEST_SURFACE_Z), 10);
  w.spawnItem('drink', 'ale', w.index(12, 11, FLAT_TEST_SURFACE_Z), 10);
  w.game.world.emit({ type: 'DamageDealt', defenderId: patient, attackerId: 0, part: 'torso', damageType: 'edge', amount: 15 });
  w.step(2);
  const entities = w.game.world.entities; const body = entities.get(patient, C.Body)!;
  const cut = body.parts.flatMap(p => p.wounds)[0]!;
  Object.assign(cut, { bandaged: true, bleed: 0, sutured: true }); body.diagnosed = true;
  const board = w.game.world.services.jobs as JobBoard;
  const key = `clean_wound:${patient}`; const old = board.jobs.get(board.byKey(key)!.id)!;
  expect(old).toBeDefined(); expect(old.inputs).toEqual([]);
  const supplies = w.index(11, 11, FLAT_TEST_SURFACE_Z);
  const leaf = w.game.registry.table('items').index('brightleaf');
  const stock = () => entities.with(C.Item).reduce((n, id) => n + (entities.get(id, C.Item)!.type === leaf ? entities.get(id, C.Item)!.count : 0), 0);
  const treatments = () => w.events('TreatmentDone').filter(e => e['patientId'] === patient && e['kind'] === 'clean_wound');
  const infect = () => Object.assign(cut, { cleaned: true, infected: true, infectedSince: w.tick });
  const bucket = () => w.spawnItem('bucket', 'oak', supplies);
  const leaves = () => w.spawnItem('brightleaf', 'brightleaf', supplies, 10);
  return { w, cut, board, key, old, stock, treatments, infect, bucket, leaves, entities };
}

describe('T-261 a newly infected wound requires real brightleaf', () => {
  it('replaces the already planned input-free cleaning with an infection job and consumes one brightleaf', () => {
    const a = planned(); a.infect(); const bucket = a.bucket(); a.leaves();
    a.w.until(() => a.treatments().length === 1, 600);
    expect(a.stock()).toBe(9); expect(a.cut.curedAt).toBeDefined();
    expect(a.old.state).toBe('cancelled'); expect(a.entities.alive(bucket)).toBe(true);
  });
  it('waits for brightleaf when infection appears while the old job waits for its bucket', () => {
    const a = planned(); a.w.step(20); expect(a.treatments()).toHaveLength(0);
    a.infect(); a.bucket(); a.w.step(100);
    expect(a.cut.curedAt).toBeUndefined(); expect(a.treatments()).toHaveLength(0);
    expect(a.board.byKey(a.key)?.inputs[0]?.filter.category).toBe('medical/brightleaf');
    a.leaves(); a.w.until(() => a.treatments().length === 1, 600); expect(a.stock()).toBe(9);
  });
  it('revalidates on the final work step before system 11 can poll producers again', () => {
    const a = planned(); a.bucket(); a.leaves();
    a.w.until(() => a.board.byKey(a.key)?.state === 'working', 600);
    expect(a.treatments()).toHaveLength(0);
    a.old.data['effort'] = effortRequired(workCentiTicks(a.board, a.old)); a.old.progress = 999;
    a.infect(); a.w.step(1);
    expect(a.treatments()).toHaveLength(0); expect(a.cut.curedAt).toBeUndefined();
    // Health re-admits the newly infected dwarf on its next cadence. Completion stays held.
    a.w.until(() => a.old.state === 'cancelled', 20);
    expect(a.treatments()).toHaveLength(0);
    a.w.until(() => a.treatments().length === 1, 600); expect(a.stock()).toBe(9);
  });
  it('uninfected cleaning stays input-free and consumes no brightleaf', () => {
    const a = planned(); a.bucket(); a.leaves();
    a.w.until(() => a.treatments().length === 1, 600);
    expect(a.cut.cleaned).toBe(true); expect(a.cut.curedAt).toBeUndefined();
    expect(a.stock()).toBe(10); expect(a.old.state).toBe('done');
  });
});
