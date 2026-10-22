/**
 * T-419: a light burn admits no one. A fire that burned every dwarf with the medicine labor made
 * them all patients, and a patient works no job, so nobody dressed or cleaned a burn for days. The
 * burned dwarf keeps working, and its dress_burn (and cleaning) is still made and done.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TestWorld } from '../../scenarios/test-world';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

/** Two dwarves, both with the medicine labor, each with two light burns; cloth and a bucket at hand. */
function fire(seed: string, severityAmount = 5) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  const labors = w.game.registry.table<{ id: string }>('labors').ids();
  const medics = [w.spawnDwarf({ at: w.index(10, 10, Z), skills: { medicine: 20 } }), w.spawnDwarf({ at: w.index(12, 10, Z), skills: { medicine: 20 } })];
  for (const id of medics) {
    for (const l of labors) w.setLabor(id, l, l === 'medicine');
    for (const need of NEEDS) w.setNeed(id, need, 0);
  }
  w.spawnItem('cloth', 'flax_cloth', w.index(11, 11, Z), 10);
  for (const id of medics) for (const part of ['left_arm', 'right_leg'])
    world.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0, part, damageType: 'burn', amount: severityAmount });
  w.step(3);
  const burns = (id: number) => world.entities.get(id, C.Body)!.parts.flatMap((p) => p.wounds).filter((x) => x.type === 'burn');
  return { w, world, medics, burns };
}

describe('T-419 a light burn admits no one', () => {
  it('two medics with light burns stay off the patient list and dress each other within a day', () => {
    const a = fire('t419-light');
    for (const id of a.medics) {
      expect(a.burns(id).every((b) => b.severity === 'light')).toBe(true);
      expect(a.world.entities.has(id, C.Patient)).toBe(false);
    }
    a.w.until(() => a.medics.every((id) => a.burns(id).every((b) => b.dressed)), TICKS_PER_DAY);
    expect(a.w.events('PatientAdmitted')).toHaveLength(0);
  });

  it('a serious burn still admits its dwarf', () => {
    const a = fire('t419-serious', 13);
    for (const id of a.medics) {
      expect(a.burns(id).some((b) => b.severity === 'serious')).toBe(true);
      expect(a.world.entities.has(id, C.Patient)).toBe(true);
    }
  });
});
