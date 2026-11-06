/**
 * `snapshot(game, name, view?)`: a picture of a headless game at a moment of a test
 * (`tooling.md` § Screenshots). With `SNAPSHOTS=1` in the environment it writes
 * `out/screenshots/<name>.png`, the map as the fortress screen draws it; otherwise it does nothing
 * at all, so a normal run reads nothing and costs nothing. A snapshot only reads the world: the
 * run's world hashes are the same with it as without.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import type { HeadlessGame } from '@app/headless';
import { gameGlyphMasks, mapPicture, viewAround } from '@app/screenshot';
import type { GlyphMask } from '@render/atlas';

export const SNAPSHOT_DIR = 'out/screenshots';
const FONT = 'src/assets/unscii-8.ttf';

export interface SnapshotView {
  /** The tile the picture is centred on; the arrival wagon by default. */
  readonly x?: number;
  readonly y?: number;
  /** The level; the wagon's by default. */
  readonly z?: number;
  /** The size in tiles; 48 × 24 by default. */
  readonly cols?: number;
  readonly rows?: number;
  /** Pixels a design pixel: a tile is `8 × scale` pixels square; 2 by default. */
  readonly scale?: number;
}

/** Whether snapshots are written in this run. */
export function snapshotsOn(): boolean {
  return process.env['SNAPSHOTS'] === '1';
}

let masks: GlyphMask[] | null = null;

/** Write `out/screenshots/<name>.png` when `SNAPSHOTS=1`; returns its path, or null when off. */
export function snapshot(game: HeadlessGame, name: string, view: SnapshotView = {}): string | null {
  if (!snapshotsOn()) return null;
  masks ??= gameGlyphMasks(new Uint8Array(readFileSync(resolve(FONT))), game.registry);
  const readers = game.world.readers;
  const wagon = game.arrival?.wagon;
  const map = readers.map;
  const v = viewAround(
    readers,
    view.x ?? wagon?.x ?? Math.floor(map.w / 2),
    view.y ?? wagon?.y ?? Math.floor(map.h / 2),
    view.z ?? wagon?.z ?? Math.floor(map.d / 2),
    view.cols ?? 48,
    view.rows ?? 24,
  );
  const png = mapPicture(readers, game.registry, v, masks, (data) => deflateSync(data, { level: 9 }), view.scale ?? 2);
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const file = join(SNAPSHOT_DIR, `${name.replace(/[^A-Za-z0-9_.-]+/g, '-')}.png`);
  writeFileSync(file, png);
  return file;
}
