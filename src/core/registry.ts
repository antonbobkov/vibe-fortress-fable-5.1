/**
 * The content registry.
 *
 * Implements `01-architecture/content-pipeline.md` § Loading steps 4-7 and § Reading content from
 * systems. The registry is generic: it knows about tables of rows with string ids, dense indices
 * and derived structures, but nothing about the game's row types. The typed facade lives in
 * `src/content/loader.ts`, because `src/core` may not import `@content`.
 */

/** Every content row has a string id. */
export interface Row {
  readonly id: string;
}

/**
 * One table. Indices run from 1; 0 is reserved for "none" everywhere
 * (`content-pipeline.md` § Loading step 4).
 */
export interface RegistryTable<T extends Row> {
  readonly name: string;
  /** Rows in index order; `rows[0]` does not exist, so this is 1-based. */
  readonly rows: readonly T[];
  readonly size: number;
  byId(id: string): T | undefined;
  byIndex(index: number): T | undefined;
  /** Throws for an unknown id. Used by tests and content-driven code paths only. */
  index(id: string): number;
  idOf(index: number): string;
  has(id: string): boolean;
  /** Frozen, memoised by the predicate's identity. */
  where(key: string, predicate: (row: T) => boolean): readonly T[];
  ids(): readonly string[];
}

class Table<T extends Row> implements RegistryTable<T> {
  readonly name: string;
  readonly rows: readonly T[];
  private readonly byIdMap: ReadonlyMap<string, T>;
  private readonly indexMap: ReadonlyMap<string, number>;
  private readonly cache = new Map<string, readonly T[]>();
  private readonly sortedIds: readonly string[];

  constructor(name: string, sortedRows: readonly T[]) {
    this.name = name;
    // Index 0 is "none": the row array is 1-based, with a hole at 0.
    const rows: T[] = new Array<T>(sortedRows.length + 1);
    const byId = new Map<string, T>();
    const indices = new Map<string, number>();
    sortedRows.forEach((row, i) => {
      const index = i + 1;
      rows[index] = row;
      byId.set(row.id, row);
      indices.set(row.id, index);
    });
    this.rows = rows;
    this.byIdMap = byId;
    this.indexMap = indices;
    this.sortedIds = sortedRows.map((r) => r.id);
  }

  get size(): number {
    return this.byIdMap.size;
  }

  byId(id: string): T | undefined {
    return this.byIdMap.get(id);
  }

  byIndex(index: number): T | undefined {
    return index <= 0 ? undefined : this.rows[index];
  }

  index(id: string): number {
    const i = this.indexMap.get(id);
    if (i === undefined) throw new RangeError(`${this.name}: unknown id "${id}"`);
    return i;
  }

  idOf(index: number): string {
    const row = this.byIndex(index);
    if (row === undefined) throw new RangeError(`${this.name}: unknown index ${index}`);
    return row.id;
  }

  has(id: string): boolean {
    return this.byIdMap.has(id);
  }

  where(key: string, predicate: (row: T) => boolean): readonly T[] {
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const out = Object.freeze(this.sortedIds.map((id) => this.byIdMap.get(id) as T).filter(predicate));
    this.cache.set(key, out);
    return out;
  }

  ids(): readonly string[] {
    return this.sortedIds;
  }
}

/** Build a table, sorting rows by id as `content-pipeline.md` § Loading step 4 requires. */
export function makeTable<T extends Row>(name: string, rows: readonly T[]): RegistryTable<T> {
  const sorted = rows.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i]?.id === sorted[i - 1]?.id) {
      throw new Error(`${name}: duplicate id "${sorted[i]?.id}"`);
    }
  }
  return new Table(name, Object.freeze(sorted.map((r) => Object.freeze(r))));
}

/**
 * A stable 32-bit hash over the canonical JSON of the loaded content, used for the save
 * compatibility check of `persistence.md`.
 */
export function contentHashOf(tables: Readonly<Record<string, unknown>>): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const name of Object.keys(tables).sort()) {
    const text = `${name}:${canonicalJson(tables[name])}`;
    for (let i = 0; i < text.length; i += 1) {
      const c = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 + c + i, 0x85ebca6b) >>> 0;
    }
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

/** JSON with object keys in sorted order, so the hash does not depend on key order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

/** The immutable registry handed to every system. */
export class Registry {
  private readonly tables: ReadonlyMap<string, RegistryTable<Row>>;
  private readonly derivedValues: ReadonlyMap<string, unknown>;
  readonly contentHash: string;

  constructor(
    tables: ReadonlyMap<string, RegistryTable<Row>>,
    derived: ReadonlyMap<string, unknown>,
    contentHash: string,
  ) {
    this.tables = tables;
    this.derivedValues = derived;
    this.contentHash = contentHash;
    Object.freeze(this);
  }

  table<T extends Row>(name: string): RegistryTable<T> {
    const t = this.tables.get(name);
    if (t === undefined) throw new RangeError(`registry: no table "${name}"`);
    return t as RegistryTable<T>;
  }

  hasTable(name: string): boolean {
    return this.tables.has(name);
  }

  tableNames(): readonly string[] {
    return Array.from(this.tables.keys()).sort();
  }

  derived<T>(name: string): T {
    if (!this.derivedValues.has(name)) throw new RangeError(`registry: no derived structure "${name}"`);
    return this.derivedValues.get(name) as T;
  }

  hasDerived(name: string): boolean {
    return this.derivedValues.has(name);
  }
}
