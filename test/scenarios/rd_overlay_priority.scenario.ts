/**
 * `rd_overlay_priority` of `04-implementation/acceptance-tests.md` § 23 Rendering: "designation over
 * a creature | creature glyph wins; bg tinted".
 *
 * A dwarf stands on a `flat-test` surface floor that is designated for a channel (priority 3); the
 * cell shows the dwarf's glyph over the channel tint, also with the priority digits switched on
 * ("digits replace glyph only if no creature", `algorithms/compositor.md`).
 */

import { expect } from 'vitest';
import { loadContent } from '@content/loader';
import { STATUS_ROWS } from '@core/constants';
import { Designation } from '@core/map3d';
import { LOG_ROWS } from '@render/constants';
import { Compositor, OVERLAY_PRIORITY_DIGITS } from '@render/compositor';
import { Palette } from '@render/palette';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { Scenario } from './runner';

const X = 20;
const Y = 20;

const scenario: Scenario = {
  id: 'rd_overlay_priority',
  milestone: 1,
  seed: 'rd-overlay-priority',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    w.spawnDwarf({ at: w.index(X, Y, FLAT_TEST_SURFACE_Z) });
    w.submit({ type: 'Designate', tiles: [w.index(X, Y, FLAT_TEST_SURFACE_Z), w.index(X + 1, Y, FLAT_TEST_SURFACE_Z)], kind: 'channel', priority: 3 });
  },
  run: 1,
  expect: (w) => {
    const i = w.index(X, Y, FLAT_TEST_SURFACE_Z);
    expect(w.readers.map.designationAt(i)).toBe(Designation.Channel);
    expect(w.readers.entities.at(i).length).toBe(1);
    const registry = loadContent();
    const palette = new Palette(registry);
    const compositor = new Compositor({ registry, palette });
    const tint = palette.color('des_channel');
    for (const overlays of [undefined, ['designations', 'zones', OVERLAY_PRIORITY_DIGITS]]) {
      const base = { camX: X - 2, camY: Y - 2, z: FLAT_TEST_SURFACE_Z, sidebarOpen: false, cursor: null };
      const cells = compositor.compose(w.readers, overlays === undefined ? base : { ...base, overlays }, 8, 8 + LOG_ROWS + STATUS_ROWS);
      const dwarf = cells.get(2, 2);
      expect(dwarf.glyph).toBe(1); // ☺
      expect(dwarf.fg).toBe(palette.color('dwarf_normal'));
      expect(dwarf.bg).toBe(tint);
      // The neighbour has no creature: tinted, and with digits on it shows the priority.
      const next = cells.get(3, 2);
      expect(next.bg).toBe(tint);
      if (overlays !== undefined) expect(next.glyph).toBe(48 + 3);
    }
  },
};

export default scenario;
