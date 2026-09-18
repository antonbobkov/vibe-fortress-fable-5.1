/**
 * `rd_snapshot_surface` of `04-implementation/acceptance-tests.md` § 23 Rendering: "render a fixed
 * seed's surface at z=32 | cell buffer matches the stored golden (glyph, fg, bg)".
 *
 * `M1-ground.md` T-M1-15: "seed `test-1` region 0 at z=32 against a stored golden": the standard
 * world of `test-1` at its default region (D-046), no party. The golden is
 * `test/golden/render/rd-snapshot-surface.json`, rewritten only by `golden:update`.
 */

import { expect } from 'vitest';
import type { Scenario } from './runner';
import { asRows, compose, readGolden, snapshotView, SNAPSHOT_COLS, SNAPSHOT_ROWS, SNAPSHOT_SEED } from '../golden/render/render-fixtures';

const scenario: Scenario = {
  id: 'rd_snapshot_surface',
  milestone: 1,
  seed: SNAPSHOT_SEED,
  world: 'generated',
  embark: 'none',
  run: 1,
  expect: (w) => {
    const golden = readGolden('rd-snapshot-surface');
    expect(golden).not.toBeNull();
    const rows = asRows(compose(w.readers, snapshotView(w.readers), SNAPSHOT_COLS, SNAPSHOT_ROWS));
    expect(rows).toEqual(golden?.cells);
  },
};

export default scenario;
