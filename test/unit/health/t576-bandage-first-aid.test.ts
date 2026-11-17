/**
 * T-576: over 36 ambushes at peril 4, 49 of 56 dwarves dead bled out, most of them in the halls,
 * with a medic beside them still at the bandage, or gone to bed with its cloth in hand. A bandage is
 * first aid, `BANDAGE_TICKS` of work and not a treatment's `TREAT_TICKS`; and a patient's
 * priority-1 job is not held for a worker who leaves it (11 § Job steps).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
import { BANDAGE_TICKS, TREAT_TICKS } from '@systems/health/constants';
import type { JobBoard } from '@systems/jobs';
import { JOB_HOLD_TICKS } from '@systems/jobs/constants';
import { TestWorld } from '../../scenarios/test-world';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

/** A serious cut on a dwarf at (10, 10), and `medics` unskilled medics beside it with cloth at hand. */
function seriousCut(seed: string, medics: number) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  const labors = w.game.registry.table<{ id: string }>('labors').ids();
  const patient = w.spawnDwarf({ at: w.index(10, 10, Z) });
  for (const l of labors) w.setLabor(patient, l, false);
  const ids = Array.from({ length: medics }, (_, i) => {
    const id = w.spawnDwarf({ at: w.index(12 + i, 12, Z) });
    for (const l of labors) w.setLabor(id, l, l === 'medicine');
    return id;
  });
  w.spawnItem('cloth', 'flax_cloth', w.index(12, 11, Z), 3);
  for (const id of [patient, ...ids]) for (const need of NEEDS) w.setNeed(id, need, 0);
  world.emit({ type: 'DamageDealt', defenderId: patient, attackerId: 0, part: 'torso', damageType: 'edge', amount: 21 });
  w.step(2);
  const cut = world.entities.get(patient, C.Body)!.parts.flatMap((p) => p.wounds)[0]!;
  expect(cut.severity).toBe('serious');
  return { w, world, patient, medics: ids, cut, board: world.services.jobs as JobBoard, key: `stop_bleeding:${patient}` };
}

describe('T-576 a bandage is first aid', () => {
  it('an unskilled medic puts the bandage on in BANDAGE_TICKS of work, well before a treatment\'s TREAT_TICKS', () => {
    expect(BANDAGE_TICKS).toBeLessThan(TREAT_TICKS);
    const a = seriousCut('t576-bandage', 1);
    let started = -1;
    for (let t = 0; t < TREAT_TICKS * 2 && !a.cut.bandaged; t += 1) {
      a.w.step(1);
      if (started < 0 && a.board.byKey(a.key)?.state === 'working') started = a.w.tick;
    }
    expect(a.cut.bandaged).toBe(true);
    expect(started).toBeGreaterThan(0);
    // Skill 0 at full productivity: BANDAGE_TICKS of work, a tick or two of bookkeeping.
    expect(a.w.tick - started).toBeLessThanOrEqual(BANDAGE_TICKS + 2);
  });

  it('a medic who leaves the bandage for a critical need gives it back at once, and another medic puts it on', () => {
    const a = seriousCut('t576-lifeline', 2);
    const [first, second] = a.medics as [number, number];
    let holder = 0;
    for (let t = 0; t < 100 && holder === 0; t += 1) {
      a.w.step(1);
      holder = a.board.byKey(a.key)?.workerId ?? 0;
    }
    expect([first, second]).toContain(holder);
    const other = holder === first ? second : first;
    // Under the hearth alert (as after an ambush) the holder, worn out, goes to bed: a critical
    // need takes a sheltering civilian from any job.
    a.w.build('hearth', a.w.index(20, 20, Z), 'granite');
    for (let y = 17; y < 24; y += 1) for (let x = 17; x < 24; x += 1) a.world.services.terrain.setFlag(a.w.index(x, y, Z), TileFlag.Outdoor, false);
    expect(a.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    a.w.step(1);
    expect(a.board.byKey(a.key)?.workerId, 'patient care goes on under the alert').toBe(holder);
    a.w.setNeed(holder, 'rest', 95);
    for (let t = 0; t < 20 && a.world.entities.get(holder, C.Brain)?.behavior === 'work'; t += 1) a.w.step(1);
    expect(a.world.entities.get(holder, C.Brain)?.behavior).toBe('need');
    a.w.step(2);
    expect(a.board.byKey(a.key)?.workerId, 'not held for the sleeper').not.toBe(holder);
    for (let t = 0; t < JOB_HOLD_TICKS / 2 && !a.cut.bandaged; t += 1) a.w.step(1);
    expect(a.cut.bandaged, 'the other medic put it on long before JOB_HOLD_TICKS').toBe(true);
    expect(a.w.events('TreatmentDone').find((e) => e['kind'] === 'stop_bleeding')?.['medicId'] ?? other).toBe(other);
  });
});
