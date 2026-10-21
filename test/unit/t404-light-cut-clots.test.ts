/** T-404: a light cut clots in half the time, so a mailed soldier's light cuts no longer floor it. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import { TestWorld } from '../scenarios/test-world';

describe('T-404 a light cut stops bleeding 150 ticks after it was made', () => {
  it('bleeds at 140 ticks and has stopped at 160', () => {
    const w = new TestWorld({ seed: 't404-clot', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const dwarf = w.spawnDwarf({ at: w.index(20, 20, Z) });
    w.step(1);
    w.game.world.emit({ type: 'DamageDealt', defenderId: dwarf, part: 'left_leg', damageType: 'edge', amount: 5, attackerId: 0, weaponId: 0 });
    w.step(1);
    const bleed = (id: EntityId): number[] => w.game.world.entities.get(id, C.Body)?.parts.flatMap((p) => p.wounds).map((x) => x.bleed) ?? [];
    expect(bleed(dwarf)).toEqual([1]);
    w.step(140);
    expect(bleed(dwarf)).toEqual([1]);
    w.step(20);
    expect(bleed(dwarf)).toEqual([0]);
  });
});
