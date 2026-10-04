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
  /** One of several materials (for a flux-tagged stone input). */
  materialIds?: readonly number[];
  minQuality?: number;
  edible?: boolean;
  drinkable?: boolean;
  /** An empty container of this class. */
  emptyContainer?: string;
  excludeIds?: readonly EntityId[];
  /** Item flags that must all be present (12's marked-for-melting input). */
  requiredFlags?: number;
}

export interface SearchOptions {
  /** Skip forbidden, reserved, owned and depot items (`{ reservable: true }`). */
  readonly reservable?: boolean;
  /** Require an item in a container of this class, located in a stockpile. */
  readonly stockpiledContainerClass?: string;
}

const UNRESERVABLE = ItemFlag.Forbidden | ItemFlag.Reserved | ItemFlag.Owned | ItemFlag.AtDepot | ItemFlag.Merchant | ItemFlag.Installed;

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
  if (filter.requiredFlags !== undefined && (it.flags & filter.requiredFlags) !== filter.requiredFlags) return false;
  if (filter.type !== undefined && it.type !== filter.type) return false;
  if (filter.types !== undefined && !filter.types.includes(it.type)) return false;
  const row = facts.types[it.type];
  if (row === undefined) return false;
  if (filter.category !== undefined && !categoryUnder(row.category, filter.category)) return false;
  if (filter.tag !== undefined && !facts.hasTag(it.type, filter.tag)) return false;
  if (filter.materialClass !== undefined && facts.materialClass(it.material) !== filter.materialClass) return false;
  if (filter.materialId !== undefined && it.material !== filter.materialId) return false;
  if (filter.materialIds !== undefined && !filter.materialIds.includes(it.material)) return false;
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
    // A building's own container (the wagon) stands where it is (D-074).
    if (c === undefined) return core.container(it.containerId) !== undefined;
    if (c.carriedBy !== 0) return false;
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
  private readonly typeFilters = new Map<string, number[]>();
  constructor(private readonly host: SearchHost) {}

  private acceptable(id: EntityId, filter: ItemFilter, opts: SearchOptions, fromLabel: number, cls: MovementClass): TileIndex {
    const core = this.host.core;
    const it = core.get(id);
    if (it === undefined || !inReach(core, it)) return -1;
    if (opts.reservable === true && (it.flags & UNRESERVABLE) !== 0) return -1;
    if (it.containerId !== 0 && opts.reservable === true && core.hasFlag(it.containerId, ItemFlag.Forbidden)) return -1;
    if (opts.stockpiledContainerClass !== undefined && core.container(it.containerId)?.classId !== opts.stockpiledContainerClass) return -1;
    const t = core.tileOf(id);
    if (t < 0) return -1;
    if (opts.stockpiledContainerClass !== undefined && this.host.stockpileAt(t) === 0) return -1;
    const pathing = this.host.pathing();
    if (pathing !== null && (fromLabel === 0 || pathing.labelOf(t, cls) !== fromLabel)) return -1;
    if (!matches(core, id, it, filter)) return -1;
    return t;
  }

  /** Filter content types once before visiting stock instances (not every spatial entity). */
  private candidateTypes(filter: ItemFilter): number[] {
    const key = JSON.stringify([filter.type, filter.types, filter.category, filter.tag, filter.edible, filter.drinkable, filter.emptyContainer]);
    const cached = this.typeFilters.get(key);
    if (cached !== undefined) return cached;
    const facts = this.host.core.host.facts;
    const types: number[] = [];
    for (let type = 1; type <= facts.typeCount; type += 1) {
      const row = facts.row(type);
      if (filter.type !== undefined && type !== filter.type) continue;
      if (filter.types !== undefined && !filter.types.includes(type)) continue;
      if (filter.category !== undefined && !categoryUnder(row.category, filter.category)) continue;
      if (filter.tag !== undefined && !facts.hasTag(type, filter.tag)) continue;
      if (filter.edible !== undefined && (row.edible === true) !== filter.edible) continue;
      if (filter.drinkable !== undefined && (row.drinkable === true) !== filter.drinkable) continue;
      if (filter.emptyContainer !== undefined && facts.containerClassOf(type) !== filter.emptyContainer) continue;
      types.push(type);
    }
    this.typeFilters.set(key, types);
    return types;
  }

  /** `items.findItem(filter, fromTile, movementClass, opts)`: the nearest match, or 0. */
  findItem(filter: ItemFilter, from: TileIndex, cls: MovementClass = 'walker', opts: SearchOptions = { reservable: true }): EntityId {
    const core = this.host.core;
    if (!core.host.map.validIndex(from)) return 0;
    const pathing = this.host.pathing();
    const fromLabel = pathing === null ? 1 : pathing.labelOf(from, cls);
    // Every candidate would fail the same connectivity precheck, including the stock fallback.
    if (pathing !== null && fromLabel === 0) return 0;
    if (filter.itemId !== undefined) return this.acceptable(filter.itemId, filter, opts, fromLabel, cls) >= 0 ? filter.itemId : 0;
    const types = this.candidateTypes(filter);
    if (!core.hasTypes(types)) return 0;
    const contained = opts.stockpiledContainerClass === undefined ? undefined : core.containedItems(opts.stockpiledContainerClass, types);
    if (contained?.length === 0) return 0;
    const spatial = this.host.spatial();
    const rejected = new Set<EntityId>();
    if (spatial !== null && contained === undefined) {
      for (const r of FIND_RADII) {
        const candidates = core.radiusItems(types, from, r);
        let best = 0;
        let bestD = Number.POSITIVE_INFINITY;
        for (const id of candidates) {
          if (rejected.has(id)) continue;
          const t = this.acceptable(id, filter, opts, fromLabel, cls);
          if (t < 0) { rejected.add(id); continue; }
          const d = distance(core, from, t);
          if (d < bestD) { best = id; bestD = d; }
        }
        if (best !== 0) return best;
      }
    } else if (spatial !== null && contained !== undefined) {
      let best = 0;
      let bestRing = Number.POSITIVE_INFINITY;
      let bestD = Number.POSITIVE_INFINITY;
      const map = core.host.map;
      for (const id of contained) {
        const t = this.acceptable(id, filter, opts, fromLabel, cls);
        if (t < 0) continue;
        // The old spatial expansion offers ground items and one level of an item container's
        // contents. Building containers (wagon) participate only in the stock fallback.
        const item = core.item(id);
        const holder = core.host.entities.has(id, C.Position) ? id : item.containerId;
        if (!core.isItem(holder) || (holder !== id && !core.container(holder)?.contents.includes(id))) continue;
        const pos = core.host.entities.get(holder, C.Position);
        if (pos === undefined || !map.inBounds(pos.x, pos.y, pos.z)) continue;
        const radius = Math.max(Math.abs(map.xOf(from) - pos.x), Math.abs(map.yOf(from) - pos.y), Math.abs(map.zOf(from) - pos.z));
        const ring = FIND_RADII.findIndex((r) => radius <= r);
        if (ring < 0) continue;
        const d = distance(core, from, t);
        if (ring < bestRing || (ring === bestRing && (d < bestD || (d === bestD && id < best)))) {
          best = id; bestRing = ring; bestD = d;
        }
      }
      if (best !== 0) return best;
    }
    // The stock index: items in stockpiles first, then the rest, each in id order.
    const all = contained ?? core.idsOfTypes(types);
    const inPile: EntityId[] = [];
    const rest: EntityId[] = [];
    for (const id of all) {
      if (rejected.has(id)) continue;
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
      if ((it.flags & (ItemFlag.Forbidden | ItemFlag.Reserved | ItemFlag.Owned | ItemFlag.Merchant | ItemFlag.Installed)) !== 0) continue;
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
