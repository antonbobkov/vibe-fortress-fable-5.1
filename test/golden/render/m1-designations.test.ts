/**
 * Golden render `m1-designations` (`M1-ground.md` T-M1-15): the `flat-test` fortress with the
 * default embark after a scripted command list of designations, composed with the default
 * overlays and with the priority digits on (`01-testing-strategy.md` § Golden tests: "cell buffers
 * of the fortress viewport … after a scripted command list"). Covers step 6 (the dwarves) and
 * step 8 (tints, outlines on undiscovered tiles, digits that never cover a creature).
 */

import { describe, it, expect } from 'vitest';
import type { Command } from '@core/commands';
import { STATUS_ROWS } from '@core/constants';
import { LOG_ROWS } from '@render/constants';
import { OVERLAY_PRIORITY_DIGITS, type ViewState } from '@render/compositor';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TestWorld } from '../../scenarios/test-world';
import { asRows, compose, readGolden, updating, writeGolden } from './render-fixtures';

const NAME = 'm1-designations';
const COLS = 24;
const ROWS = 12 + LOG_ROWS + STATUS_ROWS;

function scripted(): { w: TestWorld; camX: number; camY: number; wagon: { x: number; y: number } } {
  const w = new TestWorld({ seed: 'm1-designations', world: 'flat-test', embark: 'default' });
  const wagon = w.game.arrival?.wagon;
  if (wagon === undefined) throw new Error('no arrival');
  const z = FLAT_TEST_SURFACE_Z;
  const row = (y: number, x0: number, n: number, zz: number): number[] => Array.from({ length: n }, (_, k) => w.index(x0 + k, y, zz));
  const dwarfTile = w.movement.tileOf(w.game.arrival?.dwarves[0] as number);
  const commands: Command[] = [
    { type: 'Designate', tiles: row(wagon.y + 3, wagon.x - 4, 4, z), kind: 'channel', priority: 2 },
    { type: 'Designate', tiles: row(wagon.y + 4, wagon.x - 4, 4, z), kind: 'stairs_down', priority: 7 },
    { type: 'Designate', tiles: [dwarfTile], kind: 'channel', priority: 9 },
  ];
  for (const c of commands) w.submit(c);
  w.step(1);
  return { w, camX: wagon.x - 12, camY: Math.max(0, wagon.y - 4), wagon };
}

function view(camX: number, camY: number, z: number, overlays?: string[]): ViewState {
  return overlays === undefined
    ? { camX, camY, z, sidebarOpen: false, cursor: null }
    : { camX, camY, z, sidebarOpen: false, cursor: null, overlays };
}

describe('T-M1-15 golden: m1-designations', () => {
  it('matches test/golden/render/m1-designations.json', () => {
    const { w, camX, camY, wagon } = scripted();
    // Dig designations under the surface: undiscovered, drawn as outlines.
    w.submit({ type: 'Designate', tiles: [w.index(wagon.x + 6, wagon.y + 6, FLAT_TEST_SURFACE_Z - 1), w.index(wagon.x + 7, wagon.y + 6, FLAT_TEST_SURFACE_Z - 1)], kind: 'dig', priority: 4 });
    w.step(1);
    const surface = asRows(compose(w.readers, view(camX, camY, FLAT_TEST_SURFACE_Z), COLS, ROWS));
    const digits = asRows(compose(w.readers, view(camX, camY, FLAT_TEST_SURFACE_Z, ['designations', 'zones', OVERLAY_PRIORITY_DIGITS]), COLS, ROWS));
    const below = asRows(compose(w.readers, view(camX, camY, FLAT_TEST_SURFACE_Z - 1), COLS, ROWS));
    const cells = [...surface, ...digits, ...below];
    if (updating(NAME)) {
      writeGolden(NAME, { $note: `npm run golden:update -- render/${NAME}; three views stacked: surface, surface with priority digits, z-1`, view: { seed: 'm1-designations', camX, camY, z: FLAT_TEST_SURFACE_Z, cols: COLS, rows: ROWS }, cells });
    }
    const golden = readGolden(NAME);
    expect(golden).not.toBeNull();
    expect(cells).toEqual(golden?.cells);
  });
});
