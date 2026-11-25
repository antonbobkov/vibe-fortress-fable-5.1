import { describe, expect, it } from 'vitest';
import { HeadlessGame } from '@app/headless';
import { Game } from '@app/game';
import { saveGame } from '@app/game-save';
import { SaveManager } from '@app/save-manager';
import { loadContent } from '@content/loader';
import type { FileBridge } from '@platform/files';
import { MemoryStorage } from '@platform/storage';
import { LoadScreen } from '@ui/screens/load';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press } from './ui-fixture';

const registry = loadContent();

describe('T-751 Import selects the save it imported', () => {
  it('puts the cursor on the imported save, so Enter loads it; a failed import keeps the selection', async () => {
    // One fortress saved in Summer is on the list; a later save of it comes in as a file.
    const fortress = new HeadlessGame({ seed: 't751', world: 'flat-test', embark: 'default', fortressName: 'Vein Hearth' });
    fortress.step(200);
    const summer = await saveGame(fortress, { kind: 'manual' });
    fortress.step(400);
    const autumn = await saveGame(fortress, { kind: 'manual' });
    const autumnHash = fortress.hash();

    const saves = new SaveManager(new MemoryStorage());
    await saves.write('manual-1000', summer);
    let picked: Uint8Array | null = autumn;
    const files: FileBridge = { download: () => {}, pick: () => Promise.resolve(picked) };
    const game = new Game({ canvas: new MockCanvas(), seed: 't751', registry, createCanvas: mockCanvasFactory(), width: 1280, height: 800, saves, files });
    await game.openLoad();
    const load = game.topScreen as LoadScreen;
    expect(load).toBeInstanceOf(LoadScreen);
    expect(load.selected).toBe('manual-1000');

    await game.importSave();
    await game.settled();
    const imported = load.selected;
    expect(imported).not.toBe('manual-1000');
    expect(imported).toMatch(/^manual-\d+$/);
    expect(load.ordered().map((row) => row.id)).toEqual([imported, 'manual-1000']);
    // The ▶ is on the imported row, the first.
    const rows = game.textRows();
    const marked = rows.find((row) => row.includes('▶') || row.includes('►')) ?? '';
    expect(rows.indexOf(marked)).toBe(rows.findIndex((row) => row.includes('Vein Hearth')));

    // A file that is not a save: the import fails and the selection stays.
    picked = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
    await game.importSave();
    await game.settled();
    expect(load.selected).toBe(imported);
    expect(load.message).toContain('Import failed');

    game.handleKey(press('Enter'));
    await game.settled();
    expect(game.screen).toBe('fortress');
    expect(game.host.headless.hash()).toBe(autumnHash);
  });
});
