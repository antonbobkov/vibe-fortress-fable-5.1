/**
 * T-704: one `Esc` too many opens the game menu; the next panel letter must open its panel, not
 * save, load, rename, retire, abandon or leave (`ui-keymap-and-screens.md` § Game menu). The menu's
 * rows but Resume keep their letters on `Shift`, and a rebinding keeps them there.
 */

import { describe, expect, it, vi } from 'vitest';
import { Game } from '@app/game';
import { SaveManager } from '@app/save-manager';
import { MemoryStorage } from '@platform/storage';
import { ConfirmScreen } from '@ui/screens/confirm';
import { GameMenuScreen } from '@ui/screens/game_menu';
import type { KeySpec } from '@ui/keymap';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press, registry } from './ui-fixture';

function newGame(seed: string): Game {
  return new Game({
    canvas: new MockCanvas(), seed, registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1,
    width: 1280, height: 800, saves: new SaveManager(new MemoryStorage()),
  });
}

/** `Esc` from the fortress until the game menu shows: the tool, the panel, then the menu. */
function escToMenu(g: Game): void {
  for (let n = 0; n < 4 && g.screen !== 'game_menu'; n += 1) g.handleKey(press('Esc'));
  expect(g.screen).toBe('game_menu');
}

const shift = (letter: string) => press(letter.toUpperCase(), { shift: true });

describe('T-704 the game menu leaves the panel letters to the panels', () => {
  it('Esc then a panel letter opens its panel, and the fortress goes on at its speed', async () => {
    const g = newGame('t704-letters');
    await g.start({ embark: 'default' });
    g.host.setSpeed(2);
    const panels: Record<string, string> = { a: 'log', m: 'military', s: 'stocks', l: 'labors', o: 'orders', n: 'animals' };
    for (const [letter, panel] of Object.entries(panels)) {
      escToMenu(g);
      expect(g.host.speed(), 'the menu pauses').toBe(0);
      g.handleKey(press(letter));
      expect(g.screen, letter).toBe('fortress');
      expect(g.ui.panel, letter).toBe(panel);
      expect(g.host.speed(), `${letter}: the speed before the menu`).toBe(2);
    }
    // Nothing was saved, loaded, renamed, retired, abandoned or left.
    expect(g.lastSaveId).toBeNull();
    expect(g.host.started).toBe(true);
    expect(g.host.world.commandLog.all().some((entry) => entry.command.type === 'RenameFortress')).toBe(false);
  }, 30_000);

  it('a bare letter that no panel and no row binds does nothing; x no longer retires', async () => {
    const g = newGame('t704-none');
    await g.start({ embark: 'default' });
    escToMenu(g);
    for (const letter of ['x', 'g', 'h']) {
      expect(g.handleKey(press(letter)), letter).toBe(false);
      expect(g.screen, letter).toBe('game_menu');
    }
    // A Shift letter the menu does not bind opens no panel either.
    g.handleKey(shift('d'));
    expect(g.screen).toBe('game_menu');
    expect(g.ui.panel).toBeNull();
  }, 30_000);

  it('the rows are reached with Shift: Save, Main menu, Retire, Settings, Load, Rename; r resumes', async () => {
    const g = newGame('t704-shift');
    await g.start({ embark: 'default' });
    g.host.step(30);
    escToMenu(g);
    const menu = g.topScreen as GameMenuScreen;
    expect(menu.items().map((item) => item.key)).toEqual(['r', 'S-s', 'S-l', 'S-o', 'S-n', 'S-x', 'S-a', 'S-m']);

    g.handleKey(shift('m'));
    expect(g.screen).toBe('confirm');
    expect((g.topScreen as ConfirmScreen).confirmId).toBe('c_main_menu');
    g.handleKey(press('Enter'));
    expect(g.screen).toBe('game_menu');

    g.handleKey(shift('x'));
    expect((g.topScreen as ConfirmScreen).confirmId).toBe('c_retire');
    g.handleKey(press('n'));
    expect(g.screen).toBe('game_menu');

    g.handleKey(shift('s'));
    await g.settled();
    expect(g.lastSaveId).not.toBeNull();
    expect(g.screen).toBe('game_menu');

    g.handleKey(shift('n'));
    expect(g.screen).toBe('text_input');
    g.handleKey(press('Esc'));
    expect(g.screen).toBe('game_menu');

    g.handleKey(shift('o'));
    expect(g.screen).toBe('settings');
    g.handleKey(press('Esc'));
    expect(g.screen).toBe('game_menu');

    g.handleKey(press('r'));
    expect(g.screen).toBe('fortress');
    expect(g.ui.panel).toBeNull();

    escToMenu(g);
    g.handleKey(shift('l'));
    await vi.waitFor(() => expect(g.screen).toBe('load'), { timeout: 2000 });
  }, 30_000);

  it('a rebound row stays on Shift; a moved panel letter is the one that opens its panel', async () => {
    const g = newGame('t704-rebind');
    await g.start({ embark: 'default' });
    const index = (context: string, id: string): number => g.keymap.bindings.findIndex((b) => b.context === context && b.id === id);
    const q: KeySpec = { key: 'q', ctrl: false, shift: false };
    expect(g.keymap.rebind(index('game_menu', 'main_menu'), q)).toBeNull();
    expect(g.keymap.bindings[index('game_menu', 'main_menu')]?.spec).toMatchObject({ key: 'q', shift: true });
    expect(g.keymap.rebind(index('fortress_panel', 'log'), { key: 'g', ctrl: false, shift: false })).toBeNull();

    g.host.step(30);
    escToMenu(g);
    g.render();
    expect(g.textRows().join('\n')).toContain('[S-q] Main menu');
    // The bare letter of the rebound row is no key of the menu, nor of a panel.
    g.handleKey(press('q'));
    expect(g.screen).toBe('game_menu');
    g.handleKey(shift('q'));
    expect((g.topScreen as ConfirmScreen).confirmId).toBe('c_main_menu');
    g.handleKey(press('n'));
    // The Log's old letter opens nothing now; its new one opens it.
    g.handleKey(press('a'));
    expect(g.screen).toBe('game_menu');
    g.handleKey(press('g'));
    expect(g.screen).toBe('fortress');
    expect(g.ui.panel).toBe('log');
  }, 30_000);
});
