/**
 * T-776: `strings:check` scans `src/app` as it scans `src/ui`. The words the app draws are strings
 * keys a `strings.json` row reaches (the Continue sub-label, a save's fault on the Load screen), and
 * the item view's first line words its top category through `ui.item.category.<top>`
 * (`content-pipeline.md` § Strings, `persistence.md` § Failure handling).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Game } from '@app/game';
import { saveGame, SaveLoadError } from '@app/game-save';
import { HeadlessGame } from '@app/headless';
import { errorWords, readSaveHeader, SaveManager, SaveVersionError } from '@app/save-manager';
import { loadContent } from '@content/loader';
import type { Registry } from '@core/registry';
import { MemoryStorage } from '@platform/storage';
import { itemSummary } from '@ui/panels/look';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
// @ts-expect-error -- a plain .mjs script without type declarations
import { check, LITERAL_DIRS, panelLiterals } from '../../../scripts/strings-check.mjs';

const registry = loadContent();

/** The content registry with `rows` over its `strings.json` rows, as a content row would give them. */
function withRows(rows: Readonly<Record<string, string>>): Registry {
  const over = Object.create(registry) as Registry;
  const base = registry.derived<Readonly<Record<string, string>>>('strings');
  over.derived = (<T>(name: string): T => (name === 'strings' ? { ...base, ...rows } as unknown as T : registry.derived<T>(name))) as Registry['derived'];
  return over;
}

describe('T-776 the app\'s words go through strings, and strings:check scans src/app', () => {
  it('scans src/app, with nothing left to word; a drawn literal planted there fails', () => {
    expect(LITERAL_DIRS).toContain('src/app');
    expect((check() as { literals: string[] }).literals).toEqual([]);
    const dir = mkdtempSync(join(tmpdir(), 't776-'));
    try {
      mkdirSync(join(dir, 'src/app'), { recursive: true });
      writeFileSync(join(dir, 'src/app/planted.ts'),
        "const sub = `${fortress} · Year ${year}`;\nthis.note('alert', 'The save could not be read.');\nconst key = strings.get('ui.menu.continue');\n");
      expect((panelLiterals(dir) as string[]).sort()).toEqual([
        'src/app/planted.ts:1: "${} · Year ${}"',
        'src/app/planted.ts:2: "The save could not be read."',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a strings.json row reaches the Continue sub-label', async () => {
    const saves = new SaveManager(new MemoryStorage());
    const fortress = new HeadlessGame({ seed: 't776-continue', world: 'flat-test', embark: 'default', fortressName: 'Rowhold' });
    fortress.step(10);
    await saves.write('manual-10', await saveGame(fortress, { kind: 'manual' }));
    const make = (reg: Registry): Game => new Game({ canvas: new MockCanvas(), seed: 't776', registry: reg, createCanvas: mockCanvasFactory(), width: 1280, height: 800, saves });
    const plain = make(registry);
    await plain.showMainMenu();
    expect(plain.textRows().join('\n')).toContain('(Rowhold · Year 1)');
    const worded = make(withRows({ 'ui.menu.continue_sub': '{fortress}, in its year {year}' }));
    await worded.showMainMenu();
    expect(worded.textRows().join('\n')).toContain('(Rowhold, in its year 1)');
  });

  it('a save\'s fault is worded by its key, and a strings.json row reaches it', async () => {
    const strings = new Strings(registry);
    let thrown: unknown = null;
    try {
      readSaveHeader(new TextEncoder().encode('NOT A SAVE AT ALL, NOT EVEN CLOSE'));
    } catch (error) {
      thrown = error;
    }
    expect(errorWords(strings, thrown)).toBe('this file is not a Deepholm save');
    expect(errorWords(new Strings(withRows({ 'ui.load.error.not_a_save': 'no save in this file' })), thrown)).toBe('no save in this file');
    expect(errorWords(strings, new SaveVersionError(3, 2))).toBe('this save needs a newer game version (save format 3, this build reads 2)');
    expect(errorWords(strings, new SaveLoadError('items', 'section items is unreadable: x'))).toBe('the items section of the save is damaged or missing');
    expect(errorWords(strings, new SaveLoadError('header', 'missing', ['wyvern', 'mithril']))).toBe('the save needs content this game does not have: wyvern, mithril');
    // An error from elsewhere (the browser's storage) gives its own message.
    expect(errorWords(strings, new Error('QuotaExceededError'))).toBe('QuotaExceededError');
  });

  it('the item view words its top category through ui.item.category.<top>, and a strings.json row reaches it', () => {
    const w = new TestWorld({ seed: 't776-item', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const chair = w.spawnItem('chair', 'oak', w.index(10, 10, 32));
    const arrows = w.spawnItem('arrow', 'oak', w.index(11, 10, 32), 20);
    const strings = new Strings(registry);
    expect(itemSummary(w.readers, strings, chair)).toMatch(/^Furniture · /);
    expect(itemSummary(w.readers, strings, arrows)).toMatch(/^Ammunition · .*×20 · /);
    const worded = new Strings(withRows({ 'ui.item.category.furniture': 'furnishing' }));
    expect(itemSummary(w.readers, worded, chair)).toMatch(/^Furnishing · /);
  });
});
