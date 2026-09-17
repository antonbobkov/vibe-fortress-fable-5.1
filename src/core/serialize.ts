/**
 * Serialization helpers.
 *
 * Implements `04-implementation/save-format.md` § Serialization helpers and the serialization
 * rules of `01-architecture/persistence.md`: plain data only, typed arrays as base64 with a
 * `$type` marker, `Map` and `Set` flattened to sorted arrays, object keys written in sorted order
 * so that two runs that hold the same state write the same bytes.
 *
 * Core migrations live here (`save-format.md` § Migration); there are none yet, because
 * `formatVersion` 1 is the first published version.
 */

/** The element types a typed-array section or marker may carry (`save-format.md`). */
export type TypedArrayCode = 'u8' | 'u16' | 'u32' | 'i8' | 'i16' | 'i32';

export type TypedArray = Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array;

/** The `{ "$type": …, "$b64": … }` form a typed array takes inside a JSON section. */
export interface TypedArrayMarker {
  readonly $type: TypedArrayCode;
  readonly $b64: string;
}

export class SerializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SerializationError';
  }
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const BASE64_INVERSE: Int16Array = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < BASE64_ALPHABET.length; i += 1) {
    table[BASE64_ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

/** Standard base64 of a byte array. Written out so no platform global is needed in `core`. */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = ((bytes[i] as number) << 16) | ((bytes[i + 1] as number) << 8) | (bytes[i + 2] as number);
    out += `${BASE64_ALPHABET[(n >> 18) & 63] as string}${BASE64_ALPHABET[(n >> 12) & 63] as string}${
      BASE64_ALPHABET[(n >> 6) & 63] as string
    }${BASE64_ALPHABET[n & 63] as string}`;
  }
  const left = bytes.length - i;
  if (left === 1) {
    const n = (bytes[i] as number) << 16;
    out += `${BASE64_ALPHABET[(n >> 18) & 63] as string}${BASE64_ALPHABET[(n >> 12) & 63] as string}==`;
  } else if (left === 2) {
    const n = ((bytes[i] as number) << 16) | ((bytes[i + 1] as number) << 8);
    out += `${BASE64_ALPHABET[(n >> 18) & 63] as string}${BASE64_ALPHABET[(n >> 12) & 63] as string}${
      BASE64_ALPHABET[(n >> 6) & 63] as string
    }=`;
  }
  return out;
}

/** Inverse of {@link bytesToBase64}. Throws on a character outside the alphabet. */
export function base64ToBytes(text: string): Uint8Array {
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === 61) end -= 1; // strip '='
  const out = new Uint8Array(Math.floor((end * 3) / 4));
  let at = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < end; i += 1) {
    const code = text.charCodeAt(i);
    const value = code < 128 ? (BASE64_INVERSE[code] as number) : -1;
    if (value < 0) throw new SerializationError(`not base64 at index ${i}: ${text[i] as string}`);
    acc = (acc << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[at] = (acc >> bits) & 0xff;
      at += 1;
    }
  }
  return out;
}

const CODE_OF: readonly [TypedArrayCode, new (n: number) => TypedArray][] = [
  ['u8', Uint8Array],
  ['u16', Uint16Array],
  ['u32', Uint32Array],
  ['i8', Int8Array],
  ['i16', Int16Array],
  ['i32', Int32Array],
];

/** The `save-format.md` element-type code of a typed array. */
export function typedArrayCode(value: TypedArray): TypedArrayCode {
  for (let k = 0; k < CODE_OF.length; k += 1) {
    const row = CODE_OF[k] as [TypedArrayCode, new (n: number) => TypedArray];
    if (value instanceof row[1]) return row[0];
  }
  throw new SerializationError(`unsupported typed array: ${value.constructor.name}`);
}

/** Build an empty typed array for a code. */
export function typedArrayOf(code: TypedArrayCode, length: number): TypedArray {
  for (let k = 0; k < CODE_OF.length; k += 1) {
    const row = CODE_OF[k] as [TypedArrayCode, new (n: number) => TypedArray];
    if (row[0] === code) return new row[1](length);
  }
  throw new SerializationError(`unknown typed array code: ${code}`);
}

export function isTypedArray(value: unknown): value is TypedArray {
  return (
    value instanceof Uint8Array ||
    value instanceof Uint16Array ||
    value instanceof Uint32Array ||
    value instanceof Int8Array ||
    value instanceof Int16Array ||
    value instanceof Int32Array
  );
}

export function isTypedArrayMarker(value: unknown): value is TypedArrayMarker {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj['$type'] === 'string' && typeof obj['$b64'] === 'string';
}

/** The raw bytes of a typed array, without copying more than once. */
export function typedArrayBytes(value: TypedArray): Uint8Array {
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

/** Reinterpret bytes as a typed array of the given element type. */
export function typedArrayFromBytes(code: TypedArrayCode, bytes: Uint8Array): TypedArray {
  const empty = typedArrayOf(code, 0);
  const elementSize = empty.BYTES_PER_ELEMENT;
  if (bytes.byteLength % elementSize !== 0) {
    throw new SerializationError(`${bytes.byteLength} bytes is not a whole number of ${code} elements`);
  }
  const out = typedArrayOf(code, bytes.byteLength / elementSize);
  typedArrayBytes(out).set(bytes);
  return out;
}

/** Canonical order for the keys of a `Map` or the members of a `Set`. */
function compareKeys(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/**
 * `serializeValue` of `save-format.md`: typed arrays become markers, `Map`s and `Set`s become
 * sorted arrays, objects keep their keys in sorted order, and anything that is not plain data
 * is refused rather than silently written as `{}`.
 */
export function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const kind = typeof value;
  if (kind === 'number') {
    if (!Number.isFinite(value as number)) {
      throw new SerializationError(`non-finite number in state: ${String(value)}`);
    }
    return value;
  }
  if (kind === 'string' || kind === 'boolean') return value;
  if (kind === 'function' || kind === 'symbol' || kind === 'bigint') {
    throw new SerializationError(`${kind} is not plain data`);
  }
  if (isTypedArray(value)) {
    return { $type: typedArrayCode(value), $b64: bytesToBase64(typedArrayBytes(value)) };
  }
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value instanceof Map) {
    const entries = Array.from(value.entries());
    entries.sort((a, b) => compareKeys(a[0], b[0]));
    return entries.map(([k, v]) => [serializeValue(k), serializeValue(v)]);
  }
  if (value instanceof Set) {
    const members = Array.from(value.values());
    members.sort(compareKeys);
    return members.map(serializeValue);
  }
  const proto = Object.getPrototypeOf(value) as unknown;
  if (proto !== Object.prototype && proto !== null) {
    throw new SerializationError(
      `class instances are not plain data: ${(value as object).constructor?.name ?? 'unknown'}`,
    );
  }
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    const field = source[key];
    if (field === undefined) continue;
    out[key] = serializeValue(field);
  }
  return out;
}

/** Inverse of {@link serializeValue}: `$type` markers become typed arrays again. */
export function deserializeValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(deserializeValue);
  if (isTypedArrayMarker(value)) return typedArrayFromBytes(value.$type, base64ToBytes(value.$b64));
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source)) out[key] = deserializeValue(source[key]);
  return out;
}

/** JSON text of a value in the canonical form. Two equal states produce equal bytes. */
export function serializeJson(value: unknown): string {
  return JSON.stringify(serializeValue(value));
}

/** Parse canonical JSON text back to a value with its typed arrays restored. */
export function deserializeJson(text: string): unknown {
  return deserializeValue(JSON.parse(text));
}

// ---------- core migrations ----------

/** A migration from one core `formatVersion` to the next. */
export type CoreMigration = (sections: Record<string, unknown>) => Record<string, unknown>;

/**
 * `save-format.md` § Migration: core migrations keyed by the version they migrate *from*. Empty
 * while `formatVersion` 1 is the only published version; a new version adds one entry.
 */
export const CORE_MIGRATIONS: Readonly<Record<number, CoreMigration>> = Object.freeze({});

/** Apply every core migration in sequence from `fromVersion` up to `toVersion`. */
export function migrateCore(
  sections: Record<string, unknown>,
  fromVersion: number,
  toVersion: number,
): Record<string, unknown> {
  let state = sections;
  for (let v = fromVersion; v < toVersion; v += 1) {
    const step = CORE_MIGRATIONS[v];
    if (step === undefined) throw new SerializationError(`no core migration from formatVersion ${v}`);
    state = step(state);
  }
  return state;
}
