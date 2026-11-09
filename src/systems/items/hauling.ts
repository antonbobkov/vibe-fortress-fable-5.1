/**
 * Hauling: `02-systems/13-items-and-storage.md` § The "wants hauling" set, § Stockpiles
 * (capacity, containers wanted), § Forbid, dump, melt, claim (`dump`), § Corpses (`strip_corpse`),
 * `11-jobs-and-labor.md` § Hauling, and `algorithms/jobs-and-hauling.md` § Wants-hauling:
 *
 * ```
 * created = 0
 * for it in wantsHauling (ascending id) while created < HAUL_JOBS_PER_TICK:
 *   if hasJob(it): continue
 *   sp = bestStockpileFor(it); if sp == none: wantsHauling.remove(it); noHome.add(it); continue
 *   slot = findSlot(sp, it); if slot == none: continue
 *   reserveSlot(slot, jobId); sink.create('haul:'+it, { type: haul_to_stockpile, target: it, workTile: slot.tile, … })
 *   created++
 * bestStockpileFor(it): among stockpiles that accept(it) and have a free slot:
 *   min by (chebyshev(tileOf(it), centroid(sp)) then sp.priority then id)
 * ```
 *
 * The set is kept incrementally from the item API's change notices. On delivery the item is put in
 * its container or merged with its stack and the slot is released. A stockpile at capacity emits
 * `StockpileFull` once until it has space again, and then the `noHome` items are looked at again
 * (D-072).
 */

import { C, ItemFlag, type Corpse, type Item } from '@core/components';
import type { GameEvent } from '@core/events';
import type { JobsApi, TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { ItemCore, ItemChange } from './api';
import { HAUL_JOBS_PER_TICK } from './constants';
import { HAUL_PRIORITY } from '@systems/jobs/constants';
import { sortedHas, sortedInsert, sortedMerge, sortedRemove } from './state';
import { WANTED_CLASSES, type ContainerNeeded, type Slot, type StockpileStore, type TileScan, type ContainerScan } from './stockpiles';

/** What hauling reads of 11 (`readers.of('11')`). */
export interface JobsView {
  get(id: number): { readonly id: number; readonly key: string; readonly producer: string; readonly data: Readonly<Record<string, unknown>> } | undefined;
  byKey(key: string): { readonly id: number; readonly state?: string } | undefined;
  list(): readonly { readonly id: number; readonly producer: string; readonly workTile: unknown; readonly data: Readonly<Record<string, unknown>> }[];
}

export interface HaulHost {
  readonly core: ItemCore;
  readonly store: StockpileStore;
  jobs(): JobsApi;
  jobsView(): JobsView | null;
  /** The zone type on a tile (`dump`, …) or ''. */
  zoneTypeAt(i: TileIndex): string;
  /** The zones of a type, with their ascending tiles. */
  zonesOfType(type: string): readonly { readonly id: EntityId; readonly tiles: readonly TileIndex[] }[];
  /** Whether a dwarf can stand on the tile. */
  walkable(i: TileIndex): boolean;
  emit(event: GameEvent): void;
}

export function haulKey(itemId: EntityId): string {
  return `haul:${itemId}`;
}

export function dumpKey(itemId: EntityId): string {
  return `dump:${itemId}`;
}

export function stripKey(corpseId: EntityId): string {
  return `strip:${corpseId}`;
}

/**
 * What a pass over thousands of items asks of one stockpile, kept while nothing it is read from changes: whether the
 * stockpile's answer to an item follows from the item's kind alone (no linked sources), the filter's answer for each
 * kind, the slot found for each kind, and the scans of its tiles and containers those slots come from.
 */
interface StockpileCache {
  readonly byKind: boolean;
  readonly hospital: boolean;
  readonly accepts: Map<number, boolean>;
  readonly slots: Map<string, Slot | ContainerNeeded | null>;
  tiles: TileScan | null;
  readonly containers: Map<string, ContainerScan>;
}

interface PassCache {
  readonly key: number;
  readonly stockpiles: readonly EntityId[];
  readonly bySp: Map<EntityId, StockpileCache>;
}

export class Hauling {
  readonly host: HaulHost;
  /** `wantsHauling`, ascending id. */
  readonly wants: EntityId[] = [];
  /** `noHome`, ascending id. */
  readonly noHome: EntityId[] = [];
  /** Stockpiles that announced `StockpileFull` and have not had space since, ascending. */
  readonly full: EntityId[] = [];
  /** The item whose haul is being completed. */
  private completing: EntityId = 0;
  /**
   * Within one pass over `wants`, the items found to have no home leave `wants` and join `noHome` one at a time; as
   * array splices that costs the pass two moves of the set per item. They are held here, as the set of ids that have
   * left `wants` (`left`) and the ids that joined `noHome` (`homeless`, with `homelessList` in the ascending order they
   * were found in), and applied to the two arrays once (`settle`). `inNoHome` and `examine` read both, so what the
   * pass and everything it calls sees is what the arrays alone would hold.
   */
  private readonly left = new Set<EntityId>();
  private readonly homeless = new Set<EntityId>();
  private readonly homelessList: EntityId[] = [];
  /**
   * Items that waited for a container and what would make them worth another look (derived, never saved).
   * A waiting item is skipped while the stockpiles stand as they did (`epoch`) and no container could hold it.
   */
  private readonly parked = new Map<EntityId, { readonly epoch: number; readonly cls: string; readonly needs: number }>();
  private roomCache: { readonly key: number; readonly rooms: Map<string, number> } | null = null;
  private passCache: PassCache | null = null;

  constructor(host: HaulHost) {
    this.host = host;
  }

  private get core(): ItemCore {
    return this.host.core;
  }

  // ---------- the wants set ----------

  /** An item leaves the wants set: what it waited for is forgotten with it. */
  private leaveWants(id: EntityId): void {
    sortedRemove(this.wants, id);
    this.parked.delete(id);
  }

  /** Apply what a pass has held back to `wants` and `noHome`. */
  private settle(): void {
    if (this.left.size > 0) {
      let kept = 0;
      for (const id of this.wants) if (!this.left.has(id)) this.wants[kept++] = id;
      this.wants.length = kept;
      this.left.clear();
    }
    if (this.homelessList.length > 0) {
      const joined = this.homelessList.filter((id) => this.homeless.has(id));
      this.homelessList.length = 0;
      this.homeless.clear();
      sortedMerge(this.noHome, joined);
    }
  }

  /** The item has no home (`noHome`), counting the ones a pass has not yet written to the array. */
  private inNoHome(id: EntityId): boolean {
    return this.homeless.has(id) || sortedHas(this.noHome, id);
  }

  private leaveNoHome(id: EntityId): void {
    this.homeless.delete(id);
    sortedRemove(this.noHome, id);
  }

  /** In a pass: an item leaves `wants` (it wants hauling no more, or it has no home and joins `noHome`). */
  private passLeaves(id: EntityId, homeless: boolean): void {
    this.parked.delete(id);
    this.left.add(id);
    if (!homeless) return;
    const last = this.homelessList[this.homelessList.length - 1];
    if (last !== undefined && id <= last) this.settle();
    this.homelessList.push(id);
    this.homeless.add(id);
  }

  /** After a load every waiting item is looked at again. */
  forgetParked(): void {
    this.parked.clear();
    this.roomCache = null;
    this.passCache = null;
  }

  /** The item API reports a change: decide again whether the item wants hauling. */
  onChange(id: EntityId, change: ItemChange): void {
    this.parked.delete(id);
    if (change === 'destroyed') {
      this.leaveWants(id);
      this.leaveNoHome(id);
      // A stack merged away by its own delivery is not a lost target.
      if (id !== this.completing) this.cancelFor(id);
      return;
    }
    this.examine(id);
    // A container's contents decide whether it is accepted: look at the container too.
    const holder = this.core.get(id)?.containerId ?? 0;
    if (holder !== 0) this.examine(holder);
  }

  /** Whether an item wants hauling now (13 § The "wants hauling" set). */
  wantsHauling(id: EntityId): boolean {
    const it = this.core.get(id);
    if (it === undefined) return false;
    // Picked up, or inside a container (the container is hauled with its contents); what lies in
    // the wagon (a building's container) is unloaded like anything on the ground (D-074).
    if (it.carriedBy !== 0) return false;
    if (it.containerId !== 0 && this.core.isItem(it.containerId)) return this.wantsDecanting(id);
    if ((it.flags & ItemFlag.Installed) !== 0) return false;
    if ((it.flags & (ItemFlag.Forbidden | ItemFlag.Reserved | ItemFlag.Owned | ItemFlag.Merchant | ItemFlag.AtDepot)) !== 0) return false;
    const t = this.core.tileOf(id);
    if (t < 0) return false;
    if ((it.flags & ItemFlag.Dump) !== 0) return this.host.zoneTypeAt(t) !== 'dump';
    // Dumped items stay on their dump (D-072).
    if (this.host.zoneTypeAt(t) === 'dump') return false;
    return !this.stored(id);
  }

  /**
   * 13 § Stockpiles: goods counted in units inside a container that stands on no stockpile
   * accepting it, and that found no free tile to go to whole, go by their stack into a container
   * with room on a stockpile that accepts them (brew left in its barrel at the still reaches the
   * drink stockpile's barrels). Goods in a container on an accepting stockpile stay in it.
   */
  private wantsDecanting(id: EntityId): boolean {
    const it = this.core.get(id);
    if (it === undefined) return false;
    const holderId = it.containerId;
    const holder = this.core.get(holderId);
    const c = this.core.container(holderId);
    if (holder === undefined || c === undefined || !this.core.host.facts.countsUnits(c.classId)) return false;
    if (this.core.host.facts.row(it.type).container !== c.classId) return false;
    const blocked = ItemFlag.Forbidden | ItemFlag.Reserved | ItemFlag.Owned | ItemFlag.Merchant | ItemFlag.AtDepot | ItemFlag.Installed;
    if ((it.flags & blocked) !== 0 || (holder.flags & blocked) !== 0 || holder.carriedBy !== 0 || holder.containerId !== 0) return false;
    if (this.core.tileOf(holderId) < 0 || this.host.store.isStored(holderId)) return false;
    // The whole container goes first, to a free tile, when one is found.
    return this.inNoHome(holderId) && !this.hasJob(holderId);
  }

  private contentsBusy(id: EntityId): boolean {
    for (const inner of this.core.container(id)?.contents ?? []) {
      if (((this.core.get(inner)?.flags ?? 0) & ItemFlag.Reserved) !== 0 || this.hasJob(inner)) return true;
    }
    return false;
  }

  /** In an accepting stockpile slot, or an empty container the stockpile it lies on wants. */
  private stored(id: EntityId): boolean {
    const store = this.host.store;
    if (store.isStored(id)) return true;
    const c = this.core.container(id);
    if (c === undefined || c.contents.length > 0) return false;
    const sp = store.stockpileAt(this.core.tileOf(id));
    if (sp === 0) return false;
    const wanted = store.stockpile(sp)?.containersWanted[c.classId as 'barrel' | 'bag' | 'bin'] ?? 0;
    return wanted > 0;
  }

  examine(id: EntityId): void {
    this.parked.delete(id);
    if (this.wantsHauling(id)) {
      if (!this.inNoHome(id)) {
        this.left.delete(id);
        sortedInsert(this.wants, id);
      }
    } else {
      this.leaveWants(id);
      this.leaveNoHome(id);
      this.cancelFor(id, true);
    }
  }

  /** A stockpile gained a slot (a built container, a container hauled in): `noHome` returns to the set. */
  slotsGained(): void {
    this.noHomeReturns();
  }

  /** Every item without a home returns to `wants`. */
  private noHomeReturns(): void {
    this.settle();
    sortedMerge(this.wants, this.noHome);
    this.noHome.length = 0;
  }

  /** A stockpile was created, changed or removed: `noHome` returns to the set; its own items are looked at again. */
  stockpileChanged(spId: EntityId, tiles: readonly TileIndex[]): void {
    this.noHomeReturns();
    for (const t of tiles) for (const id of this.host.store.host.itemsOn(t)) this.examine(id);
    const at = this.full.indexOf(spId);
    if (at >= 0) this.full.splice(at, 1);
  }

  // ---------- jobs ----------

  private hasJob(id: EntityId): boolean {
    const jobs = this.host.jobs();
    return jobs.exists(haulKey(id)) || jobs.exists(dumpKey(id));
  }

  /** The item is gone (or stops wanting hauling): its haul jobs go too (Decision F-01d, D-154). */
  private cancelFor(id: EntityId, onlyUnclaimed = false): void {
    const view = this.host.jobsView();
    for (const key of [haulKey(id), dumpKey(id), stripKey(id)]) {
      const job = view?.byKey(key);
      if (job === undefined || job.id === 0) continue;
      if (!onlyUnclaimed || job.state === 'open' || job.state === 'blocked') {
        this.host.jobs().cancel(job.id, 'target_invalid');
      }
    }
  }

  private centroid(tiles: readonly TileIndex[]): { x: number; y: number; z: number } {
    const map = this.core.host.map;
    let x = 0;
    let y = 0;
    let z = 0;
    for (const t of tiles) {
      x += map.xOf(t);
      y += map.yOf(t);
      z += map.zOf(t);
    }
    const n = Math.max(1, tiles.length);
    return { x: Math.floor(x / n), y: Math.floor(y / n), z: Math.floor(z / n) };
  }

  private distanceTo(tile: TileIndex, tiles: readonly TileIndex[]): number {
    const map = this.core.host.map;
    const c = this.centroid(tiles);
    return Math.max(Math.abs(map.xOf(tile) - c.x), Math.abs(map.yOf(tile) - c.y), Math.abs(map.zOf(tile) - c.z));
  }

  /** What the answers kept for a pass are read from; equal values mean none of it has changed. */
  private slotKey(): number {
    const e = this.core.host.entities;
    const store = this.host.store;
    return e.revision(C.Item) + e.revision(C.Container) + e.revision(C.Position) + e.revision(C.Stockpile) + e.revision(C.Zone)
      + e.revision(C.Building) + store.reservations.changes + store.tiles.changes + store.groundChanges;
  }

  private cache(): PassCache {
    const key = this.slotKey();
    if (this.passCache === null || this.passCache.key !== key) this.passCache = { key, stockpiles: this.host.store.all(), bySp: new Map() };
    return this.passCache;
  }

  private stockpileCache(cache: PassCache, sp: EntityId): StockpileCache {
    let spc = cache.bySp.get(sp);
    if (spc === undefined) {
      const store = this.host.store;
      spc = { byKind: store.acceptsByKind(sp), hospital: store.isHospital(sp), accepts: new Map(), slots: new Map(), tiles: null, containers: new Map() };
      cache.bySp.set(sp, spc);
    }
    return spc;
  }

  /**
   * `store.accepts(sp, id)`. Where the answer follows from the item's kind (an item with nothing in it, a stockpile
   * with no linked sources), a pass over thousands of items asks the stockpile once for each kind.
   */
  private accepts(spc: StockpileCache, sp: EntityId, id: EntityId, it: Item, kind: number): boolean {
    const store = this.host.store;
    if (kind < 0 || !spc.byKind) return store.accepts(sp, id);
    if ((it.flags & ItemFlag.Forbidden) !== 0) return false;
    let ok = spc.accepts.get(kind);
    if (ok === undefined) {
      ok = store.acceptsKind(sp, it);
      spc.accepts.set(kind, ok);
    }
    return ok;
  }

  /**
   * `store.findSlot(sp, id)`. An item that goes on a tile (no container class) finds the same slot as any other of
   * its type, material, quality and count, and one that goes into a container finds the same answer, when there is
   * none, as any other that needs as much room, while the tiles, the items on them and the reservations stand as
   * they are: a pass over thousands of items asks the stockpile once for each kind. `kind` names the item's.
   */
  private slotFor(spc: StockpileCache, sp: EntityId, id: EntityId, cls: string, kind: string): Slot | ContainerNeeded | null {
    const store = this.host.store;
    if (spc.hospital) return store.findSlot(sp, id);
    let slot = spc.slots.get(kind);
    if (slot === undefined) {
      // Every item that goes on a tile reads the same tiles of the stockpile, and every item that goes into a container
      // of a class the same containers: they are scanned once.
      if (cls === 'none') {
        spc.tiles ??= store.scanTiles(sp);
        slot = store.slotInScan(spc.tiles, id);
      } else {
        let scan = spc.containers.get(cls);
        if (scan === undefined) {
          scan = store.scanContainers(sp, cls);
          spc.containers.set(cls, scan);
        }
        slot = store.slotInContainerScan(sp, id, cls, scan);
      }
      // A slot in a container is keyed by the item that will fill it: only the refusals are shared.
      if (cls === 'none' || slot === null || 'needContainer' in slot) spc.slots.set(kind, slot);
    }
    return slot;
  }

  /** `bestStockpileFor(it)`: accepting stockpiles with a slot; `full` when some accept but none has room. */
  bestFor(id: EntityId): { sp: EntityId; slot: Slot } | 'wait' | 'full' | null {
    const store = this.host.store;
    const tile = this.core.tileOf(id);
    let best: { sp: EntityId; slot: Slot; d: number; p: number } | null = null;
    let accepted = false;
    let waiting = false;
    const cache = this.cache();
    const it = this.core.get(id);
    if (it === undefined) return null;
    // The item's kind: for the filter its type, material, quality and whether it has rotted (-1 for a container with
    // goods in it, which the stockpile asks about its goods), and for a slot what the slot is found by.
    const holds = this.core.container(id);
    const kind = holds !== undefined && holds.contents.length > 0
      ? -1 : ((it.type * 65536 + it.material) * 8 + it.quality) * 2 + (it.rotStage >= 2 ? 1 : 0);
    const cls = holds !== undefined ? 'none' : this.core.host.facts.row(it.type).container;
    const slotKind = cls === 'none' ? `${it.type}:${it.material}:${it.quality}:${it.count}` : `${cls}:${this.core.needs(id, cls)}`;
    for (const sp of cache.stockpiles) {
      const spc = this.stockpileCache(cache, sp);
      if (!this.accepts(spc, sp, id, it, kind)) continue;
      // An item already in this stockpile stays.
      if (store.stockpileAt(tile) === sp) continue;
      accepted = true;
      const slot = this.slotFor(spc, sp, id, cls, slotKind);
      if (slot === null) continue;
      if ('needContainer' in slot) {
        waiting = true;
        continue;
      }
      const d = this.distanceTo(tile, store.tilesOf(sp));
      const p = store.stockpile(sp)?.priority ?? 0;
      if (best === null || d < best.d || (d === best.d && p < best.p)) best = { sp, slot, d, p };
    }
    if (best !== null) return { sp: best.sp, slot: best.slot };
    // A wanted container is on its way (or will be asked for): the item waits in the set.
    if (waiting) return 'wait';
    return accepted ? 'full' : null;
  }

  /**
   * Everything but the room in containers that decides whether a waiting item is still waiting: the
   * stockpiles' places and settings, the zones and buildings, the containers standing on them, and the
   * containers on their way. It only grows, so equal values mean nothing of that has changed.
   */
  private epoch(): number {
    const e = this.core.host.entities;
    const store = this.host.store;
    return store.tiles.changes + store.incomingContainers.losses + this.core.containerNotices + store.groundChanges
      + e.revision(C.Stockpile) + e.revision(C.Zone) + e.revision(C.Building);
  }

  /** `store.maxFreeRoom(cls)`, kept while nothing it reads has changed (`key`: `epoch` and what the rooms are read from). */
  private freeRoom(cls: string, key: number): number {
    if (this.roomCache === null || this.roomCache.key !== key) this.roomCache = { key, rooms: new Map() };
    let room = this.roomCache.rooms.get(cls);
    if (room === undefined) {
      room = this.host.store.maxFreeRoom(cls);
      this.roomCache.rooms.set(cls, room);
    }
    return room;
  }

  /**
   * An item that has to wait for a container is not looked at again until a stockpile changes or a
   * container could take it: `findSlot` finds a slot for it only in a container with room for it, and
   * it waits only while a wanted container is missing or on its way.
   */
  private roomKey(epoch: number): number {
    const e = this.core.host.entities;
    return e.revision(C.Item) + e.revision(C.Container) + this.host.store.reservations.changes + epoch;
  }

  private park(id: EntityId): void {
    const it = this.core.get(id);
    if (it === undefined || it.containerId !== 0 || (it.flags & ItemFlag.Dump) !== 0 || this.core.container(id) !== undefined) return;
    const cls = this.core.host.facts.row(it.type).container;
    if (cls !== 'barrel' && cls !== 'bag' && cls !== 'bin') return;
    this.parked.set(id, { epoch: this.epoch(), cls, needs: this.core.needs(id, cls) });
  }

  /** The 13 tick: capacity notices, wanted containers, then up to `HAUL_JOBS_PER_TICK` haul jobs. */
  tick(ctx: TickContext): void {
    const store = this.host.store;
    this.dropStaleReservations();
    // Capacity: `StockpileFull` once until there is space again, when `noHome` is looked at again.
    for (const sp of store.all()) {
      const isFull = store.freeSlots(sp) === 0;
      const was = sortedHas(this.full, sp);
      if (isFull && !was) {
        sortedInsert(this.full, sp);
        ctx.emit({ type: 'StockpileFull', id: sp });
      } else if (!isFull && was) {
        sortedRemove(this.full, sp);
        this.noHomeReturns();
      }
    }
    let created = this.requestContainers();
    const jobs = this.host.jobs();
    // A hospital takes an item into a chest, which no container count or room tells: a waiting item is looked at
    // again when a hospital would take it.
    const hospitals = this.host.store.hospitals();
    // What the waiting items are compared with; read again after any item has been dealt with.
    let epoch = this.epoch();
    let roomKey = this.roomKey(epoch);
    let worked = false;
    try {
      for (const id of this.wants.slice()) {
        if (created >= HAUL_JOBS_PER_TICK) break;
        if (worked) {
          epoch = this.epoch();
          roomKey = this.roomKey(epoch);
          worked = false;
        }
        const waiting = this.parked.get(id);
        if (waiting !== undefined) {
          if (waiting.epoch === epoch && waiting.needs > this.freeRoom(waiting.cls, roomKey) &&
            !(hospitals.length > 0 && this.host.store.hospitalHasSlot(hospitals, id))) continue;
          this.parked.delete(id);
        }
        worked = true;
        if (this.hasJob(id)) continue;
        // A container whose goods are spoken for (a stack on its way to a stockpile's barrel, a unit
        // a dwarf is about to drink) waits in the set until they are taken or released.
        if (this.contentsBusy(id)) continue;
        if (!this.wantsHauling(id)) {
          this.passLeaves(id, false);
          continue;
        }
        const it = this.core.item(id);
        if ((it.flags & ItemFlag.Dump) !== 0) {
          if (this.createDump(id, jobs)) created += 1;
          continue;
        }
        const best = this.bestFor(id);
        if (best === 'wait') {
          this.park(id);
          continue;
        }
        if (best === null || best === 'full') {
          this.passLeaves(id, true);
          // A container with no tile to go to: its goods may still go by their stack.
          for (const inner of this.core.container(id)?.contents ?? []) this.examine(inner);
          continue;
        }
        this.createHaul(id, best.sp, best.slot, jobs);
        created += 1;
      }
    } finally {
      this.settle();
    }
    created += this.createStrips(jobs, HAUL_JOBS_PER_TICK - created);
  }

  private createHaul(id: EntityId, sp: EntityId, slot: Slot, jobs: JobsApi): void {
    const store = this.host.store;
    const priority = store.stockpile(sp)?.priority;
    // A container that is built furniture (a hospital's chest) stands on a tile nobody walks: the
    // hauler fills it from a tile beside it.
    const beside = slot.container !== 0 && !this.host.walkable(slot.tile);
    const jobId = jobs.create(haulKey(id), {
      type: 'haul_to_stockpile',
      target: { kind: 'entity', ref: id },
      workTile: beside ? 'adjacent' : slot.tile,
      ...(priority === undefined ? {} : { priority }),
      inputs: [{ filter: { itemId: id }, count: 1 }],
      data: { stockpile: sp, slotKey: slot.key, container: slot.container, merge: slot.merge, ...(beside ? { anchorTile: slot.tile } : {}) },
    });
    store.reserve(slot, jobId);
  }

  /** `containersWanted` "produces haul jobs for empty containers from wherever they are": one per class per tick. */
  private requestContainers(): number {
    const store = this.host.store;
    const jobs = this.host.jobs();
    let n = 0;
    for (const sp of store.all()) {
      const rec = store.stockpile(sp);
      if (rec === undefined) continue;
      for (const cls of WANTED_CLASSES) {
        if (rec.containersWanted[cls] <= store.containersPresent(sp, cls)) continue;
        const container = this.freeContainer(cls, sp);
        if (container === 0) continue;
        const slot = store.containerSlot(sp);
        if (slot === null) continue;
        store.incomingContainers.set(container, sp);
        this.createHaul(container, sp, slot, jobs);
        n += 1;
      }
    }
    return n;
  }

  /** The nearest empty container of a class that is not already stored where it is wanted or on its way. */
  private freeContainer(cls: string, sp: EntityId): EntityId {
    const store = this.host.store;
    const tiles = store.tilesOf(sp);
    let best: EntityId = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (const id of this.core.host.entities.with(C.Container)) {
      const c = this.core.container(id);
      if (c === undefined || c.classId !== cls || c.contents.length > 0) continue;
      const it = this.core.get(id);
      if (it === undefined || it.carriedBy !== 0 || (it.flags & (ItemFlag.Forbidden | ItemFlag.Reserved | ItemFlag.Owned | ItemFlag.Merchant)) !== 0) continue;
      if (store.incomingContainers.has(id) || this.hasJob(id)) continue;
      const t = this.core.tileOf(id);
      if (t < 0) continue;
      const here = store.stockpileAt(t);
      if (here !== 0 && ((store.stockpile(here)?.containersWanted[cls as 'barrel'] ?? 0) > 0 || store.accepts(here, id))) continue;
      const d = this.distanceTo(t, tiles);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  /** `haul_to_dump`: the nearest dump zone's first standable tile; with no dump zone the item has no home. */
  private createDump(id: EntityId, jobs: JobsApi): boolean {
    const tile = this.core.tileOf(id);
    let best: { tile: TileIndex; d: number } | null = null;
    for (const z of this.host.zonesOfType('dump')) {
      // The zone's first tile a dwarf can stand on (13 § Stockpiles: a tile nobody stands on takes nothing).
      const first = z.tiles.find((t) => this.host.store.host.standable(t));
      if (first === undefined) continue;
      const d = this.distanceTo(tile, z.tiles);
      if (best === null || d < best.d) best = { tile: first, d };
    }
    if (best === null) {
      this.passLeaves(id, true);
      return false;
    }
    jobs.create(dumpKey(id), {
      type: 'haul_to_dump',
      priority: HAUL_PRIORITY,
      target: { kind: 'entity', ref: id },
      workTile: best.tile,
      inputs: [{ filter: { itemId: id }, count: 1 }],
      data: {},
    });
    return true;
  }

  /**
   * `strip_corpse`: a corpse that is not a dwarf's and still wears items gets one job that moves
   * the equipment to the ground (13 § Forbid, dump, melt, claim; § Corpses).
   */
  private createStrips(jobs: JobsApi, budget: number): number {
    let n = 0;
    for (const id of this.core.host.entities.with(C.Corpse)) {
      if (n >= budget) break;
      const corpse = this.core.host.entities.get<Corpse>(id, C.Corpse) as Corpse;
      if (corpse.dwarfName !== null || corpse.wornItems.length === 0 || jobs.exists(stripKey(id))) continue;
      const it = this.core.get(id);
      if (it === undefined || (it.flags & ItemFlag.Forbidden) !== 0 || it.carriedBy !== 0) continue;
      const tile = this.core.tileOf(id);
      if (tile < 0) continue;
      jobs.create(stripKey(id), { type: 'strip_corpse', priority: HAUL_PRIORITY, target: { kind: 'entity', ref: id }, workTile: 'adjacent', data: { anchorTile: tile } });
      n += 1;
    }
    return n;
  }

  // ---------- completion ----------

  /** The producer side: delivery of a haul, a dump, or a strip. */
  complete(job: { readonly key: string; readonly target: { readonly ref: number }; readonly data: Readonly<Record<string, unknown>> }): void {
    const core = this.core;
    const id = job.target.ref;
    if (job.key.startsWith('strip:')) {
      const corpse = core.host.entities.get<Corpse>(id, C.Corpse);
      const tile = core.tileOf(id);
      if (corpse !== undefined && tile >= 0) {
        for (const worn of corpse.wornItems) {
          core.recoverLoot(worn);
          core.dropAt(worn, tile);
        }
        core.host.entities.add<Corpse>(id, C.Corpse, { ...corpse, wornItems: [] });
      }
      return;
    }
    if (!core.isItem(id)) return;
    this.completing = id;
    try {
      this.deliver(job, id);
    } finally {
      this.completing = 0;
    }
  }

  private deliver(job: { readonly key: string; readonly data: Readonly<Record<string, unknown>> }, id: EntityId): void {
    const core = this.core;
    core.release(id);
    if (job.key.startsWith('dump:')) {
      // "on arrival the flag clears".
      core.setFlag(id, ItemFlag.Dump, false);
      return;
    }
    const container = job.data['container'];
    const merge = job.data['merge'];
    if (typeof container === 'number' && container !== 0) {
      const destination = core.get(container);
      // A workshop can reserve and move the barrel after this haul selected its slot.
      // Leave the delivered item on the ground so it can find another home.
      if (destination !== undefined && (destination.flags & ItemFlag.Reserved) === 0 &&
        this.host.store.stockpileAt(this.host.store.containerTile(container)) === job.data['stockpile']) {
        core.putIn(id, container);
      }
    }
    else if (typeof merge === 'number' && merge !== 0) core.merge(merge, id);
    // A container brought into a stockpile gives it slots.
    const containerIn = this.host.store.incomingContainers.has(id) && core.container(id) !== undefined;
    this.endJob(job.data, id);
    if (core.isItem(id)) this.examine(id);
    if (containerIn) this.slotsGained();
  }

  /** A haul job ended (done or cancelled): its slot and any incoming-container mark are released. */
  endJob(data: Readonly<Record<string, unknown>>, itemId: EntityId): void {
    const key = data['slotKey'];
    if (typeof key === 'string') this.host.store.releaseKey(key);
    this.host.store.incomingContainers.delete(itemId);
  }

  /** Reservations whose job no longer exists are dropped (a cancelled job, a load). */
  private dropStaleReservations(): void {
    const view = this.host.jobsView();
    if (view === null) return;
    const store = this.host.store;
    for (const key of Array.from(store.reservations.keys())) {
      if (view.get(store.reservations.get(key) as number) === undefined) store.releaseKey(key);
    }
    for (const c of Array.from(store.incomingContainers.keys())) {
      if (view.byKey(haulKey(c)) === undefined) store.incomingContainers.delete(c);
    }
  }

  /**
   * 13 § Stockpiles: the terrain or a building changed on these tiles. A stockpile tile among them may have lost its
   * slot or got it back (`groundChanges`), and a haul or dump whose work tile is one of them that no dwarf can stand
   * on any more (a sapling grown into a tree, a wall or a chest built there) is cancelled with `target_invalid`: its
   * slot is released and the item finds another home. A haul into a container a dwarf fills from beside it is not.
   */
  groundChanged(tiles: readonly TileIndex[]): void {
    const store = this.host.store;
    const lost = new Set<TileIndex>();
    for (const t of tiles) {
      const onStockpile = store.stockpileAt(t) !== 0;
      if (onStockpile) store.groundChanges += 1;
      if ((onStockpile || this.host.zoneTypeAt(t) === 'dump') && !store.host.standable(t)) lost.add(t);
    }
    if (lost.size === 0) return;
    const view = this.host.jobsView();
    if (view === null) return;
    for (const job of view.list()) {
      if (job.producer !== 'items' || typeof job.workTile !== 'number' || !lost.has(job.workTile)) continue;
      this.host.jobs().cancel(job.id, 'target_invalid');
    }
  }

  /** A stockpile went away: the haul jobs bound for it are cancelled. */
  cancelBoundFor(spId: EntityId): void {
    const view = this.host.jobsView();
    if (view === null) return;
    for (const job of view.list()) {
      if (job.producer === 'items' && job.data['stockpile'] === spId) this.host.jobs().cancel(job.id, 'target_invalid');
    }
  }
}
