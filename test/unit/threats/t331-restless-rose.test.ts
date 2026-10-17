/** T-331: `RestlessRose` is reached by a stepped world while the scenario `th_restless` is todo (T-351). */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { regionSpec } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import type { RegionRecord } from '@systems/worldgen';
import { TestWorld } from '../../scenarios/test-world';

describe('T-331 restless dead rise at dusk on an old battlefield', () => {
  it('emits RestlessRose with as many living restless dead as it counts', () => {
    const w = new TestWorld({
      seed: 'th-restless',
      world: 'local',
      spec: regionSpec('th-restless', { traits: ['old_battlefield'], temper: 2 } as Partial<RegionRecord>),
      embark: 'none',
      startTick: 56 * TICKS_PER_DAY + 17 * TICKS_PER_HOUR,
    });
    w.spawnDwarf({ at: w.index(24, 24, FLAT_TEST_SURFACE_Z) });
    w.step(3 * TICKS_PER_HOUR);
    const rose = w.events('RestlessRose');
    expect(rose.length).toBeGreaterThanOrEqual(1);
    const restless = w.game.world.entities
      .with(C.Hostile)
      .filter((id) => w.game.world.entities.get(id, C.Hostile)?.role === 'restless');
    expect(restless.length).toBe(rose[0]?.['count']);
  });
});
