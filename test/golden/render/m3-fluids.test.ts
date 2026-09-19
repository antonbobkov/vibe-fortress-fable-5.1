/**
 * Golden render `m3-fluids` (`M3-water-fire-sky.md` T-M3-08): "a river slice with levels 1–7 and a
 * magma pool, animation phase 0 and 1". A dug channel on the `flat-test` surface holds water at
 * levels 1 … 7 (the low tiles active, the deep ones settled), a magma pool sits beside it, one
 * tile burns, one carries mist, and the two views are the same scene at animation phase 0 and 1.
 * Covers 23 § Compositor step 3 and § Animation, and the `fluid levels` overlay of step 8.
 */

import { describe, it, expect } from 'vitest';
import { STATUS_ROWS } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import { LOG_ROWS } from '@render/constants';
import { OVERLAY_FLUID_LEVELS } from '@render/environment';
import type { ViewState } from '@render/compositor';
import { FLAT_TEST_SURFACE_Z, DEFAULT_EMBARK_PRESET } from '@app/headless';
import { TestWorld } from '../../scenarios/test-world';
import { asRows, compose, readGolden, updating, writeGolden } from './render-fixtures';

const NAME = 'm3-fluids';
const COLS = 20;
const ROWS = 8 + LOG_ROWS + STATUS_ROWS;
const Z = FLAT_TEST_SURFACE_Z;
const X0 = 20;
const Y0 = 20;

function scene(): TestWorld {
  const w = new TestWorld({ seed: 'm3-fluids', world: 'flat-test', embark: 'none', startTick: 8 * 50 });
  // A channel of seven tiles, one level per tile, and a magma pool two tiles further on.
  for (let k = 0; k < 7; k += 1) {
    const t = w.index(X0 + k, Y0, Z);
    w.carve(t, TileKind.Floor);
    w.setFluid(t, k + 1);
  }
  for (let k = 0; k < 3; k += 1) w.setFluid(w.index(X0 + k, Y0 + 2, Z), 7, 'magma');
  // The deep half settles; the shallow half stays active and shimmers.
  for (let k = 3; k < 7; k += 1) w.fluids.sim.deactivate(w.index(X0 + k, Y0, Z));
  w.map.setFlag(w.index(X0 + 1, Y0 + 4, Z), TileFlag.Burning, true);
  w.fluids.sim.mist.set(w.index(X0 + 4, Y0 + 4, Z), w.tick + 1000);
  return w;
}

/** Phase 0 is `animFrame` 0 (both clocks at 0), phase 1 is `animFrame` 3 (both at 1). */
function view(animFrame: number, overlays?: string[]): ViewState {
  const base = { camX: X0 - 2, camY: Y0 - 2, z: Z, sidebarOpen: false, cursor: null, animFrame };
  return overlays === undefined ? base : { ...base, overlays };
}

describe('T-M3-08 golden: m3-fluids', () => {
  it('matches test/golden/render/m3-fluids.json', () => {
    const w = scene();
    const phase0 = asRows(compose(w.readers, view(0), COLS, ROWS));
    const phase1 = asRows(compose(w.readers, view(3), COLS, ROWS));
    const levels = asRows(compose(w.readers, view(0, ['designations', 'zones', OVERLAY_FLUID_LEVELS]), COLS, ROWS));
    const cells = [...phase0, ...phase1, ...levels];
    if (updating(NAME)) {
      writeGolden(NAME, {
        $note: `npm run golden:update -- render/${NAME}; three views stacked: animation phase 0, animation phase 1, and phase 0 with the fluid levels overlay on`,
        view: { seed: 'm3-fluids', embark: DEFAULT_EMBARK_PRESET, camX: X0 - 2, camY: Y0 - 2, z: Z, cols: COLS, rows: ROWS },
        cells,
      });
    }
    const golden = readGolden(NAME);
    expect(golden).not.toBeNull();
    expect(cells).toEqual(golden?.cells);
  });
});
