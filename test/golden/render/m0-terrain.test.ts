/**
 * Golden render: the M0 compositor over the hand-built 8×8 terrain fixture.
 *
 * `process/testing-strategy.md` § Golden tests: "`test/golden/render/*.json`: cell buffers of
 * the fortress viewport for `{ seed, z, camera }` at tick 0 and after a scripted command list".
 * M0 has no commands, so this is the tick-0 buffer of T-M0-13's fixture.
 *
 * The file is rewritten only by `npm run golden:update -- render/m0-terrain`, which sets
 * DEEPHOLM_GOLDEN_UPDATE and re-runs this test.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { STATUS_ROWS } from '@core/constants';
import { LOG_ROWS } from '@render/constants';
import { Compositor } from '@render/compositor';
import { Palette } from '@render/palette';
import { toHex } from '@render/palette';
import type { CellBuffer } from '@render/cellbuffer';
import {
  DAYLIGHT_TICK,
  FIXTURE_H,
  FIXTURE_W,
  FIXTURE_Z,
  buildTerrainFixture,
} from '../../unit/render/terrain-fixture';

const GOLDEN_NAME = 'render/m0-terrain';
const file = fileURLToPath(new URL('./m0-terrain.json', import.meta.url));

interface GoldenFile {
  $note: string;
  view: { seed: string; z: number; camX: number; camY: number; cols: number; rows: number; tick: number };
  cells: string[][];
}

const golden = JSON.parse(readFileSync(file, 'utf8')) as GoldenFile;
const update =
  process.env['DEEPHOLM_GOLDEN_UPDATE'] === GOLDEN_NAME ||
  process.env['DEEPHOLM_GOLDEN_UPDATE'] === 'all';

/** The grid that gives the map rectangle exactly the fixture's 8×8. */
const COLS = FIXTURE_W;
const ROWS = FIXTURE_H + LOG_ROWS + STATUS_ROWS;

function composed(): CellBuffer {
  const { world, registry } = buildTerrainFixture(true);
  const compositor = new Compositor({ registry, palette: new Palette(registry) });
  return compositor.compose(
    world.readers,
    { camX: 0, camY: 0, z: FIXTURE_Z, sidebarOpen: false, cursor: null },
    COLS,
    ROWS,
  );
}

function asRows(cells: CellBuffer): string[][] {
  const rows: string[][] = [];
  for (let row = 0; row < cells.rows; row += 1) {
    const out: string[] = [];
    for (let col = 0; col < cells.cols; col += 1) {
      const cell = cells.get(col, row);
      out.push(`${cell.glyph}:${toHex(cell.fg)}:${toHex(cell.bg)}`);
    }
    rows.push(out);
  }
  return rows;
}

describe('T-M0-13 golden: the M0 terrain cell buffer', () => {
  it('matches test/golden/render/m0-terrain.json', () => {
    const rows = asRows(composed());
    if (update) {
      const next: GoldenFile = {
        ...golden,
        view: {
          seed: 'm0-terrain',
          z: FIXTURE_Z,
          camX: 0,
          camY: 0,
          cols: COLS,
          rows: ROWS,
          tick: DAYLIGHT_TICK,
        },
        cells: rows,
      };
      writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      golden.cells = next.cells;
      golden.view = next.view;
    }
    expect(golden.view).toEqual({
      seed: 'm0-terrain',
      z: FIXTURE_Z,
      camX: 0,
      camY: 0,
      cols: COLS,
      rows: ROWS,
      tick: DAYLIGHT_TICK,
    });
    expect(rows).toEqual(golden.cells);
  });

  it('is deterministic: two composes of the same fixture agree', () => {
    expect(asRows(composed())).toEqual(asRows(composed()));
  });
});
