/**
 * `readers.of('13')`: `02-systems/13-items-and-storage.md` § Interfaces › Reader. Records and
 * arrays returned are fresh copies; entity references are ids.
 */

import { C, type Container, type Item } from '@core/components';
import type { EntityReader } from '@core/readers';
import type { EntityId, MovementClass, TileIndex } from '@core/types';
import type { ItemCore } from './api';
import type { ItemTypeRow } from './facts';
import type { ItemFilter, ItemSearch, SearchOptions } from './search';

export interface StockCountView {
  readonly total: number;
  readonly available: number;
  readonly byQuality: readonly number[];
}

export interface ItemsReader {
  /** The `Item` record (a copy). */
  get(id: EntityId): Item | undefined;
  /** `value(item)` in marks. */
  value(id: EntityId): number;
  /** Rot stage 0 … 3 (rot arrives with T-M4-15; 0 until then). */
  rotStage(id: EntityId): number;
  /** Miasma on a tile (T-M4-15; false until then). */
  isMiasma(i: TileIndex): boolean;
  /** The items lying on a tile, ascending. */
  at(i: TileIndex): EntityId[];
  /** A container's contents, ascending. */
  inContainer(id: EntityId): EntityId[];
  /** The container an item is in, or 0. */
  containerOf(id: EntityId): EntityId;
  /** The tile an item is on, directly or through its container or carrier; -1 when nowhere. */
  tileOf(id: EntityId): TileIndex;
  /** Units of a type in the fortress (`typeId` is an item id or registry index). */
  count(typeId: string | number): number;
  /** `module-interfaces.md`'s `readers.items.countOf(typeId)`: the same as {@link count}. */
  countOf(typeId: string | number): number;
  /** Units not forbidden, not reserved, not owned. */
  available(typeId: string | number): number;
  /** The stock count of a type (units). */
  stock(typeId: string | number): StockCountView;
  /** The types with a non-zero count, ascending registry index. */
  stockedTypes(): number[];
  /** Fortress wealth: items plus buildings (13 § Value). */
  wealth(): number;
  /** The item type row. */
  def(typeId: string | number): ItemTypeRow | undefined;
  /** The category path of a type (`food/meat/raw`). */
  categoryOf(typeId: string | number): string;
  /** Room left in a container (units for barrels and bags, items for bins and chests). */
  room(containerId: EntityId): number;
  /** The `Container` record (a copy). */
  containerRecord(id: EntityId): Container | undefined;
  /**
   * `items.findItem(filter, fromTile, movementClass, { reservable: true })`: the nearest matching
   * item reachable from `from`, or 0. Cost: an expanding radius search, then the stock index.
   */
  findItem(filter: ItemFilter, from: TileIndex, movementClass?: MovementClass, opts?: SearchOptions): EntityId;
  /** `items.findItems(filter, count, fromTile, movementClass)`: up to `count` items, nearest first. */
  findItems(filter: ItemFilter, count: number, from: TileIndex, movementClass?: MovementClass, opts?: SearchOptions): EntityId[];
  /** `items.countAvailable(filter)`: units not forbidden, reserved or owned. */
  countAvailable(filter: ItemFilter): number;
  /** Units of matching items whatever their flags. */
  countMatching(filter: ItemFilter): number;
}

export function makeReader(core: ItemCore, entities: EntityReader, search: ItemSearch): ItemsReader {
  const facts = core.host.facts;
  const typeOf = (typeId: string | number): number => (typeof typeId === 'number' ? typeId : facts.typeIndex(typeId));
  return {
    get: (id) => {
      const it = core.get(id);
      return it === undefined ? undefined : { ...it };
    },
    value: (id) => core.value(id),
    rotStage: (id) => core.get(id)?.rotStage ?? 0,
    isMiasma: () => false,
    at: (i) => entities.at(i).filter((id) => core.isItem(id)),
    inContainer: (id) => (core.container(id)?.contents ?? []).slice(),
    containerOf: (id) => core.get(id)?.containerId ?? 0,
    tileOf: (id) => core.tileOf(id),
    count: (typeId) => core.counts.total(typeOf(typeId)),
    countOf: (typeId) => core.counts.total(typeOf(typeId)),
    available: (typeId) => core.counts.available(typeOf(typeId)),
    stock: (typeId) => {
      const t = typeOf(typeId);
      return { total: core.counts.total(t), available: core.counts.available(t), byQuality: core.counts.byQuality(t) };
    },
    stockedTypes: () => core.counts.types(),
    wealth: () => core.wealth + core.buildingWealth,
    def: (typeId) => facts.types[typeOf(typeId)],
    categoryOf: (typeId) => facts.types[typeOf(typeId)]?.category ?? '',
    room: (id) => core.room(id),
    containerRecord: (id) => {
      const c = core.container(id);
      return c === undefined ? undefined : { ...c, contents: c.contents.slice() };
    },
    findItem: (filter, from, cls, opts) => search.findItem(filter, from, cls, opts),
    findItems: (filter, count, from, cls, opts) => search.findItems(filter, count, from, cls, opts),
    countAvailable: (filter) => search.countAvailable(filter),
    countMatching: (filter) => search.countAll(filter),
  };
}

/** Whether an entity has an `Item` (for callers holding only the entity reader). */
export function isItemEntity(entities: EntityReader, id: EntityId): boolean {
  return entities.has(id, C.Item);
}
