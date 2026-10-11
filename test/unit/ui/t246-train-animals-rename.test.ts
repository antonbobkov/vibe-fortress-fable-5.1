import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { Game } from '@app/game';
import { SaveManager } from '@app/save-manager';
import { MemoryStorage } from '@platform/storage';
import type { Command } from '@core/commands';
import { C } from '@core/components';
import { helpKeyRows } from '@ui/panels/help';
import { trainKey } from '@systems/animals';
import type { JobsReader } from '@systems/jobs';
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

    it('opens training by a visible mouse button and chooses Hunting by mouse', () => {
      const w = new TestWorld({ seed: 't246-train-mouse', world: 'flat-test', embark: 'none' });
      const dog = w.spawnTame('dog', w.index(20, 20, z));
      const sent: Command[] = [];
      const screen = new FortressScreen(fortressHost(w, sent), keymap, strings);
      screen.openPanel('animals');
      const click = (s: ReturnType<typeof surface>, text: string) => {
        const row = s.lines().findIndex(line => line.includes(text));
        expect(row, text).toBeGreaterThanOrEqual(0);
        const col = s.lines()[row]!.indexOf(text);
        expect(s.hitAt(col, row), text).not.toBeNull();
        screen.pointerDown({ col, row, button: 0, shift: false, ctrl: false, alt: false, meta: false });
      };
      const first = surface(80, 42); screen.draw(first);
      click(first, '[S-t] train');
      expect(screen.animals.trainChoice).toEqual({ animalId: dog, selected: 0 });
      const choice = surface(80, 42); screen.draw(choice);
      click(choice, 'Hunting');
      expect(sent).toContainEqual({ type: 'TrainAnimal', animalId: dog, kind: 'hunting' });
    });

    it('shows training while an already trained animal waits for a different role', () => {
      const w = new TestWorld({ seed: 't246-retrain-column', world: 'flat-test', embark: 'none' });
      const dog = w.spawnTame('dog', w.index(20, 20, z), { trained: 'war' });
      w.build('kennel', w.index(24, 24, z));
      w.submit({ type: 'TrainAnimal', animalId: dog, kind: 'hunting' }); w.step(1);
      expect(w.readers.of<JobsReader>('11').byKey(trainKey(dog))).toBeDefined();
      const screen = new FortressScreen(fortressHost(w, []), keymap, strings);
      screen.openPanel('animals'); const s = surface(80, 42); screen.draw(s);
      expect(s.lines().join('\n')).toContain('training');
    });

    it('explains why training cannot open when no tame animal is selected', () => {
      const w = new TestWorld({ seed: 't246-empty-tame', world: 'flat-test', embark: 'none' });
      const screen = new FortressScreen(fortressHost(w, []), keymap, strings);
      screen.openPanel('animals'); screen.key(press('T', { shift: true }));
      expect(screen.currentNotice).toContain('animal');
      expect(screen.animals.trainChoice).toBeNull();
    });

    it('Help lists the training entry, choice/cancel keys and fortress rename', () => {
      const text = helpKeyRows(keymap, strings).map(row => row.text).join('\n');
      expect(text).toContain('[S-t]'); expect(text).toContain('War'); expect(text).toContain('Hunting');
      expect(text).toContain('Esc'); expect(text).toContain('rename the fortress');
    });

    it('the real game reports a missing kennel through the ordinary rejection path', async () => {
      const game = new Game({ canvas: new MockCanvas(), seed: 't246-no-kennel', registry,
        createCanvas: mockCanvasFactory(), width: 1280, height: 800, saves: new SaveManager(new MemoryStorage()) });
      await game.start({ embark: 'default' }); game.handleKey(press('n'));
      const rows = game.fortress.animals.rows(game.fortress.ctx);
      game.fortress.animals.list.selected = rows.findIndex(id =>
        registry.table('creatures').idOf(game.host.world.entities.get(id, C.Creature)!.species) === 'dog');
      expect(game.fortress.animals.list.selected).toBeGreaterThanOrEqual(0);
      game.handleKey(press('T', { shift: true })); game.handleKey(press('Enter'));
      expect(game.host.world.commandLog.all().at(-1)).toMatchObject({ command: { type: 'TrainAnimal' }, result: { ok: false, reason: 'no_kennel' } });
      expect(game.fortress.currentNotice).toContain('build a kennel to train animals');
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
      const row = s.lines().findIndex(line => line.includes('[n] Rename fortress'));
      const col = s.lines()[row]!.indexOf('[n]');
      menu.pointerDown({ col, row, button: 0, shift: false, ctrl: false, alt: false, meta: false });
      expect(calls).toEqual(['rename', 'rename']);
    });

    it('a too-long accepted text-input answer is rejected by the command with its length rule', async () => {
      const game = new Game({ canvas: new MockCanvas(), seed: 't246-long-rename', registry,
        createCanvas: mockCanvasFactory(), width: 1280, height: 800, saves: new SaveManager(new MemoryStorage()) });
      await game.start({ embark: 'default' }); const original = game.host.world.fortress.name;
      game.openGameMenu(); game.handleKey(press('n'));
      const dialog = game.topScreen as TextInputScreen;
      // Also cover a restored/IME field exceeding its ordinary typing cap.
      dialog.field.value = 'x'.repeat(33); game.handleKey(press('Enter'));
      expect(game.host.world.commandLog.all().at(-1)).toMatchObject({ command: { type: 'RenameFortress' }, result: { ok: false, reason: 'bad_name' } });
      expect(game.host.world.fortress.name).toBe(original);
      game.handleKey(press('Esc'));
      expect(game.fortress.currentNotice).toContain('1');
      expect(game.fortress.currentNotice).toContain('32');
    });

    it('an empty name stays in the text input with a reason and sends no command', async () => {
      const game = new Game({ canvas: new MockCanvas(), seed: 't246-empty-rename', registry,
        createCanvas: mockCanvasFactory(), width: 1280, height: 800, saves: new SaveManager(new MemoryStorage()) });
      await game.start({ embark: 'default' });
      game.openGameMenu(); game.handleKey(press('n'));
      const dialog = game.topScreen as TextInputScreen; dialog.field.value = ''; game.handleKey(press('Enter'));
      expect(game.topScreen).toBe(dialog); expect(dialog.message).toContain('1');
      expect(game.host.world.commandLog.all().some(entry => entry.command.type === 'RenameFortress')).toBe(false);
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
