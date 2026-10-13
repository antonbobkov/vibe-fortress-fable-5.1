import { describe, expect, it } from 'vitest';
import { Game } from '@app/game';
import { FLAT_TEST_SURFACE_Z as z } from '@app/headless';
import type { Command } from '@core/commands';
import { C } from '@core/components';
import { computeLayout } from '@render/cellbuffer';
import type { AnimalsReader } from '@systems/animals';
import { DesignateTool } from '@ui/panels/designate';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { keymap, press, registry, strings, surface } from './ui-fixture';

function fixture(cap = 12) {
  const w = new TestWorld({ seed: 't249-cap', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const dog = w.spawnTame('dog', w.index(20, 20, z));
  const species = w.game.world.entities.get(dog, C.Creature)!.species;
  w.submit({ type: 'SetBreedingCap', species, cap }); w.step(1);
  const sent: Command[] = [];
  const host: FortressHost = {
    readers: w.readers, registry, ui: defaultUiState(z), submit: cmd => { sent.push(cmd); },
    speed: () => 0, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => computeLayout(80, 42, true), precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 1000,
  };
  const screen = new FortressScreen(host, keymap, strings); screen.openPanel('animals');
  return { screen, sent, species, w };
}
function click(screen: FortressScreen, text: string) {
  const s = surface(80, 42); screen.draw(s);
  const row = s.lines().findIndex(l => l.includes(text)); expect(row, text).toBeGreaterThanOrEqual(0);
  const col = s.lines()[row]!.indexOf(text); expect(s.hitAt(col, row), text).not.toBeNull();
  screen.pointerDown({ col, row, button: 0, shift: false, ctrl: false, alt: false, meta: false });
}

describe('T-249 ten designation batches and an editable breeding cap', () => {
  it.each([2, 10, 11])('undoes the newest ten of %i batches, one per press', count => {
    const tool = new DesignateTool();
    for (let i = 0; i < count; i++) tool.remember([{ type: 'Designate', kind: 'dig', tiles: [i], priority: 5 }]);
    for (let i = count - 1; i >= Math.max(0, count - 10); i--) expect(tool.undo()).toEqual({ type: 'UndoDesignation', tiles: [i] });
    expect(tool.undo()).toBeNull();
  });
  it('clears unsaved undo history on load and on leaving the fortress', async () => {
    const game = new Game({ canvas: new MockCanvas(), registry, seed: 't249-history', createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'none' });
    const blob = await game.host.save({ kind: 'manual' });
    game.fortress.tool.remember([{ type: 'Designate', kind: 'dig', tiles: [1], priority: 5 }]);
    game.enterLoaded(await game.host.load(blob)); expect(game.fortress.tool.undo()).toBeNull();
    game.fortress.tool.remember([{ type: 'Designate', kind: 'dig', tiles: [2], priority: 5 }]);
    await game.showMainMenu(); expect(game.fortress.tool.undo()).toBeNull();
  });
  it('opens without submitting, steps by one or ten, and submits only on Enter', () => {
    const { screen, sent, species } = fixture(); screen.key(press('C', { shift: true })); expect(sent).toEqual([]);
    screen.key(press('-')); screen.key(press('-', { shift: true })); screen.key(press('+'));
    screen.key(press('Enter')); expect(sent).toEqual([{ type: 'SetBreedingCap', species, cap: 2 }]);
  });
  it('digits replace the opening value and Esc cancels without a command', () => {
    const { screen, sent, species } = fixture(); screen.key(press('C', { shift: true }));
    for (const key of ['4', '2', 'Enter']) screen.key(press(key));
    expect(sent).toEqual([{ type: 'SetBreedingCap', species, cap: 42 }]); sent.length = 0;
    screen.key(press('C', { shift: true })); screen.key(press('9')); screen.key(press('Esc'));
    expect(sent).toEqual([]); expect(screen.ui.panel).toBe('animals');
  });
  it.each([0, 100])('clamps at %i without wrapping', cap => {
    const { screen, sent, species } = fixture(cap); screen.key(press('C', { shift: true }));
    screen.key(press(cap === 0 ? '-' : '+', { shift: true })); screen.key(press('Enter'));
    expect(sent).toEqual([{ type: 'SetBreedingCap', species, cap }]);
  });
  it('clamps typed overflow and lets Backspace remove the last digit', () => {
    const { screen, sent, species } = fixture(); screen.key(press('C', { shift: true }));
    for (const key of ['9', '9', '9', 'Enter']) screen.key(press(key));
    expect(sent).toEqual([{ type: 'SetBreedingCap', species, cap: 100 }]); sent.length = 0;
    screen.key(press('C', { shift: true }));
    for (const key of ['4', '2', 'Backspace', 'Enter']) screen.key(press(key));
    expect(sent).toEqual([{ type: 'SetBreedingCap', species, cap: 4 }]);
  });
  it('offers cap, decrement, Set and Cancel mouse paths and retains the species while editing', () => {
    const { screen, sent, species, w } = fixture(); click(screen, '[S-c] cap'); expect(sent).toEqual([]);
    click(screen, '[-]');
    w.spawnTame('cow', w.index(21, 20, z)); screen.animals.list.selected = 1;
    click(screen, '[Enter] Set'); expect(sent).toEqual([{ type: 'SetBreedingCap', species, cap: 11 }]);
    expect(w.readers.of<AnimalsReader>('08').breedingCap(species)).toBe(12);
    click(screen, '[S-c] cap'); click(screen, '[Esc] cancel'); expect(sent).toHaveLength(1);
  });
  it('offers a mouse path for undoing successive batches', () => {
    const { screen, sent } = fixture(); screen.openPanel('designate');
    screen.tool.remember([{ type: 'Designate', kind: 'dig', tiles: [1], priority: 5 }]);
    screen.tool.remember([{ type: 'Designate', kind: 'dig', tiles: [2], priority: 5 }]);
    click(screen, '[Ctrl+Z]'); click(screen, '[Ctrl+Z]');
    expect(sent).toEqual([{ type: 'UndoDesignation', tiles: [2] }, { type: 'UndoDesignation', tiles: [1] }]);
  });
});
