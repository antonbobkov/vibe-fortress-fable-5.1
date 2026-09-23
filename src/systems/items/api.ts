/**
 * The item API of 13: `02-systems/13-items-and-storage.md` § Concepts (items, stacks, containers),
 * § Placement and pickup, § Forbid, dump, melt, claim, § Stock counts, § Value (wealth), and
 * § Interfaces › Item API. `module-interfaces.md` § The spawn API: `spawn.item` lands here.
 *
 * Every mutation goes through {@link ItemCore.mutate}, which takes the item's old contribution out
 * of the stock counts and the wealth and puts the new one in, so the incremental counts always
 * equal a recount (property `item accounting`).
 */

import { C, ItemFlag, type Container, type Item, type Position } from '@core/components';
import { FLUID_MAX_LEVEL } from '@core/path-constants';
import { TileKind, isSolidBottomed, type Map3D } from '@core/map3d';
import type { EntityStore } from '@core/entities';
import type { GameEvent } from '@core/events';
import type { ItemsApi, SpatialWriter } from '@core/system';
import type { EntityId, Quality, TileIndex } from '@core/types';
import { StockCounts, isAvailable, type Contribution } from './counts';
import type { ItemFacts } from './facts';
import { itemValue } from './value';

export interface ItemHost {
  readonly map: Map3D;
  readonly entities: EntityStore;
  readonly facts: ItemFacts;
  spatial(): SpatialWriter | null;
  emit(event: GameEvent): void;
  tick(): number;
  /** The tile of a holder that is not an item (the wagon: a building's container; D-074), or -1. */
  holderTile?(id: EntityId): TileIndex;
}

/** What happened to an item, for the listeners that keep derived sets (the wants-hauling set). */
export type ItemChange = 'created' | 'placed' | 'lifted' | 'contained' | 'flags' | 'count' | 'destroyed';

export type ItemListener = (id: EntityId, change: ItemChange) => void;

export class ItemCore implements ItemsApi {
  readonly host: ItemHost;
  readonly counts = new StockCounts();
  /** Fortress wealth from items (13 § Value), plus the building values 14 reports. */
  wealth = 0;
  /** Building contributions (`BuildingCompleted` / `BuildingRemoved`, 14 § Value). */
  buildingWealth = 0;
  private readonly listeners: ItemListener[] = [];

  constructor(host: ItemHost) {
    this.host = host;
  }

  private get map(): Map3D {
    return this.host.map;
  }

  private get entities(): EntityStore {
    return this.host.entities;
  }

  listen(listener: ItemListener): void {
    this.listeners.push(listener);
  }

  private notify(id: EntityId, change: ItemChange): void {
    for (let k = 0; k < this.listeners.length; k += 1) (this.listeners[k] as ItemListener)(id, change);
  }

  // ---------- reading ----------

  isItem(id: EntityId): boolean {
    return this.entities.has(id, C.Item);
  }

  get(id: EntityId): Item | undefined {
    return this.entities.get(id, C.Item);
  }

  item(id: EntityId): Item {
    const it = this.entities.get(id, C.Item);
    if (it === undefined) throw new RangeError(`items: ${id} is not a living item`);
    return it;
  }

  container(id: EntityId): Container | undefined {
    return this.entities.get(id, C.Container);
  }

  /** The tile an item is on: its own, its container's, or its carrier's; -1 when nowhere. */
  tileOf(id: EntityId): TileIndex {
    for (let depth = 0; depth < 8; depth += 1) {
      const p = this.entities.get<Position>(id, C.Position);
      if (p !== undefined) return this.map.inBounds(p.x, p.y, p.z) ? this.map.index(p.x, p.y, p.z) : -1;
      const it = this.entities.get(id, C.Item);
      if (it === undefined) return this.host.holderTile?.(id) ?? -1;
      if (it.containerId !== 0) id = it.containerId;
      else if (it.carriedBy !== 0) id = it.carriedBy;
      else return -1;
    }
    return -1;
  }

  /** The ids of the items lying on a tile (with a `Position`), ascending. */
  itemsOn(tile: TileIndex, entitiesAt: (i: TileIndex) => readonly EntityId[]): EntityId[] {
    return entitiesAt(tile).filter((id) => this.isItem(id));
  }

  /** `value(item)` of 13 § Value. */
  value(id: EntityId): number {
    const it = this.get(id);
    return it === undefined ? 0 : this.valueOf(it);
  }

  valueOf(it: Item): number {
    const row = this.host.facts.row(it.type);
    return itemValue(this.host.facts.materialValue(it.material), row.mult, it.quality, row.quality, it.count);
  }

  /** Items of a fortress's own: everything but merchants' goods (13 § Value, "in fortress possession"). */
  private counted(it: Item): boolean {
    return (it.flags & ItemFlag.Merchant) === 0;
  }

  private contribution(it: Item): Contribution {
    return {
      type: it.type,
      units: it.count,
      materialClass: this.host.facts.materialClass(it.material),
      quality: it.quality,
      available: isAvailable(it.flags),
    };
  }

  private account(it: Item, sign: 1 | -1): void {
    if (!this.counted(it)) return;
    this.counts.add(this.contribution(it), sign);
    this.wealth += sign * this.valueOf(it);
  }

  /** Rewrite an item's record, keeping the counts and the wealth exact. */
  private mutate(id: EntityId, patch: Partial<Item>): Item {
    const before = this.item(id);
    const after: Item = { ...before, ...patch };
    this.account(before, -1);
    this.entities.add(id, C.Item, after);
    this.account(after, 1);
    return after;
  }

  // ---------- placement ----------

  /**
   * Where a thing dropped on `tile` comes to rest: the tile itself when it has a bottom, else the
   * first solid-bottomed tile below, stopping on full fluid (13 § Placement and pickup: "the item
   * falls (movement helper rules) to the first solid-bottomed tile below").
   */
  landingTile(tile: TileIndex): TileIndex {
    const map = this.map;
    let cur = tile;
    for (;;) {
      const kind = map.kindAt(cur);
      if (isSolidBottomed(kind) || kind !== TileKind.Open) return cur;
      if (map.fluidLevelAt(cur) === FLUID_MAX_LEVEL) return cur;
      const below = map.below(cur);
      if (below < 0) return cur;
      const bk = map.kindAt(below);
      if (isSolidBottomed(bk)) return below;
      if (bk !== TileKind.Open) return cur;
      cur = below;
    }
  }

  private place(id: EntityId, tile: TileIndex): TileIndex {
    const land = this.landingTile(tile);
    const old = this.positionTile(id);
    this.entities.add<Position>(id, C.Position, this.map.unpack(land));
    const spatial = this.host.spatial();
    if (spatial !== null) {
      if (old < 0) spatial.insert(id, land);
      else spatial.move(id, old, land);
    }
    return land;
  }

  private positionTile(id: EntityId): TileIndex {
    const p = this.entities.get<Position>(id, C.Position);
    if (p === undefined || !this.map.inBounds(p.x, p.y, p.z)) return -1;
    return this.map.index(p.x, p.y, p.z);
  }

  private unplace(id: EntityId): void {
    const old = this.positionTile(id);
    if (old < 0 && !this.entities.has(id, C.Position)) return;
    this.host.spatial()?.remove(id, old);
    this.entities.remove(id, C.Position);
  }

  /** Detach an item from wherever it is (ground, container, carrier); it ends up nowhere. */
  private detach(id: EntityId): void {
    const it = this.item(id);
    if (it.containerId !== 0) {
      const c = this.container(it.containerId);
      if (c !== undefined) {
        this.entities.add(it.containerId, C.Container, { ...c, contents: c.contents.filter((x) => x !== id) });
      }
    }
    this.unplace(id);
    if (it.containerId !== 0 || it.carriedBy !== 0) this.mutate(id, { containerId: 0, carriedBy: 0 });
  }

  // ---------- creation ----------

  /**
   * `spawn.item(type, material, at | containerId, count, quality)`. A count above the type's stack
   * size makes several stacks at the same place (D-068); the first id is returned.
   */
  create(type: number, material: number, at: TileIndex | { containerId: EntityId }, count = 1, quality = 1): EntityId {
    const row = this.host.facts.row(type);
    const stack = Math.max(1, row.stack);
    let remaining = Math.max(1, Math.floor(count));
    let first: EntityId = 0;
    while (remaining > 0) {
      const n = Math.min(stack, remaining);
      remaining -= n;
      const id = this.createOne(type, material, at, n, quality);
      if (first === 0) first = id;
    }
    return first;
  }

  private createOne(type: number, material: number, at: TileIndex | { containerId: EntityId }, count: number, quality: number): EntityId {
    const facts = this.host.facts;
    const id = this.entities.create('item');
    const it: Item = {
      type,
      material,
      quality: Math.max(0, Math.min(5, quality)) as Quality,
      wear: 0,
      count,
      containerId: 0,
      ownerId: 0,
      flags: 0,
      crafterId: 0,
      rotStart: this.host.tick(),
      rotStage: 0,
      reservedBy: 0,
      carriedBy: 0,
    };
    this.entities.add(id, C.Item, it);
    this.account(it, 1);
    const cls = facts.containerClassOf(type);
    if (cls !== '') {
      this.entities.add(id, C.Container, { contents: [], capacity: facts.capacityOf(type), classId: cls as Container['classId'] });
    }
    if (typeof at === 'number') {
      this.place(id, at);
    } else if (!this.putIn(id, at.containerId)) {
      // A full or missing container: the item lands where the container is.
      const tile = this.tileOf(at.containerId);
      if (tile >= 0) this.place(id, tile);
    }
    this.host.emit({
      type: 'ItemCreated',
      id,
      itemType: facts.row(type).id,
      material: facts.materialIdOf(material),
      count,
    });
    this.notify(id, 'created');
    return id;
  }

  // ---------- the item API ----------

  /** `items.attachToCarrier(itemId, carrierId)`: out of its container or off the ground, into hands. */
  attachToCarrier(itemId: EntityId, carrierId: EntityId): void {
    this.detach(itemId);
    this.mutate(itemId, { carriedBy: carrierId });
    this.notify(itemId, 'lifted');
  }

  /** `items.dropAt(itemId, tile)`: on the ground, falling where the tile has no bottom. */
  dropAt(itemId: EntityId, tile: TileIndex): void {
    if (!this.isItem(itemId) || !this.map.validIndex(tile)) return;
    this.detach(itemId);
    this.place(itemId, tile);
    this.notify(itemId, 'placed');
  }

  /** Room left in a container: units for barrels, bags and buckets, items for bins and chests. */
  room(containerId: EntityId): number {
    const c = this.container(containerId);
    if (c === undefined) return 0;
    let used = 0;
    if (this.host.facts.countsUnits(c.classId)) {
      for (const x of c.contents) used += this.get(x)?.count ?? 0;
    } else {
      used = c.contents.length;
    }
    return c.capacity - used;
  }

  /** The room an item needs in a container of a class. */
  needs(itemId: EntityId, containerClass: string): number {
    return this.host.facts.countsUnits(containerClass) ? (this.get(itemId)?.count ?? 0) : 1;
  }

  /** `items.putIn(itemId, containerId)`; false when there is no room or the target is no container. */
  putIn(itemId: EntityId, containerId: EntityId): boolean {
    const c = this.container(containerId);
    // A container never goes inside another (13: "A container is hauled with its contents"); the
    // wagon, a building's own container, holds the barrels and bags of the supplies (D-076).
    if (c === undefined || itemId === containerId || !this.isItem(itemId)) return false;
    if (this.container(itemId) !== undefined && this.isItem(containerId)) return false;
    if (this.room(containerId) < this.needs(itemId, c.classId)) return false;
    this.detach(itemId);
    const fresh = this.container(containerId) as Container;
    const contents = fresh.contents.slice();
    contents.push(itemId);
    contents.sort((a, b) => a - b);
    this.entities.add(containerId, C.Container, { ...fresh, contents });
    this.mutate(itemId, { containerId });
    this.notify(itemId, 'contained');
    return true;
  }

  /** `items.takeOut(itemId)`: out of its container, onto the container's tile. */
  takeOut(itemId: EntityId): void {
    const it = this.get(itemId);
    if (it === undefined || it.containerId === 0) return;
    const tile = this.tileOf(it.containerId);
    this.detach(itemId);
    if (tile >= 0) this.place(itemId, tile);
    this.notify(itemId, 'placed');
  }

  /**
   * `items.split(itemId, count)`: a new stack of `count` beside the old one (same tile, same
   * container; a carried stack's part goes to the carrier's tile). Returns the new id, or 0 when
   * the split is not possible.
   */
  split(itemId: EntityId, count: number): EntityId {
    const it = this.get(itemId);
    if (it === undefined || count <= 0 || count >= it.count) return 0;
    this.mutate(itemId, { count: it.count - count });
    this.notify(itemId, 'count');
    const id = this.entities.create('item');
    const part: Item = { ...it, count, containerId: 0, carriedBy: 0, reservedBy: 0, flags: it.flags & ~ItemFlag.Reserved };
    this.entities.add(id, C.Item, part);
    this.account(part, 1);
    if (it.containerId !== 0) {
      const c = this.container(it.containerId) as Container;
      const contents = c.contents.slice();
      contents.push(id);
      contents.sort((a, b) => a - b);
      this.entities.add(it.containerId, C.Container, { ...c, contents });
      this.mutate(id, { containerId: it.containerId });
      this.notify(id, 'contained');
    } else {
      const tile = this.tileOf(itemId);
      if (tile >= 0) this.place(id, tile);
      this.notify(id, 'placed');
    }
    return id;
  }

  /** Two stacks that may merge: same type, material, quality, flags and owner, within the stack size. */
  canMerge(a: EntityId, b: EntityId): boolean {
    if (a === b) return false;
    const x = this.get(a);
    const y = this.get(b);
    if (x === undefined || y === undefined) return false;
    if (this.container(a) !== undefined || this.container(b) !== undefined) return false;
    const stack = this.host.facts.row(x.type).stack;
    return (
      x.type === y.type &&
      x.material === y.material &&
      x.quality === y.quality &&
      x.flags === y.flags &&
      x.ownerId === y.ownerId &&
      x.reservedBy === y.reservedBy &&
      x.count + y.count <= stack
    );
  }

  /** `items.merge(a, b)`: `b` joins stack `a` and is gone; the units and the value are unchanged. */
  merge(a: EntityId, b: EntityId): boolean {
    if (!this.canMerge(a, b)) return false;
    const y = this.item(b);
    this.detach(b);
    this.account(this.item(b), -1);
    this.entities.destroy(b);
    this.mutate(a, { count: this.item(a).count + y.count });
    this.notify(b, 'destroyed');
    this.notify(a, 'count');
    return true;
  }

  /** `items.consume(itemId, count)`: use up part of a stack, or all of it. */
  consume(itemId: EntityId, count: number): void {
    const it = this.get(itemId);
    if (it === undefined || count <= 0) return;
    if (count >= it.count) {
      this.destroy(itemId, 'consumed');
      return;
    }
    this.mutate(itemId, { count: it.count - count });
    this.notify(itemId, 'count');
  }

  /**
   * `items.destroy(itemId, reason)`: `ItemDestroyed { id, type, reason, crafterId }`. A container's
   * contents are left where it was.
   */
  destroy(itemId: EntityId, reason: string): void {
    const it = this.get(itemId);
    if (it === undefined) return;
    const c = this.container(itemId);
    if (c !== undefined && c.contents.length > 0) {
      const tile = this.tileOf(itemId);
      for (const inner of c.contents.slice()) {
        this.detach(inner);
        if (tile >= 0) this.place(inner, tile);
        this.notify(inner, 'placed');
      }
    }
    this.detach(itemId);
    const last = this.item(itemId);
    this.account(last, -1);
    this.entities.destroy(itemId);
    this.host.emit({ type: 'ItemDestroyed', id: itemId, itemType: this.host.facts.row(last.type).id, reason, crafterId: last.crafterId, quality: last.quality });
    this.notify(itemId, 'destroyed');
  }

  /** `items.setFlag(itemId, flag, on)`. */
  setFlag(itemId: EntityId, flag: number, on: boolean): void {
    const it = this.get(itemId);
    if (it === undefined) return;
    const flags = on ? it.flags | flag : it.flags & ~flag;
    if (flags === it.flags) return;
    this.mutate(itemId, { flags });
    this.notify(itemId, 'flags');
  }

  hasFlag(itemId: EntityId, flag: number): boolean {
    return ((this.get(itemId)?.flags ?? 0) & flag) !== 0;
  }

  /** `items.setOwner(itemId, dwarfId)`: 0 clears; the `owned` flag follows. */
  setOwner(itemId: EntityId, dwarfId: EntityId): void {
    const it = this.get(itemId);
    if (it === undefined) return;
    const flags = dwarfId !== 0 ? it.flags | ItemFlag.Owned : it.flags & ~ItemFlag.Owned;
    this.mutate(itemId, { ownerId: dwarfId, flags });
    this.notify(itemId, 'flags');
  }

  /** 11: `items.setFlag(it, Reserved, true); Item[it].reservedBy = job.id`. */
  reserve(itemId: EntityId, jobId: number): void {
    const it = this.get(itemId);
    if (it === undefined) return;
    this.mutate(itemId, { reservedBy: jobId, flags: it.flags | ItemFlag.Reserved });
    this.notify(itemId, 'flags');
  }

  /** 11: the reservation ends; `ItemReleased` is 11's event. */
  release(itemId: EntityId): void {
    const it = this.get(itemId);
    if (it === undefined || (it.reservedBy === 0 && (it.flags & ItemFlag.Reserved) === 0)) return;
    this.mutate(itemId, { reservedBy: 0, flags: it.flags & ~ItemFlag.Reserved });
    this.notify(itemId, 'flags');
  }

  /**
   * `install(itemId)`: the item is linked to a built piece of furniture (14 § Placement): it leaves
   * the ground, its container or its carrier, and carries `Installed`, which keeps it out of every
   * search and of the available stock while it still counts in the totals and the wealth (D-074).
   */
  install(itemId: EntityId): void {
    if (!this.isItem(itemId)) return;
    this.detach(itemId);
    const it = this.item(itemId);
    this.mutate(itemId, { flags: (it.flags | ItemFlag.Installed) & ~ItemFlag.Reserved, reservedBy: 0 });
    this.notify(itemId, 'flags');
  }

  /** `uninstall(itemId, tile)`: deconstruction returns the linked item to the ground (14 § Placement). */
  uninstall(itemId: EntityId, tile: TileIndex): void {
    const it = this.get(itemId);
    if (it === undefined || !this.map.validIndex(tile)) return;
    this.mutate(itemId, { flags: it.flags & ~ItemFlag.Installed });
    this.place(itemId, tile);
    this.notify(itemId, 'placed');
  }

  /** Set the crafter (12 writes it after `spawn.item`; 13's `ItemDestroyed` carries it). */
  setCrafter(itemId: EntityId, crafterId: EntityId): void {
    if (this.isItem(itemId)) this.mutate(itemId, { crafterId });
  }

  /** 13 § Rot: change stage and, when needed, the stock category through the accounting path. */
  setRot(itemId: EntityId, stage: 0 | 1 | 2 | 3, type?: number, material?: number): void {
    if (!this.isItem(itemId)) return;
    this.mutate(itemId, { rotStage: stage, ...(type === undefined ? {} : { type }), ...(material === undefined ? {} : { material }) });
    this.notify(itemId, 'flags');
  }

  // ---------- falling ----------

  /** Items on a tile that no longer has a bottom fall (13 § Events consumed, `TilesChanged`). */
  settleTile(tile: TileIndex, entitiesAt: (i: TileIndex) => readonly EntityId[]): void {
    const land = this.landingTile(tile);
    if (land === tile) return;
    for (const id of this.itemsOn(tile, entitiesAt)) {
      this.place(id, land);
      this.notify(id, 'placed');
    }
  }

  // ---------- recount ----------

  /** A full recount from the entities: `[type, total, available]` rows, and the wealth. */
  recount(): { rows: [number, number, number][]; wealth: number } {
    const per = new Map<number, [number, number]>();
    let wealth = 0;
    for (const id of this.entities.with(C.Item)) {
      const it = this.item(id);
      if (!this.counted(it)) continue;
      const row = per.get(it.type) ?? [0, 0];
      row[0] += it.count;
      if (isAvailable(it.flags)) row[1] += it.count;
      per.set(it.type, row);
      wealth += this.valueOf(it);
    }
    const rows = Array.from(per.keys())
      .sort((a, b) => a - b)
      .map((t): [number, number, number] => {
        const r = per.get(t) as [number, number];
        return [t, r[0], r[1]];
      });
    return { rows, wealth };
  }
}
