import { describe, it, expect } from 'vitest';
import { StateHasher } from '@core/serialize';
import { jsonSection, typedSection, writeSave, type SaveHeader } from '@app/save-manager';
import { noCompressor } from '@platform/compress';
// The script is the only reader of a save file outside the app; it carries its own copy of the
// mixing function, and this test is what keeps the two identical (docs/01-architecture/simulation-core.md § Headless mode).
// @ts-expect-error -- a plain .mjs script without type declarations
import { StateHasher as ScriptHasher, hashSections, readContainer } from '../../scripts/world-hash.mjs';
// @ts-expect-error -- a plain .mjs script without type declarations
import { goldenNames } from '../../scripts/golden-update.mjs';

const HEADER: Omit<SaveHeader, 'formatVersion' | 'compressed'> = {
  gameVersion: '1.0.0',
  seed: 'script-test',
  fortress: 'Emberhall',
  calendar: { tick: 10, year: 1, season: 0, day: 1 },
  contentHash: 'deadbeefdeadbeef',
  population: 7,
  wealth: 100,
  playTimeSeconds: 60,
  kind: 'manual',
};

describe('T-M0-11 scripts: world-hash.mjs', () => {
  it('its mixing function is byte-for-byte the StateHasher of core/serialize.ts', () => {
    const inputs: (number | string | number[])[] = [0, 1, -1, 2147483647, 'granite', 'Emberhall', [1, 2, 3]];
    const ts = new StateHasher();
    const js = new ScriptHasher() as StateHasher;
    for (const input of inputs) {
      if (typeof input === 'number') {
        ts.number(input);
        js.number(input);
      } else if (typeof input === 'string') {
        ts.string(input);
        js.string(input);
      } else {
        ts.array(input);
        js.array(input);
      }
      expect(js.digest()).toBe(ts.digest());
    }
    expect(ts.digest()).toMatch(/^[0-9a-f]{16}$/);
  });

  it('reads a container written by the save manager and hashes its sections', async () => {
    const sections = [
      typedSection('map.kind', new Uint8Array([1, 2, 3])),
      jsonSection('calendar', { tick: 10 }),
      jsonSection('ui', { z: 32 }),
    ];
    const blob = await writeSave(HEADER, sections, noCompressor);
    const parsed = readContainer(blob) as {
      header: SaveHeader;
      sections: { name: string; kind: number; bytes: Uint8Array }[];
    };
    expect(parsed.header.fortress).toBe('Emberhall');
    expect(parsed.sections.map((s) => s.name)).toEqual(['map.kind:u8', 'calendar', 'ui']);
    const hash = hashSections(parsed.sections) as string;
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    // The same save always hashes the same, and a changed section changes the hash.
    expect(hashSections(readContainer(blob).sections)).toBe(hash);
    const other = await writeSave(
      HEADER,
      [typedSection('map.kind', new Uint8Array([1, 2, 4])), jsonSection('calendar', { tick: 10 }), jsonSection('ui', { z: 32 })],
      noCompressor,
    );
    expect(hashSections(readContainer(other).sections)).not.toBe(hash);
  });

  it('refuses a container from a newer format version', async () => {
    const blob = await writeSave(HEADER, [jsonSection('ui', {})], noCompressor);
    new DataView(blob.buffer).setUint32(4, 2, true);
    expect(() => readContainer(blob)).toThrow(/newer game version/);
  });
});

describe('T-M0-11 scripts: golden-update.mjs', () => {
  it('knows the golden files it may rewrite', () => {
    const names = goldenNames() as string[];
    expect(names).toContain('all');
    expect(names).toContain('world-hashes');
  });
});
