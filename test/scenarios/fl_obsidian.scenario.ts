/**
 * `fl_obsidian` of `04-implementation/acceptance-tests.md` § 04 Fluids: "a magma tile at level 7
 * with water poured on | tile becomes `Wall` `obsidian`; `ObsidianFormed`".
 *
 * A one-tile pocket in the granite of `flat-test` holds magma at level 7 on its floor; water is
 * poured into the open tile above it.
 */

import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'fl_obsidian',
  milestone: 3,
  seed: 'fl-obsidian',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    const pocket = w.index(40, 40, 25);
    w.carve(pocket, TileKind.Floor);
    w.carve(w.index(40, 40, 26), TileKind.Open);
    w.setFluid(pocket, 7, 'magma');
  },
  run: (w) => {
    w.step(4);
    w.setFluid(w.index(40, 40, 26), 7);
    w.step(4);
  },
  expect: (w) => {
    const pocket = w.index(40, 40, 25);
    expect(w.map.kindAt(pocket)).toBe(TileKind.Wall);
    expect(w.map.materialAt(pocket)).toBe(w.game.registry.table('materials').index('obsidian'));
    expect(w.fluids.sim.level(pocket)).toBe(0);
    expect(w.events('ObsidianFormed').map((e) => e['tile'])).toEqual([pocket]);
    // One unit of the water went to steam.
    expect(w.fluids.sim.level(w.index(40, 40, 26))).toBe(6);
  },
};

export default scenario;
