/**
 * `ma_magma_melt` of `04-implementation/acceptance-tests.md` § 05 Materials: "a copper bar and a
 * granite block pushed into magma | copper `ItemMelted`; granite survives".
 *
 * A two-tile pocket in the granite of `flat-test`: magma at level 7 on one floor, the two items on
 * the other. The magma spreads onto the items' tile (04), which reports `MagmaContact`; 05 melts
 * what melts at or below `MAGMA_C` and 13 destroys it.
 */

import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import type { Scenario } from './runner';

let copper = 0;
let granite = 0;

const scenario: Scenario = {
  id: 'ma_magma_melt',
  milestone: 3,
  seed: 'ma-magma-melt',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    const lava = w.index(40, 40, 25);
    const rim = w.index(41, 40, 25);
    w.carve(lava, TileKind.Floor);
    w.carve(rim, TileKind.Floor);
    copper = w.spawnItem('bar', 'copper', rim);
    granite = w.spawnItem('stone_block', 'granite', rim);
    w.setFluid(lava, 7, 'magma');
  },
  run: 60,
  expect: (w) => {
    const melted = w.events('ItemMelted').map((e) => e['id']);
    expect(melted).toEqual([copper]);
    expect(w.game.world.entities.alive(copper)).toBe(false);
    expect(w.game.world.entities.alive(granite)).toBe(true);
    const contact = w.events('MagmaContact');
    expect(contact.length).toBeGreaterThan(0);
    expect(w.events('ItemDestroyed').some((e) => e['id'] === copper && e['reason'] === 'melted')).toBe(true);
  },
};

export default scenario;
