/**
 * The last overlays of `23-rendering.md` § Compositor step 8: `jobs` ("highlights target tiles of
 * claimed jobs and draws the worker's path") and the three debug overlays it names
 * (`connectivity`, `paths`, `chunks`). The overlay menu lists the overlays the compositor draws
 * (D-103), so the panel of `ui-screens/panels.md` § Overlays needs them (T-M7-08).
 *
 * The document names the debug overlays without saying what they draw; D-199 records the reading:
 * every one alters `bg` only (step 8: "Overlays alter `bg` or replace the glyph but never hide a
 * creature") through `blend(…, ZONE_TINT_ALPHA)`, with colours named from the palette table.
 *
 * Each frame builds its tile sets once, from the movers and the claimed jobs, never per cell.
 */

import { C } from '@core/components';
import { CHUNK_SIZE } from '@core/constants';
import type { ReaderSet } from '@core/readers';
import type { EntityId, MovementClass, TileIndex } from '@core/types';
import type { DwarvesReader } from '@systems/dwarves';
import type { JobsReader } from '@systems/jobs';
import type { Cell } from './cellbuffer';
import { ZONE_TINT_ALPHA } from './constants';
import { blend, type Palette, type Rgb } from './palette';

/** `23` § Compositor step 8: `jobs`. */
export const OVERLAY_JOBS = 'jobs';
/** § Compositor step 8: "debug: `connectivity`, `paths`, `chunks`". */
export const OVERLAY_CONNECTIVITY = 'connectivity';
export const OVERLAY_PATHS = 'paths';
export const OVERLAY_CHUNKS = 'chunks';

/** The palette rows each overlay tints with (D-199). */
export const DEBUG_OVERLAY_COLORS = Object.freeze({
  jobTarget: 'alert',
  jobPath: 'text_value',
  path: 'text_value',
  chunk: 'panel_border',
});

/**
 * The connectivity tint cycle: base-16 rows, so two labels that meet differ in colour (D-199).
 * Label 0 (no component: an impassable tile) is not tinted.
 */
/** The movement class the connectivity overlay labels with: the dwarves' own (D-199). */
export const CONNECTIVITY_CLASS: MovementClass = 'walker';

export const CONNECTIVITY_COLORS: readonly string[] = [
  'blue', 'green', 'magenta', 'yellow', 'cyan', 'red', 'brown', 'white',
];

export class DebugOverlayLayers {
  private readonly jobTarget: Rgb;
  private readonly jobPath: Rgb;
  private readonly path: Rgb;
  private readonly chunk: Rgb;
  private readonly labelColors: readonly Rgb[];

  /** Target tiles of claimed jobs, and the tiles of their workers' paths. */
  private readonly targets = new Set<TileIndex>();
  private readonly jobPaths = new Set<TileIndex>();
  /** Every live mover's remaining route (`paths`). */
  private readonly paths = new Set<TileIndex>();
  private readers: ReaderSet | null = null;

  constructor(palette: Palette) {
    this.jobTarget = palette.color(DEBUG_OVERLAY_COLORS.jobTarget);
    this.jobPath = palette.color(DEBUG_OVERLAY_COLORS.jobPath);
    this.path = palette.color(DEBUG_OVERLAY_COLORS.path);
    this.chunk = palette.color(DEBUG_OVERLAY_COLORS.chunk);
    this.labelColors = CONNECTIVITY_COLORS.map((id) => palette.color(id));
  }

  /** Build the frame's tile sets, once, for the overlays that are on. */
  beginFrame(readers: ReaderSet, overlays: readonly string[]): void {
    this.readers = readers;
    this.targets.clear();
    this.jobPaths.clear();
    this.paths.clear();
    const jobs = overlays.includes(OVERLAY_JOBS);
    const paths = overlays.includes(OVERLAY_PATHS);
    if (!jobs && !paths) return;
    if (jobs && readers.has('10') && readers.has('11')) this.indexJobs(readers);
    if (paths) this.indexPaths(readers);
  }

  /**
   * One pass over the dwarves: each worker's claimed job contributes its target tile and its
   * route. A claimed job always has a worker, so the workers are exactly the claimed jobs.
   */
  private indexJobs(readers: ReaderSet): void {
    const board = readers.of<JobsReader>('11');
    for (const id of readers.of<DwarvesReader>('10').list()) {
      const job = board.forWorker(id);
      if (job === undefined) continue;
      const target = jobTargetTile(readers, job);
      if (target !== null) this.targets.add(target);
      for (const tile of this.routeOf(readers, id)) this.jobPaths.add(tile);
    }
  }

  /** One pass over the movers: every remaining route tile. */
  private indexPaths(readers: ReaderSet): void {
    for (const id of readers.entities.with(C.Motion)) {
      for (const tile of this.routeOf(readers, id)) this.paths.add(tile);
    }
  }

  /** The tiles left of a mover's path, from its current step on. */
  private routeOf(readers: ReaderSet, id: EntityId): readonly TileIndex[] {
    const motion = readers.entities.get(id, C.Motion);
    if (motion === undefined || motion.pathId === 0) return [];
    if (!readers.has('pathing')) return [];
    const result = readers.pathing.pathResult(motion.pathId);
    if (result.state !== 'ready') return [];
    return motion.stepIndex <= 0 ? result.path : result.path.slice(motion.stepIndex);
  }

  /** `jobs`: the claimed job's target tile, then the worker's route. */
  jobsOver(cell: Cell, i: TileIndex): Cell {
    if (this.targets.has(i)) return { ...cell, bg: blend(cell.bg, this.jobTarget, ZONE_TINT_ALPHA) };
    if (this.jobPaths.has(i)) return { ...cell, bg: blend(cell.bg, this.jobPath, ZONE_TINT_ALPHA) };
    return cell;
  }

  /** `paths` (debug): every mover's remaining route. */
  pathsOver(cell: Cell, i: TileIndex): Cell {
    return this.paths.has(i) ? { ...cell, bg: blend(cell.bg, this.path, ZONE_TINT_ALPHA) } : cell;
  }

  /** `connectivity` (debug): the walker label of the tile, as a colour from the cycle. */
  connectivityOver(cell: Cell, i: TileIndex): Cell {
    const readers = this.readers;
    if (readers === null || !readers.has('pathing')) return cell;
    const label = readers.pathing.labelOf(i, CONNECTIVITY_CLASS);
    if (label === 0) return cell;
    const tint = this.labelColors[(label - 1) % this.labelColors.length] as Rgb;
    return { ...cell, bg: blend(cell.bg, tint, ZONE_TINT_ALPHA) };
  }

  /** `chunks` (debug): the cells on a chunk's own edge, which draws the chunk grid. */
  chunksOver(cell: Cell, x: number, y: number): Cell {
    const onEdge = x % CHUNK_SIZE === 0 || y % CHUNK_SIZE === 0;
    return onEdge ? { ...cell, bg: blend(cell.bg, this.chunk, ZONE_TINT_ALPHA) } : cell;
  }
}

/** The tile a job points at: its own, its anchor, or its target entity's position. */
export function jobTargetTile(readers: ReaderSet, job: { target: { kind: string; ref: number }; data: Record<string, unknown> }): TileIndex | null {
  if (job.target.kind === 'tile') return job.target.ref;
  const anchor = job.data['anchorTile'];
  if (typeof anchor === 'number') return anchor;
  const p = readers.entities.get(job.target.ref as EntityId, C.Position);
  return p === undefined ? null : readers.map.index(p.x, p.y, p.z);
}
