import { describe, it, expect } from 'vitest';
import {
  SAVE_FORMAT_VERSION,
  SAVE_MAGIC,
  SECTION_ORDER,
  SaveFormatError,
  SaveManager,
  SaveVersionError,
  autoSaveId,
  checkContent,
  contentSourceOf,
  exportFileName,
  finalSaveId,
  jsonSection,
  manualSaveId,
  orderSections,
  readJsonSection,
  readSave,
  readSaveHeader,
  readTypedSection,
  slugify,
  snapshotSaveId,
  typedSection,
  writeSave,
  type SaveHeader,
  type SaveSection,
} from '@app/save-manager';
import { compressor, noCompressor } from '@platform/compress';
import { MemoryStorage, STORE_NAMES, createStorage } from '@platform/storage';
import { Registry, makeTable, type Row, type RegistryTable } from '@core/registry';

type HeaderInput = Omit<SaveHeader, 'formatVersion' | 'compressed'>;

const HEADER: HeaderInput = {
  gameVersion: '1.0.0',
  seed: 'deepholm-test',
  fortress: 'Emberhall',
  calendar: { tick: 123456, year: 2, season: 1, day: 12 },
  contentHash: 'abcdef0123456789',
  population: 23,
  wealth: 18450,
  playTimeSeconds: 5400,
  thumbnail: { cols: 48, rows: 27, cells: 'AAAA' },
  kind: 'manual',
};

function sampleSections(): SaveSection[] {
  return [
    typedSection('map.kind', new Uint8Array([1, 2, 3, 4])),
    typedSection('map.material', new Uint16Array([10, 20, 30])),
    typedSection('map.tempOverride', new Int8Array([-3, 0, 3])),
    jsonSection('entities', { stateVersion: 1, ids: [1, 2, 3] }),
    jsonSection('fortress', { name: 'Emberhall', wealthCached: 18450 }),
    jsonSection('calendar', { tick: 123456 }),
    jsonSection('rng', { '03': [1, 2, 3, 4] }),
    jsonSection('systems', { '03': { stateVersion: 1, state: { cavernBreached: [false, false, false] } } }),
    jsonSection('commandLog', []),
    jsonSection('ui', { z: 32 }),
  ];
}

/** A tiny registry, standing in for the loaded content tables. */
function fixtureRegistry(ids: readonly string[], hash: string): Registry {
  const rows = ids.map((id) => ({ id }) as Row);
  const tables = new Map<string, RegistryTable<Row>>([['materials', makeTable<Row>('materials', rows)]]);
  return new Registry(tables, new Map<string, unknown>(), hash);
}

describe('T-M0-10 save format: the container', () => {
  it('round-trips every section byte-exactly, compressed and raw', async () => {
    for (const compress of [noCompressor, compressor]) {
      const blob = await writeSave(HEADER, sampleSections(), compress);
      const loaded = await readSave(blob, compress);
      expect(loaded.header.formatVersion).toBe(SAVE_FORMAT_VERSION);
      expect(loaded.header.compressed).toBe(compress.available);
      expect(loaded.sections).toHaveLength(sampleSections().length);
      for (const written of orderSections(sampleSections())) {
        const read = loaded.section(written.name) as SaveSection;
        expect(read).toBeDefined();
        expect(read.kind).toBe(written.kind);
        expect([...read.bytes]).toEqual([...written.bytes]);
      }
      // Writing the loaded sections again produces the identical container.
      const again = await writeSave(HEADER, loaded.sections, compress);
      expect([...again]).toEqual([...blob]);
    }
  });

  it('begins with the magic and the format version', async () => {
    const blob = await writeSave(HEADER, sampleSections(), noCompressor);
    expect(new TextDecoder().decode(blob.subarray(0, 4))).toBe(SAVE_MAGIC);
    expect(new DataView(blob.buffer).getUint32(4, true)).toBe(SAVE_FORMAT_VERSION);
  });

  it('parses the header without inflating the body', async () => {
    const blob = await writeSave(HEADER, sampleSections(), compressor);
    const header = readSaveHeader(blob);
    expect(header.fortress).toBe('Emberhall');
    expect(header.calendar).toEqual(HEADER.calendar);
    expect(header.population).toBe(23);
    expect(header.thumbnail).toEqual(HEADER.thumbnail);
    // Prove nothing inflated: the truncated blob still yields a header.
    const headerLength = new DataView(blob.buffer).getUint32(8, true);
    const headerOnly = blob.slice(0, 16 + headerLength);
    expect(readSaveHeader(headerOnly).fortress).toBe('Emberhall');
  });

  it('writes the sections in the documented order whatever order they arrive in', async () => {
    const shuffled = sampleSections().reverse();
    const blob = await writeSave(HEADER, shuffled, noCompressor);
    const loaded = await readSave(blob, noCompressor);
    const bases = loaded.sections.map((s) => s.name.split(':')[0] as string);
    const ranks = bases.map((name) => SECTION_ORDER.indexOf(name));
    expect(ranks.every((r) => r >= 0)).toBe(true);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it('a section the document does not name keeps its place after the ones it does', () => {
    const ordered = orderSections([
      jsonSection('extra', {}),
      jsonSection('ui', {}),
      typedSection('map.kind', new Uint8Array([1])),
      jsonSection('another', {}),
    ]);
    expect(ordered.map((s) => s.name)).toEqual(['map.kind:u8', 'ui', 'extra', 'another']);
  });

  it('keeps typed arrays and JSON values through the container', async () => {
    const blob = await writeSave(HEADER, sampleSections(), noCompressor);
    const loaded = await readSave(blob, noCompressor);
    const kind = readTypedSection(loaded.section('map.kind') as SaveSection);
    expect(kind).toBeInstanceOf(Uint8Array);
    expect([...kind]).toEqual([1, 2, 3, 4]);
    const material = readTypedSection(loaded.section('map.material') as SaveSection);
    expect(material).toBeInstanceOf(Uint16Array);
    expect([...material]).toEqual([10, 20, 30]);
    const temp = readTypedSection(loaded.section('map.tempOverride') as SaveSection);
    expect(temp).toBeInstanceOf(Int8Array);
    expect([...temp]).toEqual([-3, 0, 3]);
    expect(readJsonSection(loaded.section('entities') as SaveSection)).toEqual({
      stateVersion: 1,
      ids: [1, 2, 3],
    });
  });

  it('a typed section carries its element type in its name', () => {
    expect(typedSection('map.flags', new Uint16Array(1)).name).toBe('map.flags:u16');
    expect(() => jsonSection('map.kind:u8', {})).toThrow(SaveFormatError);
    expect(() => readTypedSection(jsonSection('ui', {}))).toThrow(SaveFormatError);
    expect(() => readJsonSection(typedSection('map.kind', new Uint8Array(1)))).toThrow(SaveFormatError);
  });

  it('refuses a save one format version newer than this build', async () => {
    const blob = await writeSave(HEADER, sampleSections(), noCompressor);
    new DataView(blob.buffer).setUint32(4, SAVE_FORMAT_VERSION + 1, true);
    expect(() => readSaveHeader(blob)).toThrow(SaveVersionError);
    try {
      readSaveHeader(blob);
    } catch (error) {
      expect((error as SaveVersionError).found).toBe(SAVE_FORMAT_VERSION + 1);
      expect((error as SaveVersionError).supported).toBe(SAVE_FORMAT_VERSION);
    }
  });

  it('refuses a blob that is not a save, or one that is truncated', async () => {
    expect(() => readSaveHeader(new Uint8Array(4))).toThrow(SaveFormatError);
    expect(() => readSaveHeader(new Uint8Array(32))).toThrow(SaveFormatError);
    const blob = await writeSave(HEADER, sampleSections(), noCompressor);
    await expect(readSave(blob.slice(0, blob.byteLength - 4), noCompressor)).rejects.toThrow(SaveFormatError);
  });
});

describe('T-M0-10 save format: content compatibility', () => {
  const ids = ['granite', 'hematite', 'oak'];

  it('an equal content hash is an exact match', () => {
    const registry = fixtureRegistry(ids, HEADER.contentHash);
    const header = { ...HEADER, formatVersion: 1, compressed: false };
    expect(checkContent(header, contentSourceOf(registry), ['granite'])).toEqual({
      match: 'exact',
      missing: [],
    });
  });

  it('a different hash still loads when every referenced id survives', () => {
    const registry = fixtureRegistry(ids, 'a-different-hash');
    const header = { ...HEADER, formatVersion: 1, compressed: false };
    expect(checkContent(header, contentSourceOf(registry), ['granite', 'oak'])).toEqual({
      match: 'soft',
      missing: [],
    });
  });

  it('a different hash fails with the list of missing ids', () => {
    const registry = fixtureRegistry(ids, 'a-different-hash');
    const header = { ...HEADER, formatVersion: 1, compressed: false };
    expect(
      checkContent(header, contentSourceOf(registry), ['granite', 'sunstone', 'moonsilver', 'sunstone']),
    ).toEqual({ match: 'failed', missing: ['moonsilver', 'sunstone'] });
  });
});

describe('T-M0-10 save format: ids and storage', () => {
  it('builds the documented save ids and export file name', () => {
    expect(manualSaveId(1_700_000_000_000)).toBe('manual-1700000000000');
    expect(autoSaveId(2, 1)).toBe('auto-2-1');
    expect(snapshotSaveId(3)).toBe('snapshot-3');
    expect(finalSaveId('Ember Hall!')).toBe('final-ember-hall');
    expect(slugify('  The Deep Halls  ')).toBe('the-deep-halls');
    expect(exportFileName('Emberhall', 2, 1)).toBe('emberhall-y2-1.deepholm');
  });

  it('the memory adapter stores, lists ascending, and deletes', async () => {
    const storage = new MemoryStorage();
    expect(storage.kind).toBe('memory');
    await storage.put('settings', 'settings', { volume: 3 });
    expect(await storage.get('settings', 'settings')).toEqual({ volume: 3 });
    await storage.put('saves', 'b', 1);
    await storage.put('saves', 'a', 2);
    expect(await storage.keys('saves')).toEqual(['a', 'b']);
    expect(await storage.all('saves')).toEqual([
      { key: 'a', value: 2 },
      { key: 'b', value: 1 },
    ]);
    await storage.delete('saves', 'a');
    expect(await storage.keys('saves')).toEqual(['b']);
    await storage.clear('saves');
    expect(await storage.keys('saves')).toEqual([]);
    storage.close();
    expect(STORE_NAMES).toEqual(['saves', 'legends', 'settings']);
    expect(() => storage.put('nope' as 'saves', 'k', 1)).toThrow(RangeError);
  });

  it('createStorage falls back to memory where there is no IndexedDB', () => {
    expect(createStorage('deepholm-test').kind).toBe('memory');
  });

  it('the save manager keeps the blob and a header copy for listing', async () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const blob = await writeSave(HEADER, sampleSections(), noCompressor);
    await manager.write('manual-1', blob);
    await manager.write('auto-2-1', await writeSave({ ...HEADER, kind: 'auto' }, sampleSections(), noCompressor));
    const listed = await manager.list();
    expect(listed.map((row) => row.id)).toEqual(['auto-2-1', 'manual-1']);
    expect(listed[0]?.header.kind).toBe('auto');
    expect(listed[1]?.header.fortress).toBe('Emberhall');
    expect([...((await manager.read('manual-1')) as Uint8Array)]).toEqual([...blob]);
    expect(await manager.read('missing')).toBeUndefined();
    await manager.delete('manual-1');
    expect((await manager.list()).map((row) => row.id)).toEqual(['auto-2-1']);
  });
});
