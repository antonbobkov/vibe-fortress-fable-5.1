/**
 * `fl_drown` of `04-implementation/acceptance-tests.md` § 04 Fluids: "a dwarf in a 1×1 pit
 * flooded to level 7 | `CreatureSubmerged` each health tick; death by `drowned` within 400 ticks".
 *
 * Drowning is 17 health's (M6); 04 emits `CreatureSubmerged` now. `M3-water-fire-sky.md` T-M3-02:
 * "`fl_drown` waits for M6 (health); add it now with `it.todo('M6')`". The M6 task that brings 17
 * removes the `todo` tag.
 */

import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'fl_drown',
  milestone: 6,
  seed: 'fl-drown',
  world: 'flat-test',
  embark: 'none',
  todo: 'M6',
  setup: (w) => {
    const pit = w.index(40, 40, 31);
    w.carve(pit, TileKind.Floor);
    w.carve(w.index(40, 40, 32), TileKind.Open);
    w.spawnDwarf({ at: pit });
    w.setFluid(pit, 7);
  },
  run: 400,
  expect: (w) => {
    expect(w.events('CreatureSubmerged').length).toBeGreaterThan(0);
    expect(w.events('CreatureDied').some((e) => e['cause'] === 'drowned')).toBe(true);
  },
};

export default scenario;
