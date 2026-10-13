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

import { C, ItemFlag, type Corpse } from '@core/components';
import type { GameEvent } from '@core/events';
import type { JobsApi, TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { ItemCore, ItemChange } from './api';
import { HAUL_JOBS_PER_TICK } from './constants';
import { HAUL_PRIORITY } from '@systems/jobs/constants';
import { sortedHas, sortedInsert, sortedRemove } from './state';
import { WANTED_CLASSES, type Slot, type StockpileStore } from './stockpiles';

/** What hauling reads of 11 (`readers.of('11')`). */
export interface JobsView {
  get(id: number): { readonly id: number; readonly key: string; readonly producer: string; readonly data: Readonly<Record<string, unknown>> } | undefined;
  byKey(key: string): { readonly id: number; readonly state?: string } | undefined;
  list(): readonly { readonly id: number; readonly producer: string; readonly data: Readonly<Record<string, unknown>> }[];
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

  constructor(host: HaulHost) {
    this.host = host;
  }

  private get core(): ItemCore {
    return this.host.core;
  }

  // ---------- the wants set ----------

  /** The item API reports a change: decide again whether the item wants hauling. */
  onChange(id: EntityId, change: ItemChange): void {
    if (change === 'destroyed') {
      sortedRemove(this.wants, id);
      sortedRemove(this.noHome, id);
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
    if (it.carriedBy !== 0 || (it.containerId !== 0 && this.core.isItem(it.containerId))) return false;
    if ((it.flags & ItemFlag.Installed) !== 0) return false;
    if ((it.flags & (ItemFlag.Forbidden | ItemFlag.Reserved | ItemFlag.Owned | ItemFlag.Merchant | ItemFlag.AtDepot)) !== 0) return false;
    const t = this.core.tileOf(id);
    if (t < 0) return false;
    if ((it.flags & ItemFlag.Dump) !== 0) return this.host.zoneTypeAt(t) !== 'dump';
    // Dumped items stay on their dump (D-072).
    if (this.host.zoneTypeAt(t) === 'dump') return false;
    return !this.stored(id);
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
    if (this.wantsHauling(id)) {
      if (!sortedHas(this.noHome, id)) sortedInsert(this.wants, id);
    } else {
      sortedRemove(this.wants, id);
      sortedRemove(this.noHome, id);
      this.cancelFor(id, true);
    }
  }

  /** A stockpile was created, changed or removed: `noHome` returns to the set; its own items are looked at again. */
  stockpileChanged(spId: EntityId, tiles: readonly TileIndex[]): void {
    for (const id of this.noHome.splice(0)) sortedInsert(this.wants, id);
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

  /** `bestStockpileFor(it)`: accepting stockpiles with a slot; `full` when some accept but none has room. */
  bestFor(id: EntityId): { sp: EntityId; slot: Slot } | 'wait' | 'full' | null {
    const store = this.host.store;
    const tile = this.core.tileOf(id);
    let best: { sp: EntityId; slot: Slot; d: number; p: number } | null = null;
    let accepted = false;
    let waiting = false;
    for (const sp of store.all()) {
      if (!store.accepts(sp, id)) continue;
      // An item already in this stockpile stays.
      if (store.stockpileAt(tile) === sp) continue;
      accepted = true;
      const slot = store.findSlot(sp, id);
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
        for (const id of this.noHome.splice(0)) sortedInsert(this.wants, id);
      }
    }
    let created = this.requestContainers();
    const jobs = this.host.jobs();
    for (const id of this.wants.slice()) {
      if (created >= HAUL_JOBS_PER_TICK) break;
      if (this.hasJob(id)) continue;
      if (!this.wantsHauling(id)) {
        sortedRemove(this.wants, id);
        continue;
      }
      const it = this.core.item(id);
      if ((it.flags & ItemFlag.Dump) !== 0) {
        if (this.createDump(id, jobs)) created += 1;
        continue;
      }
      const best = this.bestFor(id);
      if (best === 'wait') continue;
      if (best === null || best === 'full') {
        sortedRemove(this.wants, id);
        sortedInsert(this.noHome, id);
        continue;
      }
      this.createHaul(id, best.sp, best.slot, jobs);
      created += 1;
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

  /** `haul_to_dump`: the nearest dump zone's first tile; with no dump zone the item has no home. */
  private createDump(id: EntityId, jobs: JobsApi): boolean {
    const tile = this.core.tileOf(id);
    let best: { tile: TileIndex; d: number } | null = null;
    for (const z of this.host.zonesOfType('dump')) {
      const first = z.tiles[0];
      if (first === undefined) continue;
      const d = this.distanceTo(tile, z.tiles);
      if (best === null || d < best.d) best = { tile: first, d };
    }
    if (best === null) {
      sortedRemove(this.wants, id);
      sortedInsert(this.noHome, id);
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
    this.endJob(job.data, id);
    if (core.isItem(id)) this.examine(id);
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

  /** A stockpile went away: the haul jobs bound for it are cancelled. */
  cancelBoundFor(spId: EntityId): void {
    const view = this.host.jobsView();
    if (view === null) return;
    for (const job of view.list()) {
      if (job.producer === 'items' && job.data['stockpile'] === spId) this.host.jobs().cancel(job.id, 'target_invalid');
    }
  }
}
