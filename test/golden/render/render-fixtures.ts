/**
 * Shared views of the M1 render goldens: `rd_snapshot_surface` ("render a fixed seed's surface at
 * z=32 | cell buffer matches the stored golden (glyph, fg, bg)") and `render/m1-designations`.
 * The scenario and the golden test compose through the same function, so `golden:update`
 * rewrites exactly what the scenario compares.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadContent } from '@content/loader';
import { STATUS_ROWS } from '@core/constants';
import type { ReaderSet } from '@core/readers';
import { LOG_ROWS } from '@render/constants';
import { Compositor, type ViewState } from '@render/compositor';
import type { CellBuffer } from '@render/cellbuffer';
import { Palette, toHex } from '@render/palette';

export const SNAPSHOT_SEED = 'test-1';
export const SNAPSHOT_Z = 32;
export const SNAPSHOT_COLS = 48;
export const SNAPSHOT_ROWS = 24 + LOG_ROWS + STATUS_ROWS;

export interface RenderGolden {
  $note: string;
  view: Record<string, unknown>;
  cells: string[][];
}

export function asRows(cells: CellBuffer): string[][] {
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

export function compose(readers: ReaderSet, view: ViewState, cols: number, rows: number): CellBuffer {
  const registry = loadContent();
  return new Compositor({ registry, palette: new Palette(registry) }).compose(readers, view, cols, rows);
}

/** The snapshot's view: the map's centre at z = 32, sidebar closed, default overlays. */
export function snapshotView(readers: ReaderSet): ViewState {
  const map = readers.map;
  return {
    camX: Math.floor((map.w - SNAPSHOT_COLS) / 2),
    camY: Math.floor((map.h - (SNAPSHOT_ROWS - LOG_ROWS - STATUS_ROWS)) / 2),
    z: SNAPSHOT_Z,
    sidebarOpen: false,
    cursor: null,
  };
}

export function goldenFile(name: string): string {
  return fileURLToPath(new URL(`./${name}.json`, import.meta.url));
}

export function readGolden(name: string): RenderGolden | null {
  const file = goldenFile(name);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as RenderGolden) : null;
}

export function writeGolden(name: string, golden: RenderGolden): void {
  writeFileSync(goldenFile(name), `${JSON.stringify(golden, null, 2)}\n`, 'utf8');
}

export function updating(name: string): boolean {
  const v = process.env['DEEPHOLM_GOLDEN_UPDATE'];
  return v === `render/${name}` || v === 'all';
}
