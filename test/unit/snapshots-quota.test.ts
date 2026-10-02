/**
 * T-M8-03 snapshots, export, import, storage quota handling:
 * - snapshot rotation across rolling slots
 * - c_load_snapshot confirmation
 * - export file naming
 * - import validation messages
 * - storage quota error path: danger announcement and export offer
 * - SeasonChanged produces rolling snapshot-<n> after autosave
 */

import { describe, it, expect } from 'vitest';
import { loadContent } from '@content/loader';
import {
  SaveManager,
  exportFileName,
  jsonSection,
  rollSnapshots,
  writeSave,
  type SaveHeader,
} from '@app/save-manager';
import { validateImport } from '@app/game-save';
import { MemoryStorage, StorageQuotaError } from '@platform/storage';
import { Game } from '@app/game';
import { MockCanvas, mockCanvasFactory } from './render/canvas-mock';
import { LoadScreen } from '@ui/screens/load';
import { ConfirmScreen } from '@ui/screens/confirm';
import type { FileBridge } from '@platform/files';

const registry = loadContent();

function makeHeader(id: number, kind: SaveHeader['kind'], tick: number): Omit<SaveHeader, 'formatVersion' | 'compressed'> {
  return {
    gameVersion: '0.2.0',
    seed: `s${id}`,
    fortress: 'Emberhall',
    calendar: { tick, year: 1, season: 0, day: 1 },
    contentHash: registry.contentHash,
    population: 7,
    wealth: 1234,
    playTimeSeconds: 0,
    kind,
  };
}

describe('T-M8-03 snapshot rotation and export naming', () => {
  it('export file naming matches <fortress-slug>-y<year>-<season>.deepholm', () => {
    expect(exportFileName('Emberhall', 2, 1)).toBe('emberhall-y2-1.deepholm');
    expect(exportFileName('Cold-Mere Deep', 1, 0)).toBe('cold-mere-deep-y1-0.deepholm');
  });

  it('rotates snapshots 0..3 and rolls over to the oldest tick', async () => {
    const saves = new SaveManager(new MemoryStorage());
    const empty = [jsonSection('world', {})];

    // Starts at slot 0
    expect(await rollSnapshots(saves)).toBe('snapshot-0');
    await saves.write('snapshot-0', await writeSave(makeHeader(0, 'snapshot', 100), empty));

    // Next fills slot 1
    expect(await rollSnapshots(saves)).toBe('snapshot-1');
    await saves.write('snapshot-1', await writeSave(makeHeader(1, 'snapshot', 200), empty));

    // Next fills slot 2
    expect(await rollSnapshots(saves)).toBe('snapshot-2');
    await saves.write('snapshot-2', await writeSave(makeHeader(2, 'snapshot', 300), empty));

    // Next fills slot 3
    expect(await rollSnapshots(saves)).toBe('snapshot-3');
    await saves.write('snapshot-3', await writeSave(makeHeader(3, 'snapshot', 400), empty));

    // All 4 slots full: oldest is snapshot-0 (tick 100)
    expect(await rollSnapshots(saves)).toBe('snapshot-0');
    // Overwrite snapshot-0 with newer tick 500
    await saves.write('snapshot-0', await writeSave(makeHeader(0, 'snapshot', 500), empty));

    // Now oldest is snapshot-1 (tick 200)
    expect(await rollSnapshots(saves)).toBe('snapshot-1');
    await saves.write('snapshot-1', await writeSave(makeHeader(1, 'snapshot', 600), empty));

    // Now oldest is snapshot-2 (tick 300)
    expect(await rollSnapshots(saves)).toBe('snapshot-2');
  });

  it('prunes snapshots when keep setting is reduced', async () => {
    const saves = new SaveManager(new MemoryStorage());
    const empty = [jsonSection('world', {})];
    for (let i = 0; i < 4; i += 1) {
      await saves.write(`snapshot-${i}`, await writeSave(makeHeader(i, 'snapshot', (i + 1) * 100), empty));
    }
    expect((await saves.list()).filter((s) => s.header.kind === 'snapshot').length).toBe(4);

    // Reducing keep to 2 should prune slot 2 and 3
    const next = await rollSnapshots(saves, 2);
    const remaining = (await saves.list()).filter((s) => s.header.kind === 'snapshot').map((s) => s.id).sort();
    expect(remaining).toEqual(['snapshot-0', 'snapshot-1']);
    // Between 0 and 1, slot 0 has tick 100 which is older
    expect(next).toBe('snapshot-0');
  });
});

describe('T-M8-03 import validation messages', () => {
  it('refuses a save that is too short', async () => {
    await expect(validateImport(new Uint8Array(10), registry)).rejects.toThrow('too short');
  });

  it('refuses a save with bad magic', async () => {
    const badMagic = new Uint8Array(32);
    badMagic.set(new TextEncoder().encode('XXXX'), 0);
    await expect(validateImport(badMagic, registry)).rejects.toThrow('bad magic');
  });

  it('refuses a save with a format version newer than supported', async () => {
    const blob = await writeSave(makeHeader(1, 'manual', 10), [jsonSection('world', {})]);
    // Container formatVersion is at offset 4 (uint32)
    const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
    view.setUint32(4, 999, true);
    await expect(validateImport(blob, registry)).rejects.toThrow(/newer game version.*format 999/);
  });

  it('refuses a save with a truncated body', async () => {
    const blob = await writeSave(makeHeader(1, 'manual', 10), [jsonSection('world', {})]);
    const truncated = blob.subarray(0, blob.byteLength - 20);
    await expect(validateImport(truncated, registry)).rejects.toThrow(/truncated|decompress/);
  });

  it('importSave displays import validation failure on LoadScreen without crashing', async () => {
    const saves = new SaveManager(new MemoryStorage());
    let pickedBlob: Uint8Array | null = null;
    const mockFiles: FileBridge = {
      download: () => {},
      pick: async () => pickedBlob,
    };
    const game = new Game({
      canvas: new MockCanvas(),
      seed: 'test-import-val',
      registry,
      createCanvas: mockCanvasFactory(),
      width: 1280,
      height: 800,
      saves,
      files: mockFiles,
    });

    await game.openLoad();
    expect(game.topScreen).toBeInstanceOf(LoadScreen);
    const loadScreen = game.topScreen as LoadScreen;

    // Pick an invalid blob
    pickedBlob = new TextEncoder().encode('NOT A SAVE AT ALL');
    await game.importSave();

    // The load screen now has an error message
    expect(loadScreen.message).toContain('bad magic');
  });
});

describe('T-M8-03 storage quota handling', () => {
  it('on StorageQuotaError: keeps game running, adds danger announcement, and offers export', async () => {
    const mem = new MemoryStorage();
    let failQuota = false;
    // Intercept put on saves store
    const origPut = mem.put.bind(mem);
    mem.put = async (store, key, val) => {
      if (store === 'saves' && failQuota) {
        throw new StorageQuotaError('quota exceeded test');
      }
      return origPut(store, key, val);
    };

    const downloaded: { name: string; bytes: Uint8Array }[] = [];
    const mockFiles: FileBridge = {
      download: (name, bytes) => downloaded.push({ name, bytes }),
      pick: async () => null,
    };

    const game = new Game({
      canvas: new MockCanvas(),
      seed: 'test-quota',
      registry,
      createCanvas: mockCanvasFactory(),
      width: 1280,
      height: 800,
      saves: new SaveManager(mem),
      files: mockFiles,
    });

    await game.start({ embark: 'default' });
    game.host.step(20);

    // Turn on quota failure
    failQuota = true;

    // Trigger quickSave (F5)
    await game.quickSave();
    await game.settled();

    // The game must keep running
    expect(game.host.started).toBe(true);
    const tickBefore = game.host.readers.calendar.tick;
    game.host.step(10);
    expect(game.host.readers.calendar.tick).toBe(tickBefore + 10);

    // Announcement of severity danger was recorded
    const dangerLog = game.fortress.log.lines.filter((l) => l.severity === 'danger');
    expect(dangerLog.length).toBeGreaterThan(0);
    expect(dangerLog.some((l) => /quota/i.test(l.text))).toBe(true);

    // Export was offered via file download
    expect(downloaded.length).toBe(1);
    expect((downloaded[0] as { name: string }).name).toMatch(/^[a-z0-9-]+-y\d+-\d+\.deepholm$/);
    expect((downloaded[0] as { bytes: Uint8Array }).bytes.byteLength).toBeGreaterThan(0);
  });
});

describe('T-M8-03 rolling snapshots on SeasonChanged', () => {
  it('saves both auto-<year>-<season> and rolling snapshot-<n> on SeasonChanged', async () => {
    const saves = new SaveManager(new MemoryStorage());
    const game = new Game({
      canvas: new MockCanvas(),
      seed: 'test-season-snap',
      registry,
      createCanvas: mockCanvasFactory(),
      width: 1280,
      height: 800,
      saves,
    });

    await game.start({ embark: 'default' });
    const calendar = game.host.readers.calendar;
    const seasonNow = calendar.season;

    // Advance to season change
    let guard = 0;
    while (game.host.readers.calendar.season === seasonNow && guard < 200_000) {
      game.host.step(100);
      guard += 100;
    }
    game.host.step(2);
    await game.settled();

    const all = await saves.list();
    const ids = all.map((s) => s.id);
    const year = game.host.readers.calendar.year;
    const season = game.host.readers.calendar.season;

    expect(ids).toContain(`auto-${year}-${season}`);
    expect(ids).toContain('snapshot-0');

    const snap = all.find((s) => s.id === 'snapshot-0');
    expect(snap?.header.kind).toBe('snapshot');

    // And verify loading a snapshot asks c_load_snapshot
    await game.openLoad();
    const load = game.topScreen as LoadScreen;
    load.selected = 'snapshot-0';
    load.activate();
    expect(game.screen).toBe('confirm');
    expect((game.topScreen as ConfirmScreen).confirmId).toBe('c_load_snapshot');
  }, 120_000);
});
