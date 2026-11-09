/**
 * T-M7-09: the Esc chain, the game menu, the main menu's `Continue`, and every confirmation of
 * `ui-keymap-and-screens.md` § Confirmations wired with its documented default.
 */

import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadContent } from '@content/loader';
import { C } from '@core/components';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { Game, listingOf } from '@app/game';
import { SaveManager, type SaveHeader } from '@app/save-manager';
import { MemoryStorage } from '@platform/storage';
import { computeLayout } from '@render/cellbuffer';
import { ConfirmScreen } from '@ui/screens/confirm';
import { LoadScreen } from '@ui/screens/load';
import { GameMenuScreen, type GameMenuHost } from '@ui/screens/game_menu';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { keymap, press, strings, surface } from './ui-fixture';

const registry = loadContent();
const z = FLAT_TEST_SURFACE_Z;
// The ui tests run under jsdom, where `import.meta.url` is not a file URL; vitest's cwd is the root.
const srcDir = resolve(process.cwd(), 'src');

interface ConfirmRow { readonly id: string; readonly text: string; readonly default: 'yes' | 'no' }

function everySourceFile(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...everySourceFile(`${dir}/${entry.name}`));
    else if (entry.name.endsWith('.ts')) out.push(`${dir}/${entry.name}`);
  }
  return out;
}

function hostOf(w: TestWorld, asked: { id: string; params: Record<string, unknown> }[], answer = true): FortressHost {
  const ui = defaultUiState(z);
  return {
    readers: w.readers,
    registry: w.game.registry,
    ui,
    submit: (cmd) => w.submit(cmd),
    speed: () => 1,
    setSpeed: () => {},
    pan: () => {},
    changeZ: () => {},
    centerOn: () => {},
    home: () => {},
    zoom: () => {},
    layout: () => computeLayout(80, 42, true),
    precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 1000,
    confirm: (id, params, reply) => {
      asked.push({ id, params: params as Record<string, unknown> });
      reply(answer);
    },
  };
}

function newGame(saves: SaveManager): Game {
  return new Game({
    canvas: new MockCanvas(),
    seed: 'm7-game-menu',
    registry,
    createCanvas: mockCanvasFactory(),
    width: 1280,
    height: 800,
    saves,
  });
}

describe('T-M7-09 game menu, main menu Continue, confirmations', () => {
  describe('The Esc chain', () => {
    it('unwinds rectangle, selection, tool, panel, then opens the game menu', () => {
      const w = new TestWorld({ seed: 'm7-esc-chain', world: 'flat-test', embark: 'none' });
      let menu = 0;
      const host = { ...hostOf(w, []), gameMenu: () => { menu += 1; } };
      const screen = new FortressScreen(host, keymap, strings);
      const esc = (): boolean => screen.key(press('Esc'));

      screen.openPanel('designate');
      screen.tool.choose('d');
      screen.tool.anchor = { x: 10, y: 10, z };
      // 1: the rectangle in progress.
      expect(esc()).toBe(true);
      expect(screen.tool.anchor).toBeNull();
      expect(screen.tool.active).toBe(true);
      // 2: the tool.
      expect(esc()).toBe(true);
      expect(screen.tool.active).toBe(false);
      expect(screen.ui.panel).toBe('designate');
      // 3: the panel.
      expect(esc()).toBe(true);
      expect(screen.ui.panel).toBeNull();
      expect(menu).toBe(0);
      // 4: the game menu.
      expect(esc()).toBe(true);
      expect(menu).toBe(1);

      // A selection is unwound before the panel, and never opens the menu.
      screen.openPanel('look');
      screen.selection = { a: { x: 4, y: 4, z }, b: { x: 6, y: 5, z } };
      expect(esc()).toBe(true);
      expect(screen.selection).toBeNull();
      expect(screen.ui.panel).toBe('look');
      expect(menu).toBe(1);
    });

    it('a modal editor inside a panel takes Esc before the panel does', () => {
      const w = new TestWorld({ seed: 'm7-esc-modal', world: 'flat-test', embark: 'none' });
      const screen = new FortressScreen(hostOf(w, []), keymap, strings);
      screen.openPanel('orders');
      // U-03 (D-U5): the modal editor is the order picker.
      screen.orders.openPicker(screen.ctx);
      expect(screen.orders.adding).toBe(true);
      expect(screen.key(press('Esc'))).toBe(true);
      expect(screen.orders.adding).toBe(false);
      expect(screen.ui.panel).toBe('orders');
      screen.openPanel('units');
      screen.units.editing = true;
      expect(screen.key(press('Esc'))).toBe(true);
      expect(screen.units.editing).toBe(false);
      expect(screen.ui.panel).toBe('units');
    });
  });

  describe('Confirmations', () => {
    it('every id of the content table is wired somewhere in src, with the documented default', () => {
      const table = registry.table<ConfirmRow>('confirmations');
      const sources = everySourceFile(srcDir).map((file) => readFileSync(file, 'utf8')).join('\n');
      // U-01 (D-U3): the two embark confirmations joined the table. U-03 (D-U2): and the eight
      // for the destructive single-key actions (melt, dump ×2, slaughter, suspend, take apart,
      // remove zone, remove order). U-05: and releasing a caged creature (c_release_cage). T-439:
      // and the tutorial offered on the first New world (c_tutorial). T-531: and loading, replacing
      // and deleting a saved loadout (c_load_loadout, c_overwrite_loadout, c_delete_loadout).
      expect(table.ids()).toHaveLength(27);
      for (const id of table.ids()) {
        expect(sources.includes(`'${id}'`), `${id} is never asked for in src/`).toBe(true);
        const row = table.byId(id) as ConfirmRow;
        const dialog = new ConfirmScreen(registry, strings, id, { n: 3, fortress: 'Emberhall', save: 'a', squad: 'b', season: 'spring', time: 'now' }, () => {});
        expect(dialog.defaultYes, id).toBe(row.default === 'yes');
      }
    });

    it('Enter answers the default, y and n answer directly, Esc answers no', () => {
      const answers: boolean[] = [];
      // U-01 (D-U9): c_remove_stockpile_items defaults to No like every confirmation.
      const stockpile = new ConfirmScreen(registry, strings, 'c_remove_stockpile_items', { n: 4 }, (yes) => answers.push(yes));
      expect(stockpile.defaultYes).toBe(false);
      expect(stockpile.text).toContain('4 items');
      stockpile.key(press('Enter'));
      const noByDefault = new ConfirmScreen(registry, strings, 'c_remove_zone_crops', { n: 7 }, (yes) => answers.push(yes));
      expect(noByDefault.defaultYes).toBe(false);
      expect(noByDefault.text).toContain('7 growing crops');
      noByDefault.key(press('Enter'));
      noByDefault.key(press('y'));
      noByDefault.key(press('n'));
      noByDefault.key(press('Esc'));
      expect(answers).toEqual([false, false, true, false, false]);
    });

    it('removing a farm plot with crops asks first, and removes it on yes', () => {
      const w = new TestWorld({ seed: 'm7-confirm-crops', world: 'flat-test', embark: 'none' });
      const tiles = [w.index(20, 20, z), w.index(21, 20, z)];
      const plot = w.zone('farm_plot', tiles);
      w.plantCrop(tiles[0] as number, 'dimcap');
      w.step(1);
      const asked: { id: string; params: Record<string, unknown> }[] = [];
      const screen = new FortressScreen(hostOf(w, asked), keymap, strings);
      screen.openPanel('zones');
      screen.zones.selected = plot;
      expect(screen.key(press('x'))).toBe(true);
      expect(asked).toEqual([{ id: 'c_remove_zone_crops', params: { n: 1 } }]);
      w.step(2);
      expect(w.readers.of<{ zone(id: number): unknown }>('14').zone(plot)).toBeUndefined();
    });

    it('removing a stockpile that holds items asks first', () => {
      const w = new TestWorld({ seed: 'm7-confirm-stock', world: 'flat-test', embark: 'none' });
      const tiles = [w.index(30, 30, z), w.index(31, 30, z)];
      const pile = w.zone('stockpile', tiles);
      w.spawnItem('log', 'pine', tiles[0] as number, 1);
      w.step(1);
      const asked: { id: string; params: Record<string, unknown> }[] = [];
      const screen = new FortressScreen(hostOf(w, asked, false), keymap, strings);
      screen.removeZone(pile);
      expect(asked).toEqual([{ id: 'c_remove_stockpile_items', params: { n: 1 } }]);
      // Answered no: the zone stays.
      w.step(2);
      expect(w.readers.of<{ zone(id: number): unknown }>('14').zone(pile)).toBeDefined();
    });

    // U-03 (D-U2): "every destructive single-key action asks": an empty zone asks too, with `c_remove_zone`.
    it('an empty zone asks with c_remove_zone, and is removed on yes', () => {
      const w = new TestWorld({ seed: 'm7-confirm-empty', world: 'flat-test', embark: 'none' });
      const pile = w.zone('stockpile', [w.index(34, 30, z)]);
      const asked: { id: string; params: Record<string, unknown> }[] = [];
      const screen = new FortressScreen(hostOf(w, asked), keymap, strings);
      screen.removeZone(pile);
      expect(asked).toEqual([{ id: 'c_remove_zone', params: { zone: 'Stockpile #1' } }]);
      w.step(2);
      expect(w.readers.of<{ zone(id: number): unknown }>('14').zone(pile)).toBeUndefined();
    });

    // U-03 (D-U2): without orders it asks too, with `c_deconstruct_building`.
    it('deconstructing a workshop with orders asks with its order count; without orders it asks by name', () => {
      const w = new TestWorld({ seed: 'm7-confirm-workshop', world: 'flat-test', embark: 'none' });
      const at = w.index(24, 24, z);
      const shop = w.build('carpenter', at, 'pine');
      w.step(1);
      const asked: { id: string; params: Record<string, unknown> }[] = [];
      const screen = new FortressScreen(hostOf(w, asked), keymap, strings);
      screen.deconstruct(shop);
      expect(asked).toEqual([{ id: 'c_deconstruct_building', params: { building: "Carpenter's workshop #1" } }]);

      const other = new TestWorld({ seed: 'm7-confirm-workshop-2', world: 'flat-test', embark: 'none' });
      const id = other.build('carpenter', other.index(24, 24, z), 'pine');
      other.step(1);
      const recipe = other.game.registry.derived<ReadonlyMap<string, { id: string }[]>>('recipesByWorkshop').get('carpenter')?.[0]?.id as string;
      expect(other.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: id,
        order: { recipeId: recipe, mode: 'once', threshold: 0, remaining: 1, priority: 5 } }).ok).toBe(true);
      other.step(1);
      expect(other.readers.entities.get(id, C.Workshop)?.orders.length).toBe(1);
      const asked2: { id: string; params: Record<string, unknown> }[] = [];
      const screen2 = new FortressScreen(hostOf(other, asked2), keymap, strings);
      screen2.workshopId = id;
      screen2.openPanel('workshop');
      expect(screen2.key(press('x'))).toBe(true);
      expect(asked2).toEqual([{ id: 'c_deconstruct_workshop', params: { n: 1 } }]);
    });
  });

  describe('The game menu', () => {
    it('draws the fortress name and the wireframe keys, and runs every entry', () => {
      const calls: string[] = [];
      const host: GameMenuHost = {
        fortressName: () => 'Emberhall',
        resume: () => calls.push('resume'),
        save: () => calls.push('save'),
        load: () => calls.push('load'),
        settings: () => calls.push('settings'),
        rename: () => calls.push('rename'),
        retire: () => calls.push('retire'),
        mainMenu: () => calls.push('main_menu'),
        viewOnly: () => false,
      };
      const menu = new GameMenuScreen(host);
      const s = surface(60, 24);
      menu.draw(s);
      const text = s.lines().join('\n');
      expect(text).toContain('Deepholm · Emberhall');
      for (const entry of ['[r] Resume', '[s] Save', '[l] Load', '[o] Settings', '[n] Rename fortress', '[x] Retire fortress', '[m] Main menu']) {
        expect(text).toContain(entry);
      }
      for (const key of ['r', 's', 'l', 'o', 'n', 'x', 'm']) expect(menu.key(press(key))).toBe(true);
      expect(calls).toEqual(['resume', 'save', 'load', 'settings', 'rename', 'retire', 'main_menu']);
      // Esc resumes; a view-only (final) save disables Save, Rename and Retire.
      expect(menu.key(press('Esc'))).toBe(true);
      const viewOnly = new GameMenuScreen({ ...host, viewOnly: () => true });
      expect(viewOnly.items().filter((i) => i.enabled === false).map((i) => i.id)).toEqual(['save', 'rename', 'retire']);
    });
  });

  describe('Main menu and the unsaved check', () => {
    it('Main menu asks only while there are unsaved ticks, naming the last save\'s date', async () => {
      const saves = new SaveManager(new MemoryStorage());
      const game = newGame(saves);
      await game.start({ embark: 'default' });
      expect(game.unsavedSince()).toBe(false);
      game.host.step(30);
      expect(game.unsavedSince()).toBe(true);

      game.openGameMenu();
      game.handleKey(press('m'));
      expect(game.screen).toBe('confirm');
      const dialog = game.topScreen as ConfirmScreen;
      expect(dialog.confirmId).toBe('c_main_menu');
      expect(dialog.text).toContain('Day 1 of Spring, Year 1');
      game.handleKey(press('n'));
      expect(game.screen).toBe('game_menu');

      game.handleKey(press('s'));
      await game.settled();
      expect(game.unsavedSince()).toBe(false);
      game.handleKey(press('m'));
      await vi.waitFor(() => expect(game.screen).toBe('main_menu'), { timeout: 2000 });
    }, 30_000);

    it('T-118: a command applied while paused counts as an unsaved change until the next save', async () => {
      const saves = new SaveManager(new MemoryStorage());
      const game = newGame(saves);
      await game.start({ embark: 'default' });
      expect(game.host.speed()).toBe(0);
      expect(game.unsavedSince()).toBe(false);

      // Paused: the command takes effect at once and the calendar does not advance.
      const map = game.host.readers.map;
      const tick = game.host.readers.calendar.tick;
      game.host.submit({ type: 'CreateZone', zoneType: 'farm_plot', tiles: [map.index(40, 30, game.ui.z)] });
      expect(game.host.readers.calendar.tick).toBe(tick);
      expect(game.unsavedSince()).toBe(true);

      game.openGameMenu();
      game.handleKey(press('m'));
      expect(game.screen).toBe('confirm');
      expect((game.topScreen as ConfirmScreen).confirmId).toBe('c_main_menu');
      game.handleKey(press('n'));
      expect(game.screen).toBe('game_menu');

      game.handleKey(press('s'));
      await game.settled();
      expect(game.unsavedSince()).toBe(false);
      game.handleKey(press('m'));
      await vi.waitFor(() => expect(game.screen).toBe('main_menu'), { timeout: 2000 });
    }, 30_000);

    it('Continue is hidden without a save and loads the newest of any kind with one', async () => {
      const saves = new SaveManager(new MemoryStorage());
      const empty = newGame(saves);
      await empty.showMainMenu();
      expect(empty.textRows().join('\n')).not.toContain('Continue');

      const game = newGame(saves);
      await game.start({ embark: 'default' });
      game.host.step(20);
      const hash = game.host.headless.hash();
      game.handleKey(press('F5'));
      await game.settled();
      const other = newGame(saves);
      await other.showMainMenu();
      expect(other.textRows().join('\n')).toContain('Continue');
      await other.continueNewest();
      expect(other.host.headless.hash()).toBe(hash);
      expect(other.screen).toBe('fortress');
    }, 30_000);

    it('loading a snapshot row asks c_load_snapshot; a manual row does not', async () => {
      const saves = new SaveManager(new MemoryStorage());
      const game = newGame(saves);
      await game.start({ embark: 'default' });
      game.host.step(10);
      game.handleKey(press('F5'));
      await game.settled();
      const manual = game.lastSaveId as string;
      // A real snapshot save, the kind `save-format.md` § Snapshots and ids names.
      await saves.write('snapshot-1-1', await game.host.save({ kind: 'snapshot', playTimeSeconds: 1 }));
      await game.openLoad();
      const load = game.topScreen as LoadScreen;
      const listed = load.ordered();
      expect(listed.map((row) => row.id)).toContain('snapshot-1-1');
      expect(listed.find((row) => row.id === 'snapshot-1-1')?.kind).toBe('snapshot');
      load.selected = 'snapshot-1-1';
      load.activate();
      expect(game.screen).toBe('confirm');
      expect((game.topScreen as ConfirmScreen).confirmId).toBe('c_load_snapshot');
      game.handleKey(press('n'));
      expect(game.screen).toBe('load');
      load.selected = manual;
      load.activate();
      expect(game.screen).not.toBe('confirm');
      await game.settled();
    }, 30_000);
  });

  it('listingOf reads a snapshot header as a snapshot row', () => {
    const head: SaveHeader = {
      formatVersion: 1, compressed: false, gameVersion: '0.2.0', seed: 's', fortress: 'Emberhall',
      calendar: { tick: 5000, year: 1, season: 1, day: 3 }, contentHash: registry.contentHash,
      population: 7, wealth: 100, playTimeSeconds: 1, kind: 'snapshot',
    };
    expect(listingOf('snapshot-1-1', head)).toMatchObject({ id: 'snapshot-1-1', kind: 'snapshot', tick: 5000 });
  });
});
