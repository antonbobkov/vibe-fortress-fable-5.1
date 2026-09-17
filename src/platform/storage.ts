/**
 * Persistent storage.
 *
 * Implements `01-architecture/persistence.md` § Storage: IndexedDB with the three object stores
 * `saves`, `legends` and `settings`, plus the in-memory adapter the tests and the headless runner
 * use. Nothing above `platform` knows which of the two it is talking to.
 */

export type StoreName = 'saves' | 'legends' | 'settings';

/** The three object stores of `persistence.md` § Storage, in the order the database creates them. */
export const STORE_NAMES: readonly StoreName[] = Object.freeze(['saves', 'legends', 'settings']);

export interface StoredRecord<T> {
  readonly key: string;
  readonly value: T;
}

export interface StorageAdapter {
  readonly kind: 'indexeddb' | 'memory';
  put(store: StoreName, key: string, value: unknown): Promise<void>;
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  /** Keys of a store, ascending, so listings never depend on insertion order. */
  keys(store: StoreName): Promise<string[]>;
  all<T>(store: StoreName): Promise<StoredRecord<T>[]>;
  delete(store: StoreName, key: string): Promise<void>;
  clear(store: StoreName): Promise<void>;
  close(): void;
}

/** `persistence.md` § Failure handling: the app keeps running and offers export. */
export class StorageQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

/** The adapter the tests, the headless runner and any platform without IndexedDB use. */
export class MemoryStorage implements StorageAdapter {
  readonly kind = 'memory';
  private readonly stores = new Map<StoreName, Map<string, unknown>>();

  constructor() {
    for (let k = 0; k < STORE_NAMES.length; k += 1) {
      this.stores.set(STORE_NAMES[k] as StoreName, new Map<string, unknown>());
    }
  }

  private storeOf(store: StoreName): Map<string, unknown> {
    const found = this.stores.get(store);
    if (found === undefined) throw new RangeError(`no object store named ${store}`);
    return found;
  }

  put(store: StoreName, key: string, value: unknown): Promise<void> {
    this.storeOf(store).set(key, value);
    return Promise.resolve();
  }

  get<T>(store: StoreName, key: string): Promise<T | undefined> {
    return Promise.resolve(this.storeOf(store).get(key) as T | undefined);
  }

  keys(store: StoreName): Promise<string[]> {
    return Promise.resolve(Array.from(this.storeOf(store).keys()).sort());
  }

  async all<T>(store: StoreName): Promise<StoredRecord<T>[]> {
    const keys = await this.keys(store);
    const map = this.storeOf(store);
    return keys.map((key) => ({ key, value: map.get(key) as T }));
  }

  delete(store: StoreName, key: string): Promise<void> {
    this.storeOf(store).delete(key);
    return Promise.resolve();
  }

  clear(store: StoreName): Promise<void> {
    this.storeOf(store).clear();
    return Promise.resolve();
  }

  close(): void {
    // Nothing to release.
  }
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = (): void => resolve(request.result);
    request.onerror = (): void => {
      const error = request.error;
      if (error !== null && error.name === 'QuotaExceededError') {
        reject(new StorageQuotaError(error.message));
        return;
      }
      reject(error ?? new Error('IndexedDB request failed'));
    };
  });
}

/** The real adapter. One database, version 1, with the three stores. */
export class IndexedDbStorage implements StorageAdapter {
  readonly kind = 'indexeddb';
  private readonly name: string;
  private db: IDBDatabase | null = null;
  private opening: Promise<IDBDatabase> | null = null;

  constructor(name = 'deepholm') {
    this.name = name;
  }

  private open(): Promise<IDBDatabase> {
    if (this.db !== null) return Promise.resolve(this.db);
    if (this.opening !== null) return this.opening;
    this.opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.name, 1) as IDBOpenDBRequest;
      request.onupgradeneeded = (): void => {
        const db = request.result;
        for (let k = 0; k < STORE_NAMES.length; k += 1) {
          const store = STORE_NAMES[k] as StoreName;
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
        }
      };
      request.onsuccess = (): void => {
        this.db = request.result;
        resolve(request.result);
      };
      request.onerror = (): void => reject(request.error ?? new Error('IndexedDB open failed'));
    });
    return this.opening;
  }

  private async transaction(store: StoreName, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.open();
    return db.transaction(store, mode).objectStore(store);
  }

  async put(store: StoreName, key: string, value: unknown): Promise<void> {
    const objectStore = await this.transaction(store, 'readwrite');
    await wrap(objectStore.put(value, key));
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const objectStore = await this.transaction(store, 'readonly');
    return (await wrap(objectStore.get(key))) as T | undefined;
  }

  async keys(store: StoreName): Promise<string[]> {
    const objectStore = await this.transaction(store, 'readonly');
    const keys = await wrap(objectStore.getAllKeys());
    return keys.map((k) => String(k)).sort();
  }

  async all<T>(store: StoreName): Promise<StoredRecord<T>[]> {
    const objectStore = await this.transaction(store, 'readonly');
    const keys = (await wrap(objectStore.getAllKeys())).map((k) => String(k));
    const values = (await wrap(objectStore.getAll())) as T[];
    const rows = keys.map((key, i) => ({ key, value: values[i] as T }));
    rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    return rows;
  }

  async delete(store: StoreName, key: string): Promise<void> {
    const objectStore = await this.transaction(store, 'readwrite');
    await wrap(objectStore.delete(key));
  }

  async clear(store: StoreName): Promise<void> {
    const objectStore = await this.transaction(store, 'readwrite');
    await wrap(objectStore.clear());
  }

  close(): void {
    this.db?.close();
    this.db = null;
    this.opening = null;
  }
}

/** IndexedDB where the platform has it, the in-memory adapter where it does not. */
export function createStorage(name = 'deepholm'): StorageAdapter {
  const holder = globalThis as unknown as Record<string, unknown>;
  if (typeof holder['indexedDB'] === 'object' && holder['indexedDB'] !== null) {
    return new IndexedDbStorage(name);
  }
  return new MemoryStorage();
}
