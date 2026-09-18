/**
 * `rd_levels_below` of `04-implementation/acceptance-tests.md` § 23 Rendering:
 * "open shaft 3 deep | cell shows the floor 2 below dimmed twice; 3 below shows abyss".
 *
 * Two shafts are cut into the `flat-test` rock below the surface, so both are indoors and the
 * look-down of `23` § Compositor step 2 answers with the abyss rather than the sky. The viewport
 * looks at z = 31, the first level under the surface.
 */

import { expect } from 'vitest';
import { loadContent } from '@content/loader';
import { LEVELS_VISIBLE_BELOW, STATUS_ROWS } from '@core/constants';
import { TileKind } from '@core/map3d';
import { LOG_ROWS } from '@render/constants';
import { Compositor } from '@render/compositor';
import { Palette } from '@render/palette';
import { GLYPH_NONE, GLYPH_ROUGH_FLOOR } from '@render/glyphs';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';

const VIEW_Z = 31;
/** The column whose floor is two levels below the viewport. */
const TWO_BELOW_X = 10;
/** The column whose shaft is three deep, so nothing is within `LEVELS_VISIBLE_BELOW`. */
const THREE_DEEP_X = 12;
const Y = 10;

/** A viewport wide enough to hold both columns, with the log strip and status bar below it. */
const COLS = 16;
const ROWS = 8 + LOG_ROWS + STATUS_ROWS;

const scenario: Scenario = {
  id: 'rd_levels_below',
  milestone: 0,
  seed: 'rd-levels-below',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    expect(LEVELS_VISIBLE_BELOW).toBe(2);
    for (const x of [TWO_BELOW_X, THREE_DEEP_X]) {
      // The shaft: the viewport level and the level under it are open.
      for (let z = VIEW_Z; z > VIEW_Z - 2; z -= 1) w.carve(w.index(x, Y, z), TileKind.Open);
      w.carve(w.index(x, Y, VIEW_Z - 2), x === TWO_BELOW_X ? TileKind.Floor : TileKind.Open);
      // 03 terrain marks a dug tile discovered; it arrives in M1.
      for (let z = VIEW_Z; z >= VIEW_Z - 3; z -= 1) w.discover(w.index(x, Y, z));
    }
  },
  run: 1,
  expect: (w: TestWorld) => {
    const registry = loadContent();
    const palette = new Palette(registry);
    const compositor = new Compositor({ registry, palette });
    const camX = TWO_BELOW_X - 2;
    const camY = Y - 2;
    const cells = compositor.compose(
      w.readers,
      { camX, camY, z: VIEW_Z, sidebarOpen: false, cursor: null },
      COLS,
      ROWS,
    );

    // The floor two levels below is drawn dimmed twice.
    const twoBelow = cells.get(TWO_BELOW_X - camX, Y - camY);
    const granite = palette.color('granite_gray');
    expect(twoBelow.glyph).toBe(GLYPH_ROUGH_FLOOR);
    expect(twoBelow.fg).toBe(palette.dim(granite, 2));
    expect(twoBelow.fg).not.toBe(palette.dim(granite, 1));
    expect(twoBelow.fg).not.toBe(granite);

    // Three deep: nothing within LEVELS_VISIBLE_BELOW, and the column is not outdoors.
    const abyss = palette.color('abyss');
    expect(w.readers.map.isOutdoor(w.index(THREE_DEEP_X, Y, VIEW_Z))).toBe(false);
    expect(cells.get(THREE_DEEP_X - camX, Y - camY)).toEqual({
      glyph: GLYPH_NONE,
      fg: abyss,
      bg: abyss,
    });
  },
};

export default scenario;
