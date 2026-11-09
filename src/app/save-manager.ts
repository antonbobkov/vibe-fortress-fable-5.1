/**
 * The save container.
 *
 * Implements `04-implementation/save-format.md` § Container, § Header JSON, § Sections and
 * § Load procedure steps 1-3, and the storage and failure rules of
 * `01-architecture/persistence.md`. What goes *into* the sections is each owner's business;
 * this module only writes, reads, orders and version-checks them.
 */

import { compressor as platformCompressor, type Compressor } from '@platform/compress';
import {
  base64ToBytes,
  bytesToBase64,
  deserializeJson,
  serializeJson,
  typedArrayBytes,
  typedArrayCode,
  typedArrayFromBytes,
  type TypedArray,
  type TypedArrayCode,
} from '@core/serialize';
import type { StorageAdapter } from '@platform/storage';
import type { Registry } from '@core/registry';

export const SAVE_MAGIC = 'DHLM';

/** `save-format.md` § Container: the only published version. */
export const SAVE_FORMAT_VERSION = 1;

/** `save-format.md` § Sections (in order). Typed sections carry `:code` after the name. */
export const SECTION_ORDER: readonly string[] = Object.freeze([
  'world',
  'map.kind',
  'map.material',
  'map.fluid',
  'map.designation',
  'map.flags',
  'map.tempOverride',
  'map.buildingAt',
  'map.chunkFluidCounts',
  'entities',
  'fortress',
  'calendar',
  'rng',
  'systems',
  'commandLog',
  'ui',
]);

/** 0 = JSON, 1 = typed array (`save-format.md` § Container). */
export type SectionKind = 0 | 1;

export interface SaveSection {
  /** For a typed section the element type follows a colon, e.g. `map.kind:u8`. */
  readonly name: string;
  readonly kind: SectionKind;
  readonly bytes: Uint8Array;
}

export interface SaveThumbnail {
  readonly cols: number;
  readonly rows: number;
  /** base64 of glyph, fg, bg triples. */
  readonly cells: string;
}

export type SaveKind = 'manual' | 'auto' | 'snapshot' | 'final';

/** `save-format.md` § Header JSON. */
export interface SaveHeader {
  readonly formatVersion: number;
  readonly gameVersion: string;
  readonly seed: string;
  readonly fortress: string;
  readonly calendar: { readonly tick: number; readonly year: number; readonly season: number; readonly day: number };
  readonly contentHash: string;
  readonly compressed: boolean;
  readonly population: number;
  readonly wealth: number;
  readonly playTimeSeconds: number;
  readonly thumbnail?: SaveThumbnail;
  readonly kind: SaveKind;
  /** A fortress started in the embark's testing mode (`02` § Testing mode); absent for a normal one. */
  readonly testing?: boolean;
}

export class SaveFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveFormatError';
  }
}

/** `save-format.md` § Load procedure step 1: refused if `formatVersion > supported`. */
export class SaveVersionError extends Error {
  readonly found: number;
  readonly supported: number;

  constructor(found: number, supported: number) {
    super(`this save needs a newer game version (save format ${found}, this build reads ${supported})`);
    this.name = 'SaveVersionError';
    this.found = found;
    this.supported = supported;
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ---------- sections ----------

/** A JSON section; the value goes through the canonical serializer of `core/serialize.ts`. */
export function jsonSection(name: string, value: unknown): SaveSection {
  if (name.includes(':')) throw new SaveFormatError(`a JSON section name may not carry a type: ${name}`);
  return { name, kind: 0, bytes: encoder.encode(serializeJson(value)) };
}

/** A typed-array section; the element type is appended to the name, as the format requires. */
export function typedSection(name: string, array: TypedArray): SaveSection {
  const base = name.includes(':') ? (name.split(':')[0] as string) : name;
  return { name: `${base}:${typedArrayCode(array)}`, kind: 1, bytes: new Uint8Array(typedArrayBytes(array)) };
}

/** The base name of a section, without the `:code` of a typed one. */
export function sectionBaseName(name: string): string {
  const at = name.indexOf(':');
  return at < 0 ? name : name.slice(0, at);
}

/** The element type of a typed section. */
export function sectionElementType(name: string): TypedArrayCode {
  const at = name.indexOf(':');
  if (at < 0) throw new SaveFormatError(`section ${name} carries no element type`);
  return name.slice(at + 1) as TypedArrayCode;
}

export function readJsonSection(section: SaveSection): unknown {
  if (section.kind !== 0) throw new SaveFormatError(`section ${section.name} is not JSON`);
  return deserializeJson(decoder.decode(section.bytes));
}

export function readTypedSection(section: SaveSection): TypedArray {
  if (section.kind !== 1) throw new SaveFormatError(`section ${section.name} is not a typed array`);
  return typedArrayFromBytes(sectionElementType(section.name), section.bytes);
}

/**
 * Sections in the documented order; anything the document does not name keeps its relative
 * position after the ones it does.
 */
export function orderSections(sections: readonly SaveSection[]): SaveSection[] {
  const rank = (section: SaveSection): number => {
    const at = SECTION_ORDER.indexOf(sectionBaseName(section.name));
    return at < 0 ? SECTION_ORDER.length : at;
  };
  return sections
    .map((section, index) => ({ section, index, rank: rank(section) }))
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.index - b.index))
    .map((row) => row.section);
}

// ---------- the container ----------

function encodeSectionStream(sections: readonly SaveSection[]): Uint8Array {
  let length = 4;
  const names = sections.map((s) => encoder.encode(s.name));
  for (let k = 0; k < sections.length; k += 1) {
    length += 2 + (names[k] as Uint8Array).byteLength + 1 + 4 + (sections[k] as SaveSection).bytes.byteLength;
  }
  const out = new Uint8Array(length);
  const view = new DataView(out.buffer);
  let at = 0;
  view.setUint32(at, sections.length, true);
  at += 4;
  for (let k = 0; k < sections.length; k += 1) {
    const section = sections[k] as SaveSection;
    const name = names[k] as Uint8Array;
    view.setUint16(at, name.byteLength, true);
    at += 2;
    out.set(name, at);
    at += name.byteLength;
    view.setUint8(at, section.kind);
    at += 1;
    view.setUint32(at, section.bytes.byteLength, true);
    at += 4;
    out.set(section.bytes, at);
    at += section.bytes.byteLength;
  }
  return out;
}

function decodeSectionStream(bytes: Uint8Array): SaveSection[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 4) throw new SaveFormatError('the section stream is truncated');
  const count = view.getUint32(0, true);
  const out: SaveSection[] = [];
  let at = 4;
  for (let k = 0; k < count; k += 1) {
    if (at + 2 > bytes.byteLength) throw new SaveFormatError(`section ${k} is truncated`);
    const nameLength = view.getUint16(at, true);
    at += 2;
    const name = decoder.decode(bytes.subarray(at, at + nameLength));
    at += nameLength;
    const kind = view.getUint8(at) as SectionKind;
    at += 1;
    const byteLength = view.getUint32(at, true);
    at += 4;
    if (at + byteLength > bytes.byteLength) throw new SaveFormatError(`section ${name} is truncated`);
    out.push({ name, kind, bytes: bytes.slice(at, at + byteLength) });
    at += byteLength;
  }
  return out;
}

/**
 * Write the container of `save-format.md` § Container. The header records whether the body was
 * actually compressed, so a platform without `CompressionStream` writes a readable save.
 */
export async function writeSave(
  header: Omit<SaveHeader, 'formatVersion' | 'compressed'>,
  sections: readonly SaveSection[],
  compress: Compressor = platformCompressor,
): Promise<Uint8Array> {
  const ordered = orderSections(sections);
  const raw = encodeSectionStream(ordered);
  const compressed = compress.available;
  const body = compressed ? await compress.deflateRaw(raw) : raw;
  const full: SaveHeader = { ...header, formatVersion: SAVE_FORMAT_VERSION, compressed };
  const headerBytes = encoder.encode(serializeJson(full));
  const out = new Uint8Array(4 + 4 + 4 + headerBytes.byteLength + 4 + body.byteLength);
  const view = new DataView(out.buffer);
  out.set(encoder.encode(SAVE_MAGIC), 0);
  view.setUint32(4, SAVE_FORMAT_VERSION, true);
  view.setUint32(8, headerBytes.byteLength, true);
  out.set(headerBytes, 12);
  view.setUint32(12 + headerBytes.byteLength, body.byteLength, true);
  out.set(body, 16 + headerBytes.byteLength);
  return out;
}

/**
 * `save-format.md` § Load procedure steps 1-2: magic, version and header only. The body is never
 * touched, so the Load screen can list saves without inflating them.
 */
export function readSaveHeader(blob: Uint8Array): SaveHeader {
  if (blob.byteLength < 16) throw new SaveFormatError('not a Deepholm save: too short');
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  if (decoder.decode(blob.subarray(0, 4)) !== SAVE_MAGIC) {
    throw new SaveFormatError('not a Deepholm save: bad magic');
  }
  const formatVersion = view.getUint32(4, true);
  if (formatVersion > SAVE_FORMAT_VERSION) throw new SaveVersionError(formatVersion, SAVE_FORMAT_VERSION);
  const headerLength = view.getUint32(8, true);
  if (12 + headerLength + 4 > blob.byteLength) throw new SaveFormatError('the header is truncated');
  let header: SaveHeader;
  try {
    header = JSON.parse(decoder.decode(blob.subarray(12, 12 + headerLength))) as SaveHeader;
  } catch {
    throw new SaveFormatError('the header JSON is corrupt');
  }
  if (header.formatVersion !== formatVersion) {
    throw new SaveFormatError(
      `the container says format ${formatVersion} and the header says ${header.formatVersion}`,
    );
  }
  return header;
}

export interface LoadedSave {
  readonly header: SaveHeader;
  /** In the order they were written. */
  readonly sections: readonly SaveSection[];
  section(name: string): SaveSection | undefined;
}

/** `save-format.md` § Load procedure step 3: inflate the body and split it into sections. */
export async function readSave(blob: Uint8Array, compress: Compressor = platformCompressor): Promise<LoadedSave> {
  const header = readSaveHeader(blob);
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  const headerLength = view.getUint32(8, true);
  const bodyLength = view.getUint32(12 + headerLength, true);
  const bodyStart = 16 + headerLength;
  if (bodyStart + bodyLength > blob.byteLength) throw new SaveFormatError('the body is truncated');
  const body = blob.slice(bodyStart, bodyStart + bodyLength);
  let raw: Uint8Array;
  try {
    raw = header.compressed ? await compress.inflateRaw(body) : body;
  } catch (error) {
    throw new SaveFormatError(`failed to decompress save body: ${error instanceof Error ? error.message : String(error)}`);
  }
  const sections = decodeSectionStream(raw);
  const byBase = new Map<string, SaveSection>();
  for (let k = 0; k < sections.length; k += 1) {
    const section = sections[k] as SaveSection;
    byBase.set(section.name, section);
    byBase.set(sectionBaseName(section.name), section);
  }
  return { header, sections, section: (name) => byBase.get(name) };
}

// ---------- content compatibility ----------

/** What the loader needs to know about the current content tables. */
export interface ContentSource {
  readonly contentHash: string;
  hasId(id: string): boolean;
}

/** A {@link ContentSource} over the loaded {@link Registry}. */
export function contentSourceOf(registry: Registry): ContentSource {
  return {
    contentHash: registry.contentHash,
    hasId: (id) => {
      const names = registry.tableNames();
      for (let k = 0; k < names.length; k += 1) {
        if (registry.table(names[k] as string).has(id)) return true;
      }
      return false;
    },
  };
}

export interface ContentCheck {
  readonly match: 'exact' | 'soft' | 'failed';
  /** The referenced ids the current tables no longer have. */
  readonly missing: readonly string[];
}

/**
 * `content-pipeline.md`: on a hash mismatch the load proceeds with a warning when every content id
 * the save references still exists, and fails with the list of missing ids when one does not.
 * The referenced ids come from the caller, which owns the map from component fields to content
 * tables (`save-format.md` § Serialization helpers). See docs/04-implementation/save-format.md § Serialization helpers.
 */
export function checkContent(
  header: SaveHeader,
  content: ContentSource,
  referencedIds: readonly string[],
): ContentCheck {
  if (header.contentHash === content.contentHash) return { match: 'exact', missing: [] };
  const missing: string[] = [];
  for (let k = 0; k < referencedIds.length; k += 1) {
    const id = referencedIds[k] as string;
    if (!content.hasId(id) && !missing.includes(id)) missing.push(id);
  }
  missing.sort();
  return missing.length === 0 ? { match: 'soft', missing: [] } : { match: 'failed', missing };
}

// ---------- save ids and storage ----------

/** `persistence.md` § Storage: `manual-<unixMs>`. */
export function manualSaveId(unixMs: number): string {
  return `manual-${Math.trunc(unixMs)}`;
}

/** `auto-<year>-<season>`. */
export function autoSaveId(year: number, season: number): string {
  return `auto-${year}-${season}`;
}

/** `snapshot-<n>`, n rolling 0..3. */
export function snapshotSaveId(n: number): string {
  return `snapshot-${n}`;
}

/** `final-<fortressSlug>`. */
export function finalSaveId(fortressName: string): string {
  return `final-${slugify(fortressName)}`;
}

/** Lower case, non-alphanumerics folded to single dashes; the form the export file name uses. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `persistence.md` § Export and import: `<fortress-slug>-y<year>-<season>.deepholm`. */
export function exportFileName(fortressName: string, year: number, season: number): string {
  return `${slugify(fortressName)}-y${year}-${season}.deepholm`;
}

/** What the `saves` object store holds: the blob plus a header copy for listing. */
export interface StoredSave {
  readonly header: SaveHeader;
  /** base64 of the container, so the record is plain JSON in every adapter. */
  readonly blob: string;
}

/** Reads and writes saves through a {@link StorageAdapter}. */
export class SaveManager {
  private readonly storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  async write(id: string, blob: Uint8Array): Promise<void> {
    const header = readSaveHeader(blob);
    const record: StoredSave = { header, blob: bytesToBase64(blob) };
    await this.storage.put('saves', id, record);
  }

  async read(id: string): Promise<Uint8Array | undefined> {
    const record = await this.storage.get<StoredSave>('saves', id);
    return record === undefined ? undefined : base64ToBytes(record.blob);
  }

  /** Every save's header, by id, ascending. No body is inflated. */
  async list(): Promise<{ id: string; header: SaveHeader }[]> {
    const rows = await this.storage.all<StoredSave>('saves');
    return rows.map((row) => ({ id: row.key, header: row.value.header }));
  }

  async delete(id: string): Promise<void> {
    await this.storage.delete('saves', id);
  }
}

/** `persistence.md` § Autosave and snapshots: "keeps the four most recent autosaves". */
export const AUTOSAVES_KEPT = 4;

/** `persistence.md` § Autosave and snapshots: rolling snapshots count. */
export const SNAPSHOTS_KEPT = 4;

/**
 * Returns the next snapshot id to write (`snapshot-<n>`), rolling across slots 0..(keep - 1).
 * Unused slots < keep are filled first (ascending). Once all slots exist, the slot with
 * the oldest header tick is chosen. Any snapshot slot >= keep is pruned.
 */
export async function rollSnapshots(saves: SaveManager, keep: number = SNAPSHOTS_KEPT): Promise<string> {
  const all = await saves.list();
  const snapshots = all.filter((s) => s.header.kind === 'snapshot');

  // Prune any snapshots with slot index >= keep
  for (const s of snapshots) {
    const match = /^snapshot-(\d+)$/.exec(s.id);
    if (match) {
      const idx = Number(match[1]);
      if (idx >= keep) {
        await saves.delete(s.id);
      }
    }
  }

  const valid = snapshots.filter((s) => {
    const match = /^snapshot-(\d+)$/.exec(s.id);
    return match !== null && Number(match[1]) < keep;
  });

  const presentIndices = new Set<number>();
  for (const s of valid) {
    const match = /^snapshot-(\d+)$/.exec(s.id);
    if (match) presentIndices.add(Number(match[1]));
  }
  for (let i = 0; i < keep; i += 1) {
    if (!presentIndices.has(i)) {
      return snapshotSaveId(i);
    }
  }

  // All slots 0..(keep - 1) exist: pick the oldest by calendar tick
  valid.sort((a, b) => a.header.calendar.tick - b.header.calendar.tick || a.id.localeCompare(b.id));
  return (valid[0] as { id: string }).id;
}

/**
 * "Older ones are deleted": every autosave beyond the {@link AUTOSAVES_KEPT} newest (by tick).
 * "A manual save is never deleted automatically." Returns the ids deleted.
 */
export async function rollAutosaves(saves: SaveManager, keep: number = AUTOSAVES_KEPT): Promise<string[]> {
  const autos = (await saves.list()).filter((s) => s.header.kind === 'auto');
  autos.sort((a, b) => b.header.calendar.tick - a.header.calendar.tick || (a.id < b.id ? 1 : -1));
  const doomed = autos.slice(keep).map((s) => s.id);
  for (const id of doomed) await saves.delete(id);
  return doomed;
}

/** The quick save `F9` loads: the newest `manual-<unixMs>` save (docs/04-implementation/save-format.md § Snapshots and ids). */
export async function newestManualId(saves: SaveManager): Promise<string | null> {
  const manual = (await saves.list()).filter((s) => s.header.kind === 'manual' && /^manual-\d+$/.test(s.id));
  if (manual.length === 0) return null;
  manual.sort((a, b) => Number(b.id.slice(7)) - Number(a.id.slice(7)));
  return (manual[0] as { id: string }).id;
}
