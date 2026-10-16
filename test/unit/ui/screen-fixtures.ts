/**
 * The outside screens and modal dialogs drawn for fixed states, shared by the layout smoke golden
 * (`test/golden/render/m8-screens.test.ts`) and the assertions about what each screen says
 * (`t332-screens-content.test.ts`).
 */

import { WORLD_SIZE_SMALL } from '@core/constants';
import { WorldMapCompositor } from '@render/world-map';
import { generate, type WorldMap } from '@systems/worldgen';
import { MainMenuScreen, type MainMenuHost } from '@ui/screens/main_menu';
import { WorldGenScreen } from '@ui/screens/world_gen';
import { WorldMapScreen } from '@ui/screens/world_map';
import { EmbarkScreen } from '@ui/screens/embark';
import { LoadScreen, type LoadHost } from '@ui/screens/load';
import { SettingsScreen, type SettingsHost } from '@ui/screens/settings';
import { LegendScreen, type LegendRecord } from '@ui/screens/legend';
import { GameMenuScreen, type GameMenuHost } from '@ui/screens/game_menu';
import { ConfirmScreen } from '@ui/screens/confirm';
import { DEFAULT_USER_SETTINGS, type UserSettings } from '@ui/settings';
import { cellRows, keymap, palette, registry, strings, surface } from './ui-fixture';

export interface ScreenGolden {
  text: string[];
  cells: string[][];
}

export const SCREENS = [
  'main_menu',
  'world_gen',
  'world_map',
  'embark_dwarves',
  'embark_supplies',
  'embark_animals',
  'load',
  'settings',
  'settings_keybindings',
  'legend',
  'game_menu',
  'confirm',
] as const;

export type ScreenName = typeof SCREENS[number];

export function renderScreen(name: ScreenName): ScreenGolden {
  const compositor = new WorldMapCompositor(registry, palette);

  switch (name) {
    case 'main_menu': {
      const host: MainMenuHost = {
        newestSave: () => 'Emberhall · Year 2',
        newWorld: () => {},
        continueGame: () => {},
        available: () => true,
        open: () => {},
      };
      const s = surface(80, 25);
      const screen = new MainMenuScreen(host, keymap, strings);
      screen.draw(s);
      return { text: s.lines(), cells: cellRows(s) };
    }

    case 'world_gen': {
      const screen = new WorldGenScreen(
        {
          randomSeed: () => 'coldmere-4471',
          generate: (seed, size, onProgress) =>
            generate(seed, size, registry, { onProgress: (stage, pct) => onProgress(stage, pct) }),
          back: () => {},
          continueTo: () => {},
        },
        keymap,
        strings,
        compositor,
      );
      screen.seed.value = 'coldmere-4471';
      screen.generate();
      const s = surface(80, 25);
      screen.draw(s);
      return { text: s.lines(), cells: cellRows(s) };
    }

    case 'world_map': {
      const world: WorldMap = generate('ui-test', WORLD_SIZE_SMALL, registry);
      const screen = new WorldMapScreen(world, { embark: () => {}, back: () => {} }, keymap, strings, compositor, registry);
      const land = world.regions.find((r) => r.biome !== 'ocean' && r.biome !== 'glacier');
      if (land) screen.cursor = { x: land.id % world.size, y: Math.floor(land.id / world.size) };
      const s = surface(96, 32);
      screen.draw(s);
      return { text: s.lines(), cells: cellRows(s) };
    }

    case 'embark_dwarves':
    case 'embark_supplies':
    case 'embark_animals': {
      const screen = new EmbarkScreen(
        registry,
        'embark-ui',
        { name: 'Greenhollow', peril: 1, tempC: 12 },
        { embark: () => {}, back: () => {} },
        keymap,
        strings,
      );
      screen.applyPreset('balanced');
      if (name === 'embark_dwarves') screen.tab = 0;
      else if (name === 'embark_supplies') screen.tab = 1;
      else screen.tab = 2;
      const s = surface(100, 35);
      screen.draw(s);
      return { text: s.lines(), cells: cellRows(s) };
    }

    case 'load': {
      const loadHost: LoadHost = {
        saves: () => [
          { id: 'emberhall-y2', kind: 'manual', fortress: 'Emberhall', tick: 24000, population: 23, wealth: 18450 },
          { id: 'emberhall-auto-su', kind: 'auto', fortress: 'Emberhall', tick: 20000, population: 20, wealth: 15200 },
          { id: 'snapshot-1', kind: 'snapshot', fortress: 'Emberhall', tick: 10000, population: 14, wealth: 8900 },
          { id: 'coldvein-final', kind: 'final', fortress: 'Coldvein Hold', tick: 48000, population: 0, wealth: 52300 },
        ],
        load: () => {},
        remove: () => {},
        exportSave: () => {},
        importSave: () => {},
        back: () => {},
      };
      const screen = new LoadScreen(loadHost, keymap, strings);
      const s = surface(80, 25);
      screen.draw(s);
      return { text: s.lines(), cells: cellRows(s) };
    }

    case 'settings':
    case 'settings_keybindings': {
      const userSettings: UserSettings = { ...DEFAULT_USER_SETTINGS };
      const settingsHost: SettingsHost = {
        strings,
        keymap,
        settings: () => userSettings,
        change: (patch) => Object.assign(userSettings, patch),
        bindingsChanged: () => {},
        resetDefaults: () => {},
        back: () => {},
      };
      const screen = new SettingsScreen(settingsHost);
      if (name === 'settings_keybindings') screen.keybindings = true;
      const s = surface(80, 25);
      screen.draw(s);
      return { text: s.lines(), cells: cellRows(s) };
    }

    case 'legend': {
      const record: LegendRecord = {
        id: 'coldvein-hold',
        name: 'Coldvein Hold',
        seed: 'ashfell-99',
        region: 'Ashfell',
        biome: 'mountain',
        wealthRating: 3,
        perilRating: 3,
        foundedTick: 0,
        endedTick: 48000,
        yearsSurvived: 3,
        daysSurvived: 336,
        peakPopulation: 41,
        deepestLevel: 6,
        finalWealth: 52300,
        cause: 'Fell on Day 4 of Winter, Year 4.\nThe last dwarf, Solveig Deephand, died of her wounds.',
        milestones: [
          { id: 'hearth', date: 'Spring 1', text: 'The hearth was lit.' },
          { id: 'bar', date: 'Summer 1', text: 'The first bar was smelted.' },
          { id: 'cavern', date: 'Autumn 2', text: 'The first cavern was breached.' },
        ],
        killsOfNote: ['Orm Ashbrow slew 14 enemies.', 'Gnashvein the captain returned twice.'],
        lastWords: ['!! The Hollow opens its mouth.', '!  Brynja Coldhammer has bled to death.'],
      };
      const screen = new LegendScreen([record], { back: () => {} }, record.id);
      const s = surface(80, 25);
      screen.draw(s);
      return { text: s.lines(), cells: cellRows(s) };
    }

    case 'game_menu': {
      const gameMenuHost: GameMenuHost = {
        fortressName: () => 'Emberhall',
        resume: () => {},
        save: () => {},
        load: () => {},
        settings: () => {},
        retire: () => {},
        mainMenu: () => {},
        viewOnly: () => false,
      };
      const screen = new GameMenuScreen(gameMenuHost);
      const s = surface(80, 25);
      screen.draw(s);
      return { text: s.lines(), cells: cellRows(s) };
    }

    case 'confirm': {
      const screen = new ConfirmScreen(registry, strings, 'c_retire', { fortress: 'Emberhall' }, () => {});
      const s = surface(80, 25);
      screen.draw(s);
      return { text: s.lines(), cells: cellRows(s) };
    }
  }
}

