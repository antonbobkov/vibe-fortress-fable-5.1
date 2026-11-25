import { describe, expect, it } from 'vitest';
import { HeadlessGame } from '@app/headless';
import { Game, listingOf } from '@app/game';
import { saveGame } from '@app/game-save';
import { LegendStore } from '@app/legend';
import { readSaveHeader, SaveManager, type SaveEnd } from '@app/save-manager';
import { loadContent } from '@content/loader';
import { formatDate } from '@core/calendar';
import { MemoryStorage } from '@platform/storage';
import { LoadScreen } from '@ui/screens/load';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { keymap, press, strings, surface } from './ui-fixture';

const registry = loadContent();

function newGame(saves: SaveManager, legends?: LegendStore): Game {
  return new Game({ canvas: new MockCanvas(), seed: 't748', registry, createCanvas: mockCanvasFactory(), width: 1280, height: 800, saves, ...(legends === undefined ? {} : { legends }) });
}

/** A save of a flat-test fortress named `name`, stepped to `ticks`. */
async function saveAt(name: string, ticks: number, kind: 'manual' | 'final', end?: SaveEnd): Promise<{ blob: Uint8Array; hash: string }> {
  const game = new HeadlessGame({ seed: `t748-${name}`, world: 'flat-test', embark: 'default', fortressName: name });
  game.step(ticks);
  return { blob: await saveGame(game, { kind, ...(end === undefined ? {} : { end }) }), hash: game.hash() };
}

describe('T-748 Continue skips a fallen fortress, and a final save says it is view only', () => {
  it('Continue names and loads the newest save that is not a final one, and hides with only final saves', async () => {
    const saves = new SaveManager(new MemoryStorage());
    const manual = await saveAt('Manualhold', 1000, 'manual');
    const final = await saveAt('Fallenhold', 2000, 'final', 'fell');
    await saves.write('final-fallenhold', final.blob);
    const lonely = newGame(saves);
    await lonely.showMainMenu();
    // Only the final save: Continue is hidden.
    expect(lonely.mainMenu().items().find((item) => item.id === 'continue')?.hidden).toBe(true);
    expect(lonely.textRows().join('\n')).not.toContain('Continue');

    await saves.write('manual-1000', manual.blob);
    const game = newGame(saves);
    await game.showMainMenu();
    const text = game.textRows().join('\n');
    expect(text).toContain('Continue');
    expect(text).toContain('(Manualhold · Year 1)');
    expect(text).not.toContain('Fallenhold');
    await game.continueNewest();
    expect(game.host.headless.hash()).toBe(manual.hash);
    expect(game.host.viewOnly).toBe(false);
  });

  it('the Load screen tells how each finished fortress ended, from its header or, without one, its population', async () => {
    const fell = readSaveHeader((await saveAt('Fallenhold', 10, 'final', 'fell')).blob);
    expect(fell.end).toBe('fell');
    const retired = readSaveHeader((await saveAt('Oldhold', 10, 'final', 'retired')).blob);
    const abandoned = readSaveHeader((await saveAt('Lefthold', 10, 'final', 'abandoned')).blob);
    // A final save written before the header kept its end; and a manual save has none.
    const { end: _fellEnd, ...fellWithout } = fell;
    const { end: _retiredEnd, ...retiredWithout } = retired;
    const older = { ...fellWithout, population: 0 };
    const olderRetired = retiredWithout;
    expect(olderRetired.population).toBeGreaterThan(0);
    expect('end' in readSaveHeader((await saveAt('Manualhold', 10, 'manual', 'fell')).blob)).toBe(false);
    const listing = [listingOf('final-fallenhold', fell), listingOf('final-oldhold', retired), listingOf('final-lefthold', abandoned),
      listingOf('final-older', { ...older, fortress: 'Coldvein Hold' }), listingOf('final-older-retired', { ...olderRetired, fortress: 'Greyhold' })];
    const screen = new LoadScreen({ saves: () => listing, load: () => {}, remove: () => {}, exportSave: () => {}, importSave: () => {}, back: () => {} }, keymap, strings);
    const s = surface(80, 25);
    screen.draw(s);
    const text = s.lines().map((line) => line.trim().replace(/^► /, ''));
    expect(text).toContain('Finished');
    expect(text).toContain('Fallenhold · fell in Year 1 (view only)');
    expect(text).toContain('Oldhold · retired in Year 1 (view only)');
    expect(text).toContain('Lefthold · abandoned in Year 1 (view only)');
    expect(text).toContain('Coldvein Hold · fell in Year 1 (view only)');
    expect(text).toContain('Greyhold · retired in Year 1 (view only)');
  });

  it('a loaded final save says it is view only in the status bar, Space keeps the line, and the last death shows once', async () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const game = newGame(saves, new LegendStore(storage));
    await game.start({ embark: 'default' });
    const name = game.host.world.fortress.name;
    const ids = game.host.readers.of<{ list(): number[] }>('10').list();
    for (const id of ids) game.host.world.emit({ type: 'CreatureDied', id, faction: 'fortress',
      species: registry.table('creatures').index('dwarf'), name: `Dwarf ${id}`, cause: 'wounds', killerId: 0 });
    game.host.step(1);
    await game.settled();
    expect(game.screen).toBe('legend');
    const final = (await saves.list()).find((save) => save.header.kind === 'final');
    expect(final?.header.end).toBe('fell');
    const date = game.host.readers.calendar.tick;

    // Back to the main menu (the legend's Esc): Continue does not offer the fallen fortress.
    await game.showMainMenu();
    expect(game.screen).toBe('main_menu');
    expect(game.mainMenu().items().find((item) => item.id === 'continue')?.hidden).toBe(true);

    await game.loadSave(final?.id as string);
    expect(game.screen).toBe('fortress');
    expect(game.host.viewOnly).toBe(true);
    const line = `${name} fell on ${formatDate(date)}. View only: [Esc] menu.`;
    const rows = (): string[] => game.textRows();
    expect(rows().some((row) => row.includes(line))).toBe(true);
    // Row 1 has no speed or pause mark.
    expect(rows().some((row) => row.includes('║'))).toBe(false);
    // The last death's line, pinned when it came, is in the strip once.
    const last = `Dwarf ${ids[ids.length - 1]}`;
    expect(rows().filter((row) => row.includes(last))).toHaveLength(1);
    game.handleKey(press(' '));
    game.handleKey(press(' '));
    expect(game.host.speed()).toBe(0);
    expect(rows().some((row) => row.includes(line))).toBe(true);
  });
});
