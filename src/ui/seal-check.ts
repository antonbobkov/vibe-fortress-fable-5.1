/**
 * Whether a placement seals dwarves away from home (24 § Input model, the build tool): the tiles a
 * placement's finished building would block, with those of every blocking building still planned
 * or under construction, are taken out of 22's walker graph, and the dwarves who reach home now
 * (the hearth, else the wagon) and would reach it no more are the sealed ones. It does not refuse
 * the placement: the player may mean it. Read-only: every reader it calls is a pure query.
 */
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { ReaderSet } from '@core/readers';
import type { EntityId, TileIndex } from '@core/types';
import { CONSTRUCTION_KIND, type BuildingRow, type BuildingsReader } from '@systems/buildings';
import type { DwarvesReader } from '@systems/dwarves';

/** The dwarves a placement seals from home, and which home: the hall (its hearth) or the wagon. */
export interface Sealed {
  readonly ids: readonly EntityId[];
  readonly home: 'hall' | 'wagon';
}

/**
 * The tiles of `footprint` a finished building of `row` blocks for walkers: every tile of a wall or
 * a fortification, or of a building that is not passable, and the `impassableTiles` of one that
 * is. A door, a hatch, a bridge or a floodgate is never counted: it opens.
 */
export function blockedTiles(row: BuildingRow, footprint: readonly TileIndex[]): TileIndex[] {
  if (row.category === 'construction') {
    const kind = CONSTRUCTION_KIND[row.id];
    return kind === TileKind.Wall || kind === TileKind.Fortification ? footprint.slice() : [];
  }
  if (row.passable === false) return footprint.slice();
  const some = row.impassableTiles ?? [];
  return footprint.filter((_, k) => some.includes(k));
}

/**
 * The dwarves `placed` would seal from home once built, ascending; null when it seals none, or when
 * there is no home, no pathing or no dwarf to ask.
 */
export function sealedBy(readers: ReaderSet, placed: readonly TileIndex[]): Sealed | null {
  if (placed.length === 0 || !readers.has('pathing') || !readers.has('14') || !readers.has('10')) return null;
  const buildings = readers.of<BuildingsReader>('14');
  const pathing = readers.pathing;
  const map = readers.map;
  const hearth = buildings.hearth();
  const homeId = hearth !== 0 ? hearth : buildings.wagon();
  const home = homeId === 0 ? undefined : buildings.get(homeId);
  if (home === undefined) return null;
  // Every blocking building not yet built stands with this one.
  const blocked = new Set<TileIndex>(placed);
  for (const row of buildings.types()) {
    if (blockedTiles(row, [0]).length === 0 && (row.impassableTiles ?? []).length === 0) continue;
    for (const id of buildings.byType(row.id)) {
      const b = buildings.get(id);
      if (b === undefined || b.state === 'built' || b.state === 'ruined') continue;
      for (const t of blockedTiles(row, b.footprint)) blocked.add(t);
    }
  }
  // Home's walkable tiles: its own footprint's and those beside it on its level.
  const starts = new Set<TileIndex>();
  for (const t of home.footprint) {
    const { x, y, z } = map.unpack(t);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!map.inBounds(x + dx, y + dy, z)) continue;
        const n = map.index(x + dx, y + dy, z);
        if (!blocked.has(n) && pathing.passable(n, 'walker')) starts.add(n);
      }
    }
  }
  const homeLabels = new Set(Array.from(starts, (t) => pathing.labelOf(t, 'walker')).filter((l) => l !== 0));
  // The dwarves who reach home now: where each stands, or, on a tile the building will block, the tiles beside it.
  const waiting = new Map<EntityId, TileIndex[]>();
  for (const id of readers.of<DwarvesReader>('10').list()) {
    const p = readers.entities.get(id, C.Position);
    if (p === undefined) continue;
    const at = map.index(p.x, p.y, p.z);
    if (!homeLabels.has(pathing.labelOf(at, 'walker'))) continue;
    waiting.set(id, blocked.has(at) ? besides(readers, at, blocked) : [at]);
  }
  if (waiting.size === 0) return null;
  const want = new Map<TileIndex, EntityId[]>();
  for (const [id, tiles] of waiting) for (const t of tiles) want.set(t, [...want.get(t) ?? [], id]);
  // Flood home's side of the graph without the blocked tiles, until every dwarf is met.
  const seen = new Set<TileIndex>(starts);
  const queue: TileIndex[] = Array.from(starts);
  const meet = (t: TileIndex): void => {
    for (const id of want.get(t) ?? []) waiting.delete(id);
  };
  for (const t of queue) meet(t);
  for (let k = 0; k < queue.length && waiting.size > 0; k += 1) {
    const from = queue[k] as TileIndex;
    for (const [to] of pathing.edges(from, 'walker')) {
      if (seen.has(to) || blocked.has(to) || cutsCorner(readers, from, to, blocked)) continue;
      seen.add(to);
      queue.push(to);
      meet(to);
    }
  }
  if (waiting.size === 0) return null;
  return { ids: Array.from(waiting.keys()).sort((a, b) => a - b), home: hearth !== 0 ? 'hall' : 'wagon' };
}

/** The walkable tiles beside `at` on its level that no blocked tile covers. */
function besides(readers: ReaderSet, at: TileIndex, blocked: ReadonlySet<TileIndex>): TileIndex[] {
  const map = readers.map;
  const { x, y, z } = map.unpack(at);
  const out: TileIndex[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if ((dx === 0 && dy === 0) || !map.inBounds(x + dx, y + dy, z)) continue;
      const n = map.index(x + dx, y + dy, z);
      if (!blocked.has(n) && readers.pathing.passable(n, 'walker')) out.push(n);
    }
  }
  return out;
}

/** A diagonal step on one level past a corner the placement blocks (22 § Movement: no corner is cut). */
function cutsCorner(readers: ReaderSet, from: TileIndex, to: TileIndex, blocked: ReadonlySet<TileIndex>): boolean {
  const map = readers.map;
  const a = map.unpack(from);
  const b = map.unpack(to);
  if (a.z !== b.z || a.x === b.x || a.y === b.y) return false;
  return blocked.has(map.index(b.x, a.y, a.z)) || blocked.has(map.index(a.x, b.y, a.z));
}
