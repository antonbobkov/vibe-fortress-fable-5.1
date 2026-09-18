/**
 * Golden render for `rd_snapshot_surface` (`acceptance-tests.md` § 23 Rendering): seed `test-1`,
 * its default region (D-046), the surface at z = 32. The scenario of the same id compares against
 * this file; `npm run golden:update -- render/rd-snapshot-surface` rewrites it.
 */

import { describe, it, expect } from 'vitest';
import { generatedSpec } from '@app/headless';
import { TestWorld } from '../../scenarios/test-world';
import { asRows, compose, readGolden, snapshotView, SNAPSHOT_COLS, SNAPSHOT_ROWS, SNAPSHOT_SEED, updating, writeGolden } from './render-fixtures';

const NAME = 'rd-snapshot-surface';

describe('T-M1-15 golden: rd_snapshot_surface', () => {
  it('matches test/golden/render/rd-snapshot-surface.json', () => {
    const w = new TestWorld({ seed: SNAPSHOT_SEED, world: 'local', spec: generatedSpec(SNAPSHOT_SEED), embark: 'none' });
    w.step(1);
    const view = snapshotView(w.readers);
    const rows = asRows(compose(w.readers, view, SNAPSHOT_COLS, SNAPSHOT_ROWS));
    if (updating(NAME)) {
      writeGolden(NAME, { $note: `npm run golden:update -- render/${NAME}`, view: { seed: SNAPSHOT_SEED, ...view, cols: SNAPSHOT_COLS, rows: SNAPSHOT_ROWS }, cells: rows });
    }
    const golden = readGolden(NAME);
    expect(golden).not.toBeNull();
    expect(rows).toEqual(golden?.cells);
  });
});
