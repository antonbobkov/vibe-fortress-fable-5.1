/**
 * 03's commands: `04-implementation/command-catalog.md` rows `Designate`, `UndoDesignation`,
 * `SetDesignationPriority`, `SetTraffic`, `DesignateStairwell`, `ConfirmDeepsilver`, and
 * `02-systems/03-terrain-and-mining.md` § Interfaces › Commands, § Restricted traffic.
 *
 * A command is validated as a whole before anything changes, so a rejected command changes nothing
 * (`simulation-core.md` § Commands). `UndoDesignation` is the one command the catalog applies in
 * part ("has_progress otherwise, partial"; docs/02-systems/03-terrain-and-mining.md § Designations).
 */

import { OK, reject, type Command, type CommandResult } from '@core/commands';
import { PRIORITY_DEFAULT, PRIORITY_MAX, PRIORITY_MIN } from '@core/constants';
import { Designation, TileFlag, type Map3D } from '@core/map3d';
import type { FortressState } from '@core/components';
import type { TileIndex } from '@core/types';
import type { TerrainCore } from './api';
import { DESIGNATION_NAMES, TERRAIN_DESIGNATIONS, precondition } from './rules/transitions';

/** The traffic modes of `SetTraffic`. */
export type TrafficMode = 'normal' | 'restricted' | 'forbidden';

/** A designation kind given as the `Designation` number or its name (`dig`, `stairs_up`, …). */
export function designationOf(raw: unknown): Designation | null {
  if (typeof raw === 'number' && Number.isInteger(raw)) {
    return TERRAIN_DESIGNATIONS.includes(raw as Designation) || raw === Designation.Harvest ? (raw as Designation) : null;
  }
  if (typeof raw === 'string') return DESIGNATION_NAMES[raw] ?? null;
  return null;
}

function tilesOf(map: Map3D, raw: unknown): TileIndex[] | 'bad' {
  if (!Array.isArray(raw)) return 'bad';
  const out: TileIndex[] = [];
  for (const t of raw) {
    if (typeof t !== 'number' || !map.validIndex(t)) return 'bad';
    out.push(t);
  }
  return out;
}

function priorityOf(raw: unknown): number | null {
  if (raw === undefined) return PRIORITY_DEFAULT;
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < PRIORITY_MIN || raw > PRIORITY_MAX) return null;
  return raw;
}

/** What the command handlers need besides the core. */
export interface CommandHost {
  readonly core: TerrainCore;
  readonly fortress: FortressState;
  /** The progress (`Fixed`) of the job carrying a designation, 0 when none. */
  progressOf(tile: TileIndex): number;
}

/**
 * Validation shared by `Designate` and `DesignateStairwell`: "each tile in bounds; kind
 * precondition per 03's transition table for tiles that are discovered (undiscovered tiles
 * accepted blind); `deepsilver_unconfirmed` if any tile is known deepsilver and
 * `deepsilverConfirmed` is false". Every discovered tile must pass (D-052).
 */
function validateDesignations(host: CommandHost, items: readonly { tile: TileIndex; kind: Designation }[]): CommandResult {
  const map = host.core.host.map;
  const facts = host.core.host.facts;
  for (const { tile, kind } of items) {
    if (!TERRAIN_DESIGNATIONS.includes(kind)) return reject('precondition_failed');
    if (!map.hasFlag(tile, TileFlag.Discovered)) continue;
    if (!precondition(map, tile, kind, facts)) return reject('precondition_failed');
  }
  if (!host.fortress.deepsilverConfirmed) {
    for (const { tile } of items) {
      if (map.hasFlag(tile, TileFlag.Discovered) && facts.isDeepsilver(map.materialAt(tile))) {
        return reject('deepsilver_unconfirmed');
      }
    }
  }
  return OK;
}

export function applyDesignate(host: CommandHost, cmd: Command): CommandResult {
  const map = host.core.host.map;
  const tiles = tilesOf(map, cmd['tiles']);
  if (tiles === 'bad') return reject('out_of_bounds');
  const kind = designationOf(cmd['kind']);
  if (kind === null) return reject('precondition_failed');
  const priority = priorityOf(cmd['priority']);
  if (priority === null) return reject('out_of_range');
  const items = tiles.map((tile) => ({ tile, kind }));
  const ok = validateDesignations(host, items);
  if (!ok.ok) return ok;
  for (const tile of tiles) host.core.setDesignation(tile, kind, priority);
  return OK;
}

/**
 * `DesignateStairwell { x, y, zTop, zBottom }`: "expands to `stairs_updown` on intermediate levels,
 * `stairs_down` at top, `stairs_up` at bottom"; validated as `Designate`.
 */
export function stairwellTiles(map: Map3D, x: number, y: number, zTop: number, zBottom: number): { tile: TileIndex; kind: Designation }[] {
  const out: { tile: TileIndex; kind: Designation }[] = [];
  for (let z = zTop; z >= zBottom; z -= 1) {
    const kind = z === zTop ? Designation.StairsDown : z === zBottom ? Designation.StairsUp : Designation.StairsUpDown;
    out.push({ tile: map.index(x, y, z), kind });
  }
  return out;
}

export function applyStairwell(host: CommandHost, cmd: Command): CommandResult {
  const map = host.core.host.map;
  const x = cmd['x'];
  const y = cmd['y'];
  const zTop = cmd['zTop'];
  const zBottom = cmd['zBottom'];
  if (typeof x !== 'number' || typeof y !== 'number' || typeof zTop !== 'number' || typeof zBottom !== 'number') {
    return reject('out_of_bounds');
  }
  if (![x, y, zTop, zBottom].every(Number.isInteger) ||
      !map.inBounds(x, y, zTop) || !map.inBounds(x, y, zBottom)) return reject('out_of_bounds');
  if (!(zTop > zBottom)) return reject('precondition_failed');
  const priority = priorityOf(cmd['priority']);
  if (priority === null) return reject('out_of_range');
  const items = stairwellTiles(map, x, y, zTop, zBottom);
  const ok = validateDesignations(host, items);
  if (!ok.ok) return ok;
  for (const { tile, kind } of items) host.core.setDesignation(tile, kind, priority);
  return OK;
}

/**
 * `UndoDesignation { tiles }`: "tiles have designations without progress (`has_progress`
 * otherwise, partial)". Tiles without progress are cleared; tiles whose job has progress are kept
 * and the result is `has_progress` (D-052).
 */
export function applyUndo(host: CommandHost, cmd: Command): CommandResult {
  const map = host.core.host.map;
  const tiles = tilesOf(map, cmd['tiles']);
  if (tiles === 'bad') return reject('out_of_bounds');
  let kept = 0;
  for (const tile of tiles) {
    if (map.designationAt(tile) === Designation.None) continue;
    if (host.progressOf(tile) > 0) {
      kept += 1;
      continue;
    }
    host.core.clearDesignation(tile);
  }
  return kept > 0 ? reject('has_progress') : OK;
}

/** `SetDesignationPriority { tiles, priority }`: "designations exist". */
export function applyPriority(host: CommandHost, cmd: Command): CommandResult {
  const map = host.core.host.map;
  const tiles = tilesOf(map, cmd['tiles']);
  if (tiles === 'bad') return reject('out_of_bounds');
  const priority = priorityOf(cmd['priority']);
  if (priority === null || cmd['priority'] === undefined) return reject('out_of_range');
  for (const tile of tiles) if (map.designationAt(tile) === Designation.None) return reject('not_found');
  for (const tile of tiles) host.core.setDesignation(tile, map.designationAt(tile), priority);
  return OK;
}

/**
 * `SetTraffic { tiles, mode }`: "sets the `restricted` flag (forbidden is restricted plus a stored
 * per-tile mark in the terrain state making it impassable for dwarves; 22 reads both)".
 */
export function applyTraffic(host: CommandHost, cmd: Command): CommandResult {
  const map = host.core.host.map;
  const tiles = tilesOf(map, cmd['tiles']);
  if (tiles === 'bad') return reject('out_of_bounds');
  const mode = cmd['mode'];
  if (mode !== 'normal' && mode !== 'restricted' && mode !== 'forbidden') return reject('precondition_failed');
  for (const tile of tiles) {
    host.core.setFlag(tile, TileFlag.Restricted, mode !== 'normal');
    if (host.core.setForbidden(tile, mode === 'forbidden')) host.core.markChanged(tile);
  }
  return OK;
}

/** `ConfirmDeepsilver`: "sets `deepsilverConfirmed`". */
export function applyConfirmDeepsilver(host: CommandHost): CommandResult {
  host.fortress.deepsilverConfirmed = true;
  return OK;
}
