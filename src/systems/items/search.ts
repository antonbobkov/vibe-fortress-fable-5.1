/**
 * Item search: `02-systems/13-items-and-storage.md` § Searching and
 * `algorithms/jobs-and-hauling.md` § Item search.
 *
 * ```
 * findItem(filter, from, cls, opts):
 *   fromLabel = pathing.label(from, cls)
 *   for r in [4, 8, 16, 32, FIND_RADIUS_MAX]:
 *     best = none
 *     for it in spatial.inRadius(from, r, kind=item) (ascending id): if not match(it, filter): continue
 *        if opts.reservable and (flags & (Forbidden|Reserved|Owned|AtDepot)): continue
 *        t = tileOf(it) (container's tile if inside one); if pathing.label(t, cls) != fromLabel: continue
 *        d = chebyshev(from, t) + |dz|*Z_DISTANCE_WEIGHT; if d < bestD: best = it
 *     if best: return best
 *   // fallback through the stock index
 *   for it in counts[filter.type].instances (stockpiles first): same checks; return first
 *   return 0
 * ```
 *
 * "including containers, whose contents are matched": a container found in the radius offers its
 * contents too. The stock index fallback walks every item of the fortress in id order, items in a
 * stockpile first (13 keeps no per-type instance list; the order is the documented one).
 */

import { C, ItemFlag, type Item } from '@core/components';
import type { EntityReader, PathingReader, SpatialReader } from '@core/readers';
import type { EntityId, MovementClass, TileIndex } from '@core/types';
import type { ItemCore } from './api';
import { FIND_RADII } from './constants';
import { categoryUnder } from './facts';
// Tiles of horizontal distance one z-level counts as: 11's `Z_DISTANCE_WEIGHT`, which the algorithm uses.
import { Z_DISTANCE_WEIGHT } from '@systems/jobs/constants';

/** `schemas/system-state.md` `ItemFilter`, plus `types` (any of several item types; T-M2-05). */
export interface ItemFilter {
  type?: number;
  /** Any of these item types (a building input's alternatives, D-012). */
  types?: readonly number[];
  /** Exactly this item (a haul job's input; D-072). */
  itemId?: EntityId;
  category?: string;
  tag?: string;
  materialClass?: string;
  materialId?: number;
  minQuality?: number;
  edible?: boolean;
  drinkable?: boolean;
  /** An empty container of this class. */
  emptyContainer?: string;
  excludeIds?: readonly EntityId[];
}

export interface SearchOptions {
  /** Skip forbidden, reserved, owned and depot items (`{ reservable: true }`). */
  readonly reservable?: boolean;
}

const UNRESERVABLE = ItemFlag.Forbidden | ItemFlag.Reserved | ItemFlag.Owned | ItemFlag.AtDepot;

export interface SearchHost {
  readonly core: ItemCore;
  readonly entities: EntityReader;
  spatial(): SpatialReader | null;
  pathing(): PathingReader | null;
  /** The stockpile a tile belongs to, 0 when none (T-M2-03). */
  stockpileAt(i: TileIndex): EntityId;
}

/** `match(it, filter)`: type, category, tag, material, quality, edible, drinkable, empty container. */
export function matches(core: ItemCore, id: EntityId, it: Item, filter: ItemFilter): boolean {
  const facts = core.host.facts;
  if (filter.excludeIds !== undefined && filter.excludeIds.includes(id)) return false;
  if (filter.itemId !== undefined && id !== filter.itemId) return false;
  if (filter.type !== undefined && it.type !== filter.type) return false;
  if (filter.types !== undefined && !filter.types.includes(it.type)) return false;
  const row = facts.types[it.type];
  if (row === undefined) return false;
  if (filter.category !== undefined && !categoryUnder(row.category, filter.category)) return false;
  if (filter.tag !== undefined && !facts.hasTag(it.type, filter.tag)) return false;
  if (filter.materialClass !== undefined && facts.materialClass(it.material) !== filter.materialClass) return false;
  if (filter.materialId !== undefined && it.material !== filter.materialId) return false;
  if (filter.minQuality !== undefined && (!row.quality || it.quality < filter.minQuality)) return false;
  if (filter.edible !== undefined && (row.edible === true) !== filter.edible) return false;
  if (filter.drinkable !== undefined && (row.drinkable === true) !== filter.drinkable) return false;
  if (filter.emptyContainer !== undefined) {
    const c = core.container(id);
    if (c === undefined || c.classId !== filter.emptyContainer || c.contents.length > 0) return false;
  }
  return true;
}

/** Whether a search may take the item at all: carried items and those inside carried containers are out. */
function inReach(core: ItemCore, it: Item): boolean {
  if (it.carriedBy !== 0) return false;
  if (it.containerId !== 0) {
    const c = core.get(it.containerId);
    if (c === undefined || c.carriedBy !== 0) return false;
  }
  return true;
}

function distance(core: ItemCore, from: TileIndex, to: TileIndex): number {
  const map = core.host.map;
  const dx = Math.abs(map.xOf(from) - map.xOf(to));
  const dy = Math.abs(map.yOf(from) - map.yOf(to));
  const dz = Math.abs(map.zOf(from) - map.zOf(to));
  return Math.max(dx, dy) + dz * Z_DISTANCE_WEIGHT;
}

export class ItemSearch {
  constructor(private readonly host: SearchHost) {}

  private acceptable(id: EntityId, filter: ItemFilter, opts: SearchOptions, fromLabel: number, cls: MovementClass): TileIndex {
    const core = this.host.core;
    const it = core.get(id);
    if (it === undefined || !inReach(core, it)) return -1;
    if (!matches(core, id, it, filter)) return -1;
    if (opts.reservable === true && (it.flags & UNRESERVABLE) !== 0) return -1;
    if (it.containerId !== 0 && opts.reservable === true && core.hasFlag(it.containerId, ItemFlag.Forbidden)) return -1;
    const t = core.tileOf(id);
    if (t < 0) return -1;
    const pathing = this.host.pathing();
    if (pathing !== null && (fromLabel === 0 || pathing.labelOf(t, cls) !== fromLabel)) return -1;
    return t;
  }

  /** The candidates around a set of item ids: each item and, for a container, its contents. */
  private expand(ids: readonly EntityId[]): EntityId[] {
    const core = this.host.core;
    const out: EntityId[] = [];
    for (const id of ids) {
      if (!core.isItem(id)) continue;
      out.push(id);
      const c = core.container(id);
      if (c !== undefined) for (const inner of c.contents) out.push(inner);
    }
    return out.sort((a, b) => a - b);
  }

  /** `items.findItem(filter, fromTile, movementClass, opts)`: the nearest match, or 0. */
  findItem(filter: ItemFilter, from: TileIndex, cls: MovementClass = 'walker', opts: SearchOptions = { reservable: true }): EntityId {
    const core = this.host.core;
    if (!core.host.map.validIndex(from)) return 0;
    const pathing = this.host.pathing();
    const fromLabel = pathing === null ? 1 : pathing.labelOf(from, cls);
    if (filter.itemId !== undefined) return this.acceptable(filter.itemId, filter, opts, fromLabel, cls) >= 0 ? filter.itemId : 0;
    const spatial = this.host.spatial();
    if (spatial !== null) {
      for (const r of FIND_RADII) {
        let best: EntityId = 0;
        let bestD = Number.POSITIVE_INFINITY;
        for (const id of this.expand(spatial.inRadiusWhere(from, r, (e) => core.isItem(e)))) {
          const t = this.acceptable(id, filter, opts, fromLabel, cls);
          if (t < 0) continue;
          const d = distance(core, from, t);
          if (d < bestD) {
            bestD = d;
            best = id;
          }
        }
        if (best !== 0) return best;
      }
    }
    // The stock index: items in stockpiles first, then the rest, each in id order.
    const all = this.host.entities.with(C.Item);
    const inPile: EntityId[] = [];
    const rest: EntityId[] = [];
    for (const id of all) {
      const t = core.tileOf(id);
      (t >= 0 && this.host.stockpileAt(t) !== 0 ? inPile : rest).push(id);
    }
    for (const id of [...inPile, ...rest]) {
      if (this.acceptable(id, filter, opts, fromLabel, cls) >= 0) return id;
    }
    return 0;
  }

  /** `items.findItems(filter, count, fromTile, movementClass)`: `findItem` repeated with `excludeIds`. */
  findItems(filter: ItemFilter, count: number, from: TileIndex, cls: MovementClass = 'walker', opts: SearchOptions = { reservable: true }): EntityId[] {
    const found: EntityId[] = [];
    const exclude = [...(filter.excludeIds ?? [])];
    while (found.length < count) {
      const id = this.findItem({ ...filter, excludeIds: exclude }, from, cls, opts);
      if (id === 0) break;
      found.push(id);
      exclude.push(id);
    }
    return found;
  }

  /**
   * `items.countAvailable(filter)`: units of matching items that are not forbidden, reserved or
   * owned. A filter of one type reads the stock counts; any other filter counts the items.
   */
  countAvailable(filter: ItemFilter): number {
    const core = this.host.core;
    const keys = Object.keys(filter).filter((k) => (filter as Record<string, unknown>)[k] !== undefined);
    if (keys.length === 1 && filter.type !== undefined) return core.counts.available(filter.type);
    let n = 0;
    for (const id of this.host.entities.with(C.Item)) {
      const it = core.item(id);
      if ((it.flags & (ItemFlag.Forbidden | ItemFlag.Reserved | ItemFlag.Owned | ItemFlag.Merchant)) !== 0) continue;
      if (matches(core, id, it, filter)) n += it.count;
    }
    return n;
  }

  /** Units of matching items of any state (the `no_tool` shim of D-070 asks whether any exist). */
  countAll(filter: ItemFilter): number {
    const core = this.host.core;
    let n = 0;
    for (const id of this.host.entities.with(C.Item)) {
      const it = core.item(id);
      if ((it.flags & ItemFlag.Merchant) !== 0) continue;
      if (matches(core, id, it, filter)) n += it.count;
    }
    return n;
  }
}
