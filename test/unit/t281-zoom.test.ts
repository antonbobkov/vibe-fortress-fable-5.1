import { describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import { SettingsStore } from '@app/settings-store';
import { CELL_PX_ZOOM_1, ZOOM_LEVELS } from '@core/constants';
import { MemoryStorage } from '@platform/storage';
import { AUTO_ZOOM_MIN_COLS, AUTO_ZOOM_MIN_ROWS } from '@render/constants';
import { autoZoom, cellPxFor, computeViewport } from '@render/cellbuffer';
import { DEFAULT_USER_SETTINGS, readSettings } from '@ui/settings';
import { SettingsScreen } from '@ui/screens/settings';
import { MockCanvas, mockCanvasFactory } from './render/canvas-mock';
import { keymap, press, strings, surface } from './ui/ui-fixture';

const registry = loadContent();

function newGame(width = 1280, height = 800, store?: SettingsStore): Game {
  return new Game({
    canvas: new MockCanvas(),
    seed: 't281',
    registry,
    createCanvas: mockCanvasFactory(),
    devicePixelRatio: 1,
    width,
    height,
    ...(store === undefined ? {} : { settingsStore: store }),
  });
}

describe('T-281 zoom levels and the automatic zoom', () => {
  it('has a 32-pixel level for very large screens', () => {
    expect(ZOOM_LEVELS).toEqual([0.75, 1, 1.5, 2]);
    expect(cellPxFor(2)).toBe(2 * CELL_PX_ZOOM_1);
    expect(computeViewport(3840, 2160, 2)).toEqual({ zoom: 2, cellPx: 32, cols: 120, rows: 67, cssScale: 1 });
  });

  it('names the grid the automatic zoom aims for', () => {
    expect([AUTO_ZOOM_MIN_COLS, AUTO_ZOOM_MIN_ROWS]).toEqual([100, 56]);
  });

  it('picks the largest level of 1 or more that keeps 100 x 56 cells, else 1', () => {
    expect(autoZoom(1280, 800)).toBe(1);
    expect(autoZoom(1920, 1080)).toBe(1);
    expect(autoZoom(2560, 1440)).toBe(1.5);
    expect(autoZoom(3840, 2160)).toBe(2);
    expect(autoZoom(960, 540)).toBe(1);
  });
});

describe('T-281 the zoom returns when the window grows back', () => {
  it('shrinks to the minimum grid and regrows to 80 x 50 at zoom 1', async () => {
    const game = newGame();
    await game.start();
    expect([game.viewCols, game.viewRows, game.ui.zoom]).toEqual([80, 50, 1]);
    game.resize(960, 540, 1);
    expect(game.ui.zoom).toBe(0.75);
    expect(game.viewCols).toBeGreaterThanOrEqual(80);
    game.resize(1280, 800, 1);
    expect([game.viewCols, game.viewRows, game.ui.zoom]).toEqual([80, 50, 1]);
    expect(game.userSettings.zoom).toBe('auto');
  });

  it('keeps a fixed zoom as the request through a shrink and a regrow', async () => {
    const game = newGame();
    await game.start();
    game.changeSettings({ zoom: 1 });
    game.resize(960, 540, 1);
    expect(game.ui.zoom).toBe(0.75);
    expect(game.userSettings.zoom).toBe(1);
    game.resize(1280, 800, 1);
    expect(game.ui.zoom).toBe(1);
    expect(game.viewCols).toBe(80);
  });

  it('opens a new profile at 120 x 67 on a 3840 x 2160 window and at 80 x 50 on 1280 x 800', async () => {
    const big = newGame(3840, 2160);
    await big.start();
    expect([big.viewCols, big.viewRows, big.ui.zoom]).toEqual([120, 67, 2]);
    const huge = newGame(2560, 1440);
    await huge.start();
    expect(huge.ui.zoom).toBe(1.5);
  });

  it('keeps a fixed zoom from the settings store', async () => {
    const store = new SettingsStore(new MemoryStorage());
    const first = newGame(3840, 2160, store);
    first.changeSettings({ zoom: 1 });
    await first.settled();
    const second = newGame(3840, 2160, store);
    await second.loadSettings();
    expect(second.userSettings.zoom).toBe(1);
    expect(second.ui.zoom).toBe(1);
    expect(second.viewCols).toBe(240);
  });

  it('leaves Auto for a fixed level with Ctrl+Up and Ctrl+Down', async () => {
    const game = newGame(2560, 1440);
    await game.start();
    expect(game.userSettings.zoom).toBe('auto');
    game.zoomBy(-1);
    expect(game.userSettings.zoom).toBe(1);
    expect(game.ui.zoom).toBe(1);
    game.zoomBy(1);
    expect(game.userSettings.zoom).toBe(1.5);
  });
});

describe('T-281 the Zoom setting', () => {
  it('defaults to Auto and reads an old stored level as fixed', () => {
    expect(DEFAULT_USER_SETTINGS.zoom).toBe('auto');
    expect(readSettings({}).zoom).toBe('auto');
    expect(readSettings({ zoom: 'auto' }).zoom).toBe('auto');
    expect(readSettings({ zoom: 1 }).zoom).toBe(1);
    expect(readSettings({ zoom: 0.75 }).zoom).toBe(0.75);
    expect(readSettings({ zoom: 2 }).zoom).toBe(2);
    expect(readSettings({ zoom: 3 }).zoom).toBe('auto');
  });

  function screenWith(zoom: number | 'auto', view?: { requested: number; shown: number }): { screen: SettingsScreen; text: () => string; settings: { zoom: number | 'auto' } } {
    const settings = { ...DEFAULT_USER_SETTINGS, zoom };
    const screen = new SettingsScreen({
      keymap, strings, settings: () => settings, change: (patch) => Object.assign(settings, patch),
      bindingsChanged: () => {}, resetDefaults: () => {}, back: () => {},
      ...(view === undefined ? {} : { zoomView: () => view }),
    });
    const text = (): string => { const s = surface(80, 25); screen.draw(s); return s.lines().join('\n'); };
    return { screen, text, settings };
  }

  it('shows Auto, cycles through the fixed levels and says how to get the old look', () => {
    const { screen, text, settings } = screenWith('auto');
    expect(text()).toContain('[Auto');
    expect(text()).toContain('fixed zoom');
    screen.selected = 4;
    screen.key(press('ArrowRight'));
    expect(settings.zoom).toBe(0.75);
    screen.key(press('ArrowRight'));
    screen.key(press('ArrowRight'));
    screen.key(press('ArrowRight'));
    expect(settings.zoom).toBe(2);
    expect(text()).toContain('[2');
    screen.key(press('ArrowRight'));
    expect(settings.zoom).toBe('auto');
  });

  it('says when the window shows a smaller zoom than the setting', () => {
    expect(screenWith(1, { requested: 1, shown: 0.75 }).text()).toContain('Zoom 1 (shown at 0.75: the window is small)');
    expect(screenWith('auto', { requested: 1, shown: 0.75 }).text()).toContain('Zoom Auto (shown at 0.75: the window is small)');
    expect(screenWith(1, { requested: 1, shown: 1 }).text()).not.toContain('shown at');
  });
});
