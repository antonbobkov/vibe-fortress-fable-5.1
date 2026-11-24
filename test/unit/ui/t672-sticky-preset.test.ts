/**
 * T-672: the embark screen opens with the last embark's preset, after a reload too; and `Abandon
 * fortress` ends the fortress and goes back to the world map of the same world, on its site, where
 * the Legends' record shows as ruins.
 */

import { describe, expect, it, vi } from 'vitest';
import { Game } from '@app/game';
import { LegendStore } from '@app/legend';
import { SaveManager } from '@app/save-manager';
import { SettingsStore } from '@app/settings-store';
import { WORLD_SIZE_SMALL } from '@core/constants';
import { MemoryStorage } from '@platform/storage';
import { TESTING_PRESET_ID } from '@systems/embark/testing';
import { generate, type WorldMap } from '@systems/worldgen';
import { EmbarkScreen } from '@ui/screens/embark';
import { GameMenuScreen } from '@ui/screens/game_menu';
import { LegendScreen } from '@ui/screens/legend';
import { WorldMapScreen } from '@ui/screens/world_map';
import { readSettings } from '@ui/settings';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press, registry } from './ui-fixture';

const world: WorldMap = generate('t672-world', WORLD_SIZE_SMALL, registry);
const site = world.regions.find((r) => {
  const biome = registry.table<{ id: string; embarkable: boolean }>('biomes').byId(r.biome);
  return biome?.embarkable === true;
});

function game(storage = new MemoryStorage()): Game {
  return new Game({
    canvas: new MockCanvas(), seed: 't672', registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1,
    width: 1280, height: 800, settingsStore: new SettingsStore(storage), saves: new SaveManager(storage), legends: new LegendStore(storage),
  });
}

function embarkScreen(g: Game): EmbarkScreen {
  const top = g.topScreen;
  if (!(top instanceof EmbarkScreen)) throw new Error(`expected the embark screen, got ${g.screen}`);
  return top;
}

async function embark(g: Game): Promise<void> {
  embarkScreen(g).confirm();
  await vi.waitFor(() => expect(g.screen).toBe('fortress'), { timeout: 60_000 });
  await g.settled();
}

describe('T-672: the embark preset is remembered', () => {
  it('reads a stored preset and falls back to none', () => {
    expect(readSettings({ embarkPreset: 'farmstead' }).embarkPreset).toBe('farmstead');
    expect(readSettings({ embarkPreset: 3 }).embarkPreset).toBe('');
  });

  it('opens the next embark, after a reload, with the testing preset of the last one', async () => {
    expect(site).toBeDefined();
    const storage = new MemoryStorage();
    const first = game(storage);
    await first.loadSettings();
    first.openEmbark(world, site!.id);
    expect(embarkScreen(first).session.preset).toBe('balanced');
    embarkScreen(first).applyPreset(TESTING_PRESET_ID);
    await embark(first);
    expect(first.userSettings.embarkPreset).toBe(TESTING_PRESET_ID);

    const reloaded = game(storage);
    await reloaded.loadSettings();
    reloaded.openEmbark(world, site!.id);
    expect(embarkScreen(reloaded).testing).toBe(true);
    expect(embarkScreen(reloaded).session.preset).toBe(TESTING_PRESET_ID);
    // Reset to defaults keeps it: it is a remembered choice, not a preference.
    reloaded.resetSettings();
    expect(reloaded.userSettings.embarkPreset).toBe(TESTING_PRESET_ID);
  }, 120_000);

  it('opens with the default preset when the remembered one is unknown', async () => {
    const storage = new MemoryStorage();
    await new SettingsStore(storage).save({ ...readSettings({}), embarkPreset: 'gone' }, []);
    const g = game(storage);
    await g.loadSettings();
    g.openEmbark(world, site!.id);
    expect(embarkScreen(g).session.preset).toBe('balanced');
  });
});

describe('T-672: abandon the fortress for a new embark on the same world', () => {
  it('asks first, records the legend, and returns to the world map on the abandoned site', async () => {
    const g = game();
    await g.showMainMenu();
    g.openEmbark(world, site!.id);
    await embark(g);
    const name = g.host.world.fortress.name;
    g.host.step(5);

    g.openGameMenu();
    const menu = g.topScreen as GameMenuScreen;
    expect(menu.items().find((item) => item.id === 'abandon')?.enabled).toBe(true);
    g.handleKey(press('a'));
    expect(g.screen).toBe('confirm');
    g.handleKey(press('Enter'));
    expect(g.screen).toBe('game_menu');
    g.handleKey(press('a'));
    g.handleKey(press('y'));
    await vi.waitFor(() => expect(g.screen).toBe('world_map'));

    const map = g.topScreen as WorldMapScreen;
    expect(map.world.seed).toBe(world.seed);
    // The same world, with the abandoned fortress's ruin on its site (T-686).
    expect(map.world.regions).toBe(world.regions);
    expect(map.world.ruins?.map((ruin) => [ruin.fortress, ruin.regionId])).toEqual([[name, site!.id]]);
    expect(map.regionId).toBe(site!.id);
    expect(map.regionLines(60).join('\n')).toContain(`Ruins of ${name}: Abandoned in Year 1 by 7 dwarves.`);
    // A new embark on the same world: the site choice, then the embark screen.
    g.handleKey(press('Esc'));
    expect(g.screen).toBe('main_menu');
  }, 120_000);

  it('a fortress with no world map cannot be abandoned', async () => {
    const g = game();
    await g.start({ embark: 'default' });
    g.openGameMenu();
    expect((g.topScreen as GameMenuScreen).items().find((item) => item.id === 'abandon')?.enabled).toBe(false);
  });

  it('a retired fortress offers a new embark on its world from the legend', async () => {
    const g = game();
    g.openEmbark(world, site!.id);
    await embark(g);
    g.retireFortress();
    g.handleKey(press('y'));
    await vi.waitFor(() => expect(g.screen).toBe('legend'));
    expect(g.topScreen).toBeInstanceOf(LegendScreen);
    expect(g.textRows().join('\n')).toContain('[Enter] New embark on this world');
    g.handleKey(press('Enter'));
    await vi.waitFor(() => expect(g.screen).toBe('world_map'));
    expect((g.topScreen as WorldMapScreen).regionId).toBe(site!.id);
  }, 120_000);
});
