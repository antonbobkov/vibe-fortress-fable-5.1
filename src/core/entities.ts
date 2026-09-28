/**
 * The entity store.
 *
 * Implements `01-architecture/data-model.md` § Entities: 32-bit ids with a generation, one `Kind`
 * per entity, the store API, and the split between structure-of-arrays storage for the hot
 * components and `Map` storage with a sorted index list for the rest.
 *
 * Iteration order is ascending slot index, which is the entity table order the world hash uses.
 * See DECISIONS.md D-007.
 */

import type { EntityId } from './types';

// ---------- ids ----------

export const ENTITY_INDEX_BITS = 24;
export const ENTITY_INDEX_MASK = 0x00ffffff;
export const ENTITY_MAX_INDEX = ENTITY_INDEX_MASK;
export const ENTITY_GENERATION_MASK = 0xff;

/** The reserved "no entity" id. Component fields use 0 for "none". */
export const NO_ENTITY: EntityId = 0;

/** Bits 0-23 of an id. */
export function entityIndex(id: EntityId): number {
  return id & ENTITY_INDEX_MASK;
}

/** Bits 24-31 of an id. */
export function entityGeneration(id: EntityId): number {
  return (id >>> ENTITY_INDEX_BITS) & ENTITY_GENERATION_MASK;
}

/** Compose an id. Generations start at 1, so a valid id is never 0. */
export function makeEntityId(index: number, generation: number): EntityId {
  return (((generation & ENTITY_GENERATION_MASK) << ENTITY_INDEX_BITS) | (index & ENTITY_INDEX_MASK)) >>> 0;
}

// ---------- kinds ----------

/** `data-model.md` § Kinds. */
export const ENTITY_KINDS = [
  'creature',
  'item',
  'building',
  'zone',
  'stockpile',
  'squad',
  'party',
  'projectile',
  'crop',
  'room',
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export function entityKindIndex(kind: EntityKind): number {
  const i = ENTITY_KINDS.indexOf(kind);
  if (i < 0) throw new RangeError(`unknown entity kind: ${kind}`);
  return i;
}

// ---------- component storage ----------

/**
 * A component's backing store, addressed by entity *index* (not id). Every implementation keeps
 * {@link indices} sorted ascending so iteration order is fixed.
 */
export interface ComponentStore<T> {
  has(index: number): boolean;
  get(index: number): T | undefined;
  set(index: number, value: T): void;
  remove(index: number): boolean;
  /** Sorted ascending. The returned array is the store's own; callers must not mutate it. */
  indices(): readonly number[];
  readonly size: number;
  clear(): void;
}

/** Binary search for `value` in a sorted array; returns the insertion point. */
function lowerBound(list: readonly number[], value: number): number {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((list[mid] as number) < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Shared bookkeeping of the sorted index list. */
abstract class SortedIndexStore<T> implements ComponentStore<T> {
  protected readonly order: number[] = [];

  abstract has(index: number): boolean;
  abstract get(index: number): T | undefined;
  protected abstract write(index: number, value: T): void;
  protected abstract erase(index: number): void;
  abstract clear(): void;

  set(index: number, value: T): void {
    if (!this.has(index)) {
      this.order.splice(lowerBound(this.order, index), 0, index);
    }
    this.write(index, value);
  }

  remove(index: number): boolean {
    if (!this.has(index)) return false;
    const at = lowerBound(this.order, index);
    if (this.order[at] === index) this.order.splice(at, 1);
    this.erase(index);
    return true;
  }

  indices(): readonly number[] {
    return this.order;
  }

  get size(): number {
    return this.order.length;
  }
}

/** `Map<index, T>` storage, iterated through the sorted index list. */
export class MapComponentStore<T> extends SortedIndexStore<T> {
  private readonly values = new Map<number, T>();

  override has(index: number): boolean {
    return this.values.has(index);
  }

  override get(index: number): T | undefined {
    return this.values.get(index);
  }

  protected override write(index: number, value: T): void {
    this.values.set(index, value);
  }

  protected override erase(index: number): void {
    this.values.delete(index);
  }

  override clear(): void {
    this.values.clear();
    this.order.length = 0;
  }
}

/**
 * Structure-of-arrays storage for a hot component. Fields live in parallel typed arrays indexed
 * by entity index; `get` materialises an object, `set` writes the fields.
 */
export abstract class SoaComponentStore<T> extends SortedIndexStore<T> {
  private present: Uint8Array;
  protected capacity: number;

  constructor(initialCapacity = 1024) {
    super();
    this.capacity = Math.max(1, initialCapacity);
    this.present = new Uint8Array(this.capacity);
    this.allocate(this.capacity);
  }

  /** Allocate or reallocate the field arrays to `capacity`, preserving existing values. */
  protected abstract allocate(capacity: number): void;

  protected abstract readField(index: number): T;
  protected abstract writeField(index: number, value: T): void;
  protected abstract clearField(index: number): void;

  protected grow(index: number): void {
    if (index < this.capacity) return;
    let next = this.capacity;
    while (next <= index) next *= 2;
    const present = new Uint8Array(next);
    present.set(this.present);
    this.present = present;
    this.capacity = next;
    this.allocate(next);
  }

  override has(index: number): boolean {
    return index < this.capacity && this.present[index] === 1;
  }

  override get(index: number): T | undefined {
    return this.has(index) ? this.readField(index) : undefined;
  }

  override set(index: number, value: T): void {
    this.grow(index);
    if (this.present[index] !== 1) {
      this.present[index] = 1;
      this.order.splice(lowerBound(this.order, index), 0, index);
    }
    this.writeField(index, value);
  }

  protected override write(index: number, value: T): void {
    this.writeField(index, value);
  }

  protected override erase(index: number): void {
    this.present[index] = 0;
    this.clearField(index);
  }

  override clear(): void {
    this.present.fill(0);
    this.order.length = 0;
  }
}

/** Growable typed-array helper for SoA stores. */
export function growInt16(old: Int16Array | undefined, capacity: number): Int16Array {
  const next = new Int16Array(capacity);
  if (old !== undefined) next.set(old.subarray(0, Math.min(old.length, capacity)));
  return next;
}

export function growInt8(old: Int8Array | undefined, capacity: number): Int8Array {
  const next = new Int8Array(capacity);
  if (old !== undefined) next.set(old.subarray(0, Math.min(old.length, capacity)));
  return next;
}

export function growInt32(old: Int32Array | undefined, capacity: number): Int32Array {
  const next = new Int32Array(capacity);
  if (old !== undefined) next.set(old.subarray(0, Math.min(old.length, capacity)));
  return next;
}

export function growUint8(old: Uint8Array | undefined, capacity: number): Uint8Array {
  const next = new Uint8Array(capacity);
  if (old !== undefined) next.set(old.subarray(0, Math.min(old.length, capacity)));
  return next;
}

export function growUint16(old: Uint16Array | undefined, capacity: number): Uint16Array {
  const next = new Uint16Array(capacity);
  if (old !== undefined) next.set(old.subarray(0, Math.min(old.length, capacity)));
  return next;
}

// ---------- component types ----------

/**
 * The runtime identity of a component, carrying the ownership metadata of
 * `components.md` § Component ownership table.
 */
export interface ComponentType<T> {
  /** As written in the schema, e.g. `Position`. */
  readonly name: string;
  /** Dense index, assigned by declaration order. */
  readonly id: number;
  /** The one system that writes it: a system number, `core` or `spawner`. */
  readonly owner: string;
  /** Free-text qualification of the owner cell, e.g. "caravan parties: 20". */
  readonly ownerNote: string;
  /** The "Written also by" cell, split on commas. */
  readonly alsoWrittenBy: readonly string[];
  readonly storage: 'soa' | 'map';
  makeStore(): ComponentStore<T>;
}

// ---------- the store ----------

export type DestroyListener = (id: EntityId, kind: EntityKind) => void;

/** `data-model.md` § Store API. */
export class EntityStore {
  private readonly generations: number[] = [];
  private readonly aliveFlags: boolean[] = [];
  private readonly kindOf: number[] = [];
  private readonly free: number[] = [];
  private readonly stores: ComponentStore<unknown>[];
  private readonly types: readonly ComponentType<unknown>[];
  private readonly byKind: number[][];
  private destroyListener: DestroyListener | null = null;
  private liveCount = 0;

  constructor(types: readonly ComponentType<unknown>[]) {
    this.types = types;
    this.stores = types.map((t) => t.makeStore());
    this.byKind = ENTITY_KINDS.map(() => []);
  }

  /** The component types this store knows, in declaration order. */
  componentTypes(): readonly ComponentType<unknown>[] {
    return this.types;
  }

  /** Called with every destroyed id so the world can queue `DestroyedEntity`. */
  setDestroyListener(listener: DestroyListener | null): void {
    this.destroyListener = listener;
  }

  /** Number of living entities. */
  get count(): number {
    return this.liveCount;
  }

  /** Number of slots ever allocated, living or not. */
  get slotCount(): number {
    return this.generations.length;
  }

  create(kind: EntityKind): EntityId {
    const k = entityKindIndex(kind);
    let index: number;
    if (this.free.length > 0) {
      index = this.free.pop() as number;
      const gen = ((this.generations[index] as number) + 1) & ENTITY_GENERATION_MASK;
      // Generation 0 is reserved so that no valid id is ever 0.
      this.generations[index] = gen === 0 ? 1 : gen;
    } else {
      index = this.generations.length;
      if (index > ENTITY_MAX_INDEX) throw new RangeError('entity index space exhausted');
      this.generations.push(1);
      this.aliveFlags.push(false);
      this.kindOf.push(0);
    }
    this.aliveFlags[index] = true;
    this.kindOf[index] = k;
    const bucket = this.byKind[k] as number[];
    bucket.splice(lowerBound(bucket, index), 0, index);
    this.liveCount += 1;
    return makeEntityId(index, this.generations[index] as number);
  }

  /** Remove every component, bump the slot generation and notify the destroy listener. */
  destroy(id: EntityId): void {
    if (!this.alive(id)) return;
    const index = entityIndex(id);
    const k = this.kindOf[index] as number;
    for (let c = 0; c < this.stores.length; c += 1) (this.stores[c] as ComponentStore<unknown>).remove(index);
    const bucket = this.byKind[k] as number[];
    const at = lowerBound(bucket, index);
    if (bucket[at] === index) bucket.splice(at, 1);
    this.aliveFlags[index] = false;
    this.liveCount -= 1;
    const nextGen = ((this.generations[index] as number) + 1) & ENTITY_GENERATION_MASK;
    this.generations[index] = nextGen === 0 ? 1 : nextGen;
    this.free.push(index);
    this.destroyListener?.(id, ENTITY_KINDS[k] as EntityKind);
  }

  alive(id: EntityId): boolean {
    if (id === NO_ENTITY) return false;
    const index = entityIndex(id);
    if (index >= this.generations.length) return false;
    return this.aliveFlags[index] === true && this.generations[index] === entityGeneration(id);
  }

  /** The `Kind` of a living entity, or undefined. */
  kind(id: EntityId): EntityKind | undefined {
    if (!this.alive(id)) return undefined;
    return ENTITY_KINDS[this.kindOf[entityIndex(id)] as number];
  }

  /** The current id of a slot, whether or not it is alive. */
  idOfIndex(index: number): EntityId {
    return makeEntityId(index, this.generations[index] ?? 0);
  }

  private storeOf<T>(type: ComponentType<T>): ComponentStore<T> {
    const store = this.stores[type.id];
    if (store === undefined) throw new RangeError(`unknown component type: ${type.name}`);
    return store as ComponentStore<T>;
  }

  add<T>(id: EntityId, type: ComponentType<T>, value: T): void {
    if (!this.alive(id)) throw new RangeError(`add ${type.name} to a dead entity ${id}`);
    this.storeOf(type).set(entityIndex(id), value);
  }

  get<T>(id: EntityId, type: ComponentType<T>): T | undefined {
    if (!this.alive(id)) return undefined;
    return this.storeOf(type).get(entityIndex(id));
  }

  has<T>(id: EntityId, type: ComponentType<T>): boolean {
    if (!this.alive(id)) return false;
    return this.storeOf(type).has(entityIndex(id));
  }

  remove<T>(id: EntityId, type: ComponentType<T>): void {
    if (!this.alive(id)) return;
    this.storeOf(type).remove(entityIndex(id));
  }

  /** Every living entity of a kind, ascending. */
  each(kind: EntityKind, fn: (id: EntityId) => void): void {
    const bucket = this.byKind[entityKindIndex(kind)] as number[];
    // A copy, so that the callback may create or destroy entities.
    const snapshot = bucket.slice();
    for (let i = 0; i < snapshot.length; i += 1) {
      const index = snapshot[i] as number;
      if (this.aliveFlags[index] !== true) continue;
      fn(this.idOfIndex(index));
    }
  }

  /** How many living entities of a kind there are, without walking them. */
  countOfKind(kind: EntityKind): number {
    return (this.byKind[entityKindIndex(kind)] as number[]).length;
  }

  /** The ids of every living entity of a kind, ascending. */
  ofKind(kind: EntityKind): EntityId[] {
    const bucket = this.byKind[entityKindIndex(kind)] as number[];
    return bucket.map((index) => this.idOfIndex(index));
  }

  /**
   * Every living entity that has all the listed components, ascending. The scan walks the
   * smallest component's sorted index list, so the order does not depend on which argument is
   * which.
   */
  with(a: ComponentType<unknown>, b?: ComponentType<unknown>, c?: ComponentType<unknown>): EntityId[] {
    const types: ComponentType<unknown>[] = [a];
    if (b !== undefined) types.push(b);
    if (c !== undefined) types.push(c);
    let smallest = this.storeOf(types[0] as ComponentType<unknown>);
    for (let i = 1; i < types.length; i += 1) {
      const s = this.storeOf(types[i] as ComponentType<unknown>);
      if (s.size < smallest.size) smallest = s;
    }
    const out: EntityId[] = [];
    const list = smallest.indices();
    outer: for (let i = 0; i < list.length; i += 1) {
      const index = list[i] as number;
      if (this.aliveFlags[index] !== true) continue;
      for (let t = 0; t < types.length; t += 1) {
        if (!this.storeOf(types[t] as ComponentType<unknown>).has(index)) continue outer;
      }
      out.push(this.idOfIndex(index));
    }
    return out;
  }

  /** {@link with}, without the intermediate array. */
  forEachWith(
    a: ComponentType<unknown>,
    fn: (id: EntityId) => void,
    b?: ComponentType<unknown>,
    c?: ComponentType<unknown>,
  ): void {
    const ids = this.with(a, b, c);
    for (let i = 0; i < ids.length; i += 1) fn(ids[i] as EntityId);
  }

  /** Every living entity, ascending by slot index. The canonical order for hashing and saving. */
  allIds(): EntityId[] {
    const out: EntityId[] = [];
    for (let index = 0; index < this.generations.length; index += 1) {
      if (this.aliveFlags[index] === true) out.push(this.idOfIndex(index));
    }
    return out;
  }

  /** Direct access to a component store, for serialization and hashing. */
  store<T>(type: ComponentType<T>): ComponentStore<T> {
    return this.storeOf(type);
  }

  /**
   * The slot table for a save (`schemas/system-state.md` `EntityStoreState.slots`): one row per
   * slot ever allocated, living or not, plus the free list in its pop order, because the next
   * `create` reuses the last freed slot (DECISIONS.md D-079).
   */
  exportSlots(): { slots: { generation: number; alive: boolean; kind: EntityKind }[]; free: number[] } {
    const slots = this.generations.map((generation, index) => ({
      generation,
      alive: this.aliveFlags[index] === true,
      kind: ENTITY_KINDS[this.kindOf[index] as number] as EntityKind,
    }));
    return { slots, free: this.free.slice() };
  }

  /**
   * Replace every slot (and drop every component) from a saved slot table; the components are
   * restored afterwards through {@link store}. The inverse of {@link exportSlots}.
   */
  importSlots(slots: readonly { generation: number; alive: boolean; kind: EntityKind }[], free: readonly number[]): void {
    this.clear();
    for (let index = 0; index < slots.length; index += 1) {
      const slot = slots[index] as { generation: number; alive: boolean; kind: EntityKind };
      const k = entityKindIndex(slot.kind);
      this.generations.push(slot.generation);
      this.aliveFlags.push(slot.alive);
      this.kindOf.push(k);
      if (slot.alive) {
        (this.byKind[k] as number[]).push(index);
        this.liveCount += 1;
      }
    }
    this.free.push(...free);
  }

  /** Reset to an empty store. */
  clear(): void {
    for (let c = 0; c < this.stores.length; c += 1) (this.stores[c] as ComponentStore<unknown>).clear();
    this.generations.length = 0;
    this.aliveFlags.length = 0;
    this.kindOf.length = 0;
    this.free.length = 0;
    for (let k = 0; k < this.byKind.length; k += 1) (this.byKind[k] as number[]).length = 0;
    this.liveCount = 0;
  }
}
