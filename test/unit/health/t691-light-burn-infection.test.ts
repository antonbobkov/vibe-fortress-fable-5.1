/**
 * T-691: a light burn is a scorch, not an open wound. A wildfire that gave a fortress 126 light burns
 * left them all waiting on a bucket and brightleaf, rolled for infection every day, and a third of
 * the fortress died of it. A light burn is never rolled for infection and asks for no cleaning; it is
 * still dressed (the dressing halves its pain). A serious burn, and any cut, is rolled and cleaned as before.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { createWound, woundTreatmentNeeds } from '@systems/health';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;
const PARTS = ['left_arm', 'right_arm', 'left_leg', 'right_leg', 'torso', 'head'] as const;

/** One dwarf with no labor and nobody to treat it, burned (or cut) on each part; `amount` 5 is a light wound. */
function burned(seed: string, amount: number, parts: readonly string[] = PARTS, damageType = 'burn') {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  const id = w.spawnDwarf({ at: w.index(10, 10, Z) });
  for (const l of w.game.registry.table<{ id: string }>('labors').ids()) w.setLabor(id, l, false);
  for (const need of NEEDS) w.setNeed(id, need, 0);
  for (const part of parts) world.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0, part, damageType, amount });
  w.step(3);
  const burns = () => world.entities.get(id, C.Body)!.parts.flatMap((p) => p.wounds).filter((x) => x.type === 'burn');
  return { w, id, burns };
}

describe('T-691 a light burn takes no infection', () => {
  it('light burns ask for dressing (T-693: four of them, that hurt enough) and no cleaning; a serious burn for both', () => {
    expect(woundTreatmentNeeds([1, 2, 3, 4].map(() => createWound('burn', 'light', 5, 0)))).toEqual(['dress_burn']);
    expect(woundTreatmentNeeds([createWound('burn', 'serious', 13, 0)])).toEqual(expect.arrayContaining(['clean_wound', 'dress_burn']));
  });

  it('six untreated light burns go twelve days with no infection and no cleaning job', () => {
    const a = burned('t691-light', 5);
    expect(a.burns()).toHaveLength(PARTS.length);
    expect(a.burns().every((b) => b.severity === 'light')).toBe(true);
    a.w.step(12 * TICKS_PER_DAY);
    expect(a.w.game.world.entities.alive(a.id)).toBe(true);
    expect(a.w.events('InfectionStarted')).toHaveLength(0);
    expect(a.w.readers.of<JobsReader>('11').list().some((j) => j.key.startsWith('clean_wound:'))).toBe(false);
  });

  it('two untreated light cuts beside them are still rolled and take infection', () => {
    const a = burned('t691-cuts', 5, ['left_arm', 'right_arm'], 'edge');
    a.w.step(12 * TICKS_PER_DAY);
    expect(a.w.events('InfectionStarted').length).toBeGreaterThan(0);
  });
});
