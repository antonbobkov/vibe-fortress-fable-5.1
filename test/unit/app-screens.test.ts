/**
 * T-M1-12 app: the screen stack from the main menu through world generation to the world map and
 * an embark, driven by keys the way the e2e `generate-and-embark` drives the browser.
 */

import { describe, it, expect } from 'vitest';
import { loadContent } from '@content/loader';
import { Game, testHook } from '@app/game';
import { MockCanvas, mockCanvasFactory } from './render/canvas-mock';

const registry = loadContent();

function newGame(): Game {
  return new Game({
    canvas: new MockCanvas(),
    seed: 'app-screens',
    registry,
    createCanvas: mockCanvasFactory(),
    devicePixelRatio: 1,
    width: 1280,
    height: 800,
    randomSeed: () => 'seed-from-test',
  });
}

function key(game: Game, k: string, shift = false): void {
  game.handleKey({ key: k, repeat: false, shift, ctrl: false, alt: false, meta: false });
}

describe('T-M1-12 app: main menu → world generation → world map', () => {
  it('opens on the main menu, generates a world from a typed seed and shows the region panel', async () => {
    const game = newGame();
    await game.showMainMenu();
    expect(game.screen).toBe('main_menu');
    expect(game.textRows().join('\n')).toContain('[n] New world');
    expect(game.textRows().join('\n')).not.toContain('Continue');

    key(game, 'n');
    expect(game.screen).toBe('world_gen');
    for (let k = 0; k < 40; k += 1) key(game, 'Backspace');
    for (const ch of 'e2e-1') key(game, ch);
    key(game, 'Enter');
    key(game, '←');
    key(game, 'g');
    expect(game.textRows().join('\n')).toContain('Stage: names');
    key(game, 'Enter');
    expect(game.screen).toBe('world_map');

    const hook = testHook(game);
    expect(hook.screen()).toBe('world_map');
    expect(hook.text().join('\n')).toMatch(/Wealth|No embark here/);
    key(game, 'Esc');
    expect(game.screen).toBe('world_gen');
    key(game, 'Esc');
    expect(game.screen).toBe('main_menu');
  });

  it('maps pointer pixels to cells and back', () => {
    const game = newGame();
    expect(game.cellAt(0, 0)).toEqual({ col: 0, row: 0 });
    expect(game.cellAt(16 * 5 + 3, 16 * 7 + 15)).toEqual({ col: 5, row: 7 });
    expect(game.cellCenter(5, 7)).toEqual({ x: 88, y: 120 });
  });

  it('embarks on a region: the local map, the party, the fortress screen paused and centered on the wagon', async () => {
    const game = newGame();
    await game.showMainMenu();
    key(game, 'n');
    key(game, 'Enter');
    key(game, '←');
    key(game, 'g');
    key(game, 'Enter');
    const screen = game.topScreen as unknown as { world: { regions: { id: number; biome: string }[]; size: number }; cursor: { x: number; y: number } };
    const land = screen.world.regions.find((r) => r.biome !== 'ocean' && r.biome !== 'glacier');
    expect(land).toBeDefined();
    screen.cursor = { x: land!.id % screen.world.size, y: Math.floor(land!.id / screen.world.size) };
    const pending = game.embarkRegion(screen.world as never, land!.id);
    expect(game.textRows().join('\n')).toContain('Preparing the site');
    await pending;
    expect(game.screen).toBe('fortress');
    expect(game.host.speed()).toBe(0);
    const arrival = game.host.headless.arrival;
    expect(arrival).not.toBeNull();
    expect(arrival!.dwarves).toHaveLength(7);
    expect(game.ui.z).toBe(arrival!.wagon.z);
    expect(game.worldReader()?.size()).toBe(screen.world.size);
    const hook = testHook(game);
    expect(hook.readers.world?.region(land!.id)?.id).toBe(land!.id);
  });
});
