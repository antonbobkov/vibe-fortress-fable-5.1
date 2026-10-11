import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { Game } from '@app/game';
import { SaveManager } from '@app/save-manager';
import { MemoryStorage } from '@platform/storage';
import type { Command } from '@core/commands';
import { computeLayout } from '@render/cellbuffer';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { GameMenuScreen, type GameMenuHost } from '@ui/screens/game_menu';
import { TextInputScreen } from '@ui/screens/text_input';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { keymap, press, registry, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function fortressHost(w: TestWorld, sent: Command[]): FortressHost {
  return {
    readers: w.readers,
    registry: w.game.registry,
    ui: defaultUiState(z),
    submit: (cmd) => { sent.push(cmd); w.submit(cmd); },
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
  };
}

describe('T-246 training an animal and renaming the fortress have a UI', () => {
  describe('AnimalsPanel train choice', () => {
    it('Shift+T on a trainable species opens the choice and Enter sends TrainAnimal for War or Hunting', () => {
      const w = new TestWorld({ seed: 't246-train-dog', world: 'flat-test', embark: 'none' });
      const dog = w.spawnTame('dog', w.index(20, 20, z));
      const sent: Command[] = [];
      const screen = new FortressScreen(fortressHost(w, sent), keymap, strings);

      screen.openPanel('animals');
      expect(screen.animals.selected(screen.ctx)).toBe(dog);

      // Shift+T opens train choice defaulting to War (0)
      expect(screen.key(press('T', { shift: true }))).toBe(true);
      expect(screen.animals.trainChoice).toEqual({ animalId: dog, selected: 0 });

      // Enter sends TrainAnimal war
      expect(screen.key(press('Enter'))).toBe(true);
      expect(sent).toContainEqual({ type: 'TrainAnimal', animalId: dog, kind: 'war' });
      expect(screen.animals.trainChoice).toBeNull();

      // Test choosing hunting
      expect(screen.key(press('T', { shift: true }))).toBe(true);
      expect(screen.animals.trainChoice).toEqual({ animalId: dog, selected: 0 });
      expect(screen.key(press('ArrowDown'))).toBe(true);
      expect(screen.animals.trainChoice?.selected).toBe(1);
      expect(screen.key(press('Enter'))).toBe(true);
      expect(sent).toContainEqual({ type: 'TrainAnimal', animalId: dog, kind: 'hunting' });

      // Test cancel with Backspace and Esc
      expect(screen.key(press('T', { shift: true }))).toBe(true);
      expect(screen.animals.trainChoice).not.toBeNull();
      expect(screen.key(press('Backspace'))).toBe(true);
      expect(screen.animals.trainChoice).toBeNull();

      expect(screen.key(press('T', { shift: true }))).toBe(true);
      expect(screen.animals.trainChoice).not.toBeNull();
      expect(screen.key(press('Esc'))).toBe(true);
      expect(screen.animals.trainChoice).toBeNull();
      // Panel is still open after Esc cancelled the train choice
      expect(screen.ui.panel).toBe('animals');
    });

    it('Shift+T on a non-trainable species shows status notice without opening choice', () => {
      const w = new TestWorld({ seed: 't246-train-cow', world: 'flat-test', embark: 'none' });
      const cow = w.spawnTame('cow', w.index(20, 20, z));
      const sent: Command[] = [];
      const screen = new FortressScreen(fortressHost(w, sent), keymap, strings);

      screen.openPanel('animals');
      expect(screen.animals.selected(screen.ctx)).toBe(cow);

      expect(screen.key(press('T', { shift: true }))).toBe(true);
      expect(screen.animals.trainChoice).toBeNull();
      expect(screen.currentNotice).toBe('that animal cannot be trained');
      expect(sent).toHaveLength(0);
    });

    it('Tr column displays war, hunting, training or empty', () => {
      const w = new TestWorld({ seed: 't246-tr-column', world: 'flat-test', embark: 'none' });
      w.spawnTame('dog', w.index(20, 20, z), { trained: 'war' });
      w.spawnTame('dog', w.index(21, 20, z), { trained: 'hunting' });
      w.spawnTame('cow', w.index(22, 20, z));
      const sent: Command[] = [];
      const screen = new FortressScreen(fortressHost(w, sent), keymap, strings);

      screen.openPanel('animals');
      const s = surface(80, 42);
      screen.draw(s);
      const text = s.lines().join('\n');
      expect(text).toContain('war');
      expect(text).toContain('hunting');
      expect(text).not.toContain('none');
    });

    it('rejection for no_kennel on TrainAnimal shows build a kennel string', () => {
      expect(strings.get('ui.reject.no_kennel.TrainAnimal')).toBe('build a kennel to train animals');
    });
  });

  describe('Rename fortress in game menu', () => {
    it('Game menu includes [n] Rename fortress and n invokes rename', () => {
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
      const items = menu.items();
      const renameItem = items.find((i) => i.id === 'rename');
      expect(renameItem).toBeDefined();
      expect(renameItem?.key).toBe('n');
      expect(renameItem?.label).toBe('Rename fortress');

      const s = surface(60, 24);
      menu.draw(s);
      expect(s.lines().join('\n')).toContain('[n] Rename fortress');

      expect(menu.key(press('n'))).toBe(true);
      expect(calls).toEqual(['rename']);
    });

    it('game menu rename opens text input and submitting renames the fortress', async () => {
      const saves = new SaveManager(new MemoryStorage());
      const game = new Game({
        canvas: new MockCanvas(),
        seed: 't246-rename-game',
        registry,
        createCanvas: mockCanvasFactory(),
        width: 1280,
        height: 800,
        saves,
      });
      await game.start({ embark: 'default' });
      expect(game.screen).toBe('fortress');

      game.openGameMenu();
      expect(game.screen).toBe('game_menu');

      // Press 'n' to open Rename fortress text input dialog
      game.handleKey(press('n'));
      expect(game.screen).toBe('text_input');
      const dialog = game.topScreen as TextInputScreen;
      expect(dialog.title).toContain(game.host.world.fortress.name);

      // Change name to Irondeep
      dialog.field.value = 'Irondeep';
      game.handleKey(press('Enter'));

      // Text input dialog is closed, returning to game menu
      expect(game.screen).toBe('game_menu');
      expect(game.host.world.fortress.name).toBe('Irondeep');
    });
  });
});
