/**
 * T-673: the wheel over the map goes down a level when turned up, by default, and the Settings row
 * `Wheel up goes` turns it round; the choice is saved with the preferences and survives a reload.
 * The wheel over the sidebar, `Ctrl` + wheel and `Shift` + wheel do not change with it.
 */

import { describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import { SettingsStore } from '@app/settings-store';
import { MemoryStorage } from '@platform/storage';
import { readSettings } from '@ui/settings';
import { SettingsScreen } from '@ui/screens/settings';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press } from './ui-fixture';

const registry = loadContent();

async function fortressGame(storage: MemoryStorage): Promise<Game> {
  const game = new Game({
    canvas: new MockCanvas(), seed: 't673-wheel', registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1,
    width: 1280, height: 800, settingsStore: new SettingsStore(storage),
  });
  await game.loadSettings();
  await game.start();
  return game;
}

/** One notch over the map: `dy` < 0 is the wheel turned up. */
function notch(game: Game, dy: number, mods: { shift?: boolean; ctrl?: boolean } = {}): void {
  game.wheel({ x: 20, y: 20, dx: 0, dy, shift: mods.shift ?? false, ctrl: mods.ctrl ?? false, alt: false, meta: false });
}

describe('T-673 the wheel\'s level direction', () => {
  it('goes down a level on the wheel up and up a level on the wheel down, by default', async () => {
    const game = await fortressGame(new MemoryStorage());
    expect(game.userSettings.wheelUp).toBe('down a level');
    const z = game.ui.z;
    notch(game, -100);
    expect(game.ui.z).toBe(z - 1);
    notch(game, 100);
    expect(game.ui.z).toBe(z);
    notch(game, 100);
    expect(game.ui.z).toBe(z + 1);
  });

  it('turns round with the setting, which is saved and reloaded; Shift and Ctrl stay as they were', async () => {
    const storage = new MemoryStorage();
    const first = await fortressGame(storage);
    first.changeSettings({ wheelUp: 'up a level' });
    await first.settled();
    const z = first.ui.z;
    notch(first, -100);
    expect(first.ui.z).toBe(z + 1);
    notch(first, 100);
    expect(first.ui.z).toBe(z);

    const reloaded = await fortressGame(storage);
    expect(reloaded.userSettings.wheelUp).toBe('up a level');
    const z2 = reloaded.ui.z;
    notch(reloaded, -100);
    expect(reloaded.ui.z).toBe(z2 + 1);
    const camY = reloaded.ui.camY;
    notch(reloaded, 100, { shift: true });
    expect(reloaded.ui.camY).toBe(camY + 1);
    expect(reloaded.ui.z).toBe(z2 + 1);
  });

  it('reads a stored choice, and an unknown one as the default', () => {
    expect(readSettings({ wheelUp: 'up a level' }).wheelUp).toBe('up a level');
    expect(readSettings({ wheelUp: 'sideways' }).wheelUp).toBe('down a level');
    expect(readSettings({}).wheelUp).toBe('down a level');
  });

  it('is a row of the Settings screen that steps between the two ways', () => {
    let wheelUp: 'down a level' | 'up a level' = 'down a level';
    const settings = { ...readSettings({}) };
    const screen = new SettingsScreen({
      keymap: undefined as never, strings: undefined as never,
      settings: () => ({ ...settings, wheelUp }),
      change: (patch) => { if (patch.wheelUp !== undefined) wheelUp = patch.wheelUp; },
      bindingsChanged: () => undefined, resetDefaults: () => undefined, back: () => undefined,
    });
    for (let k = 0; k < 15; k += 1) screen.key(press('ArrowDown'));
    screen.key(press('Enter'));
    expect(wheelUp).toBe('up a level');
    screen.key(press('ArrowLeft'));
    expect(wheelUp).toBe('down a level');
  });
});
