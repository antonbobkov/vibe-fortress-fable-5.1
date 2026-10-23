/**
 * T-428: a caption that names a key is drawn with the key its binding has now, and its click
 * regions follow the drawn text: a rebound key whose name is longer or shorter than the default
 * moves the pieces after it, and each piece is clickable exactly where it is drawn.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { Command } from '@core/commands';
import { computeLayout } from '@render/cellbuffer';
import { Keymap, type KeySpec } from '@ui/keymap';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { captionButtons, keyCells } from '@ui/widgets/label';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap as defaultKeymap, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function key(k: string, mods: Partial<KeySpec> = {}): KeySpec {
  return { key: k, ctrl: false, shift: false, ...mods };
}

interface Fixture {
  readonly keys: Keymap;
  readonly w: TestWorld;
  readonly screen: FortressScreen;
  readonly sent: Command[];
  /** Rebind a binding of a panel context. */
  rebind(context: string, id: string, spec: KeySpec, defaultKey?: string): void;
  /** Draw the screen: the lines and the surface with its click regions. */
  draw(): { lines: string[]; s: ReturnType<typeof surface> };
}

function setup(seed: string): Fixture {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  w.spawnDwarf({ at: w.index(10, 10, z), name: 'Dwarf00 Stone', ageYears: 30 });
  w.spawnDwarf({ at: w.index(11, 10, z), name: 'Dwarf01 Stone', ageYears: 30 });
  const sent: Command[] = [];
  const layout = computeLayout(80, 42, true);
  const host: FortressHost = {
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
    layout: () => layout,
    precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 0,
    prompt: () => {},
    laborManager: () => {},
  };
  const keys = new Keymap(defaultKeymap.bindings);
  const screen = new FortressScreen(host, keys, strings);
  const rebind = (context: string, id: string, spec: KeySpec, defaultKey?: string): void => {
    const index = keys.bindings.findIndex((b) => b.context === context && b.id === id && (defaultKey === undefined || b.spec.key === defaultKey));
    expect(index, `${context} ${id}`).toBeGreaterThanOrEqual(0);
    expect(keys.rebind(index, spec)).toBeNull();
  };
  const draw = (): { lines: string[]; s: ReturnType<typeof surface> } => {
    const s = surface(80, 42);
    screen.draw(s);
    return { lines: s.lines(), s };
  };
  return { keys, w, screen, sent, rebind, draw };
}

/**
 * Every piece of a caption (`pieces`, as drawn) is clickable from its first cell to its last, and
 * the cell after it is not part of it.
 */
function expectPieces(f: Fixture, pieces: readonly string[]): void {
  const { lines, s } = f.draw();
  for (const piece of pieces) {
    const row = lines.findIndex((l) => l.includes(piece));
    expect(row, `not drawn: ${piece}`).toBeGreaterThanOrEqual(0);
    const at = (lines[row] as string).indexOf(piece);
    const first = s.hitAt(at, row);
    const last = s.hitAt(at + piece.length - 1, row);
    expect(first, `${piece}: first cell`).not.toBeNull();
    expect(last, `${piece}: last cell`).toBe(first);
    expect(first?.rect.col, `${piece}: starts where it is drawn`).toBe(at);
    expect(first?.rect.cols, `${piece}: ends where it is drawn`).toBe(piece.length);
    const past = s.hitAt(at + piece.length, row);
    expect(past === null || past !== first, `${piece}: one cell past`).toBe(true);
  }
}

describe('T-428 a caption\'s click regions follow the drawn text', () => {
  it('keyCells measures the keys as drawn, with the key each was written with', () => {
    const f = setup('t428-cells');
    f.rebind('military_panel', 'mode_train', key('F7'));
    const s = surface(80, 4);
    s.keyNames = (text) => f.keys.relabel(text, ['military_panel']);
    expect(keyCells(s, '[S-o] Off [S-t] Train [v] Active')).toEqual([
      { key: 'S-o', from: 0, cols: 5 },
      { key: 'S-t', from: 10, cols: 4 },
      { key: 'v', from: 21, cols: 3 },
    ]);
  });

  it('captionButtons makes each piece clickable over its drawn cells', () => {
    const s = surface(60, 2);
    s.keyNames = (text) => text.replace('[S-t]', '[Ctrl+Shift+T]');
    const ran: string[] = [];
    captionButtons(s, 2, 0, '[S-o] Off  [S-t] Train  [v] Active', [() => ran.push('off'), () => ran.push('train'), null]);
    // "[S-o] Off  [Ctrl+Shift+T] Train  [v] Active": the train piece is 20 cells from column 13.
    expect(s.lines()[0]).toContain('[Ctrl+Shift+T] Train');
    s.hitAt(2, 0)?.action();
    s.hitAt(13, 0)?.action();
    s.hitAt(13 + 19, 0)?.action();
    expect(ran).toEqual(['off', 'train', 'train']);
    expect(s.hitAt(13 + 20, 0)).toBeNull();
    expect(s.hitAt(13 + 22, 0)).toBeNull();
  });

  it('Military: the squad, mode, member, station, order and leader captions, with a longer and a shorter key', () => {
    const f = setup('t428-military');
    f.w.submit({ type: 'CreateSquad', name: 'The Hearthguard' });
    f.w.step(1);
    f.screen.openPanel('military');
    f.rebind('military_panel', 'new_squad', key('F7', { ctrl: true }));
    f.rebind('military_panel', 'mode_off', key('F7'));
    f.rebind('military_panel', 'add_members', key('F8'));
    f.rebind('military_panel', 'alert_hearth', key('F6'), '3');
    const drawn = f.draw().lines.join('\n');
    expect(drawn).toContain('[Ctrl+F7] new squad');
    expect(drawn).toContain('[F7] Off [S-t] Train');
    expectPieces(f, [
      '[1] Calm',
      '[2] Watch',
      '[F6] Hearth',
      '[Ctrl+F7] new squad',
      '[x] disband',
      '[S-l] pick',
      '[S-n] rename',
      '[F7] Off',
      '[S-t] Train',
      '[v] Active',
      '[F8] add',
      '[r] remove',
      '[S-s] set',
      '[S-k] kill',
      '[S-f] follow',
      '[q] cancel orders',
    ]);
  });

  it('Military: a click on the last cell of a caption after a rebound key runs it, and one cell past does not', () => {
    const f = setup('t428-military-click');
    f.w.submit({ type: 'CreateSquad', name: 'The Hearthguard' });
    f.w.step(1);
    f.screen.openPanel('military');
    f.rebind('military_panel', 'mode_off', key('F7'));
    const { lines } = f.draw();
    const row = lines.findIndex((l) => l.includes('[F7] Off [S-t] Train'));
    const at = (lines[row] as string).indexOf('[S-t] Train');
    const press = (col: number): void => f.screen.pointerDown({ col, row, button: 0, shift: false, ctrl: false, alt: false, meta: false });
    press(at + '[S-t] Train'.length);
    expect(f.sent).toEqual([]);
    press(at + '[S-t] Train'.length - 1);
    expect(f.sent.map((c) => c.type)).toEqual(['SetSquadMode']);
    f.sent.length = 0;
    press(at);
    expect(f.sent.map((c) => c.type)).toEqual(['SetSquadMode']);
  });

  it('Animals: the cap caption, and the Civilizations footer', () => {
    const f = setup('t428-animals');
    f.rebind('animals_panel', 'cap', key('F7', { ctrl: true }));
    f.screen.openPanel('animals');
    const animals = f.draw().lines.join('\n');
    expectPieces(f, [/\[[^\]]+\] cap/.exec(animals)?.[0] ?? 'missing']);
    f.rebind('civilizations_panel', 'depot', key('F8', { ctrl: true }));
    f.rebind('civilizations_panel', 'trade', key('F6'));
    f.screen.openPanel('civilizations');
    const civ = f.draw().lines.join('\n');
    expectPieces(f, [/\[[^\]]+\] depot/.exec(civ)?.[0] ?? 'missing', /\[[^\]]+\] trade now/.exec(civ)?.[0] ?? 'missing']);
  });

  it('Population: the cap buttons', () => {
    const f = setup('t428-population');
    f.rebind('population_panel', 'adjust', key('F7'), '-');
    f.screen.openPanel('population');
    const text = f.draw().lines.join('\n');
    const minus = /Cap (\[[^\]]+\]) \d+ \[\+\]/.exec(text);
    expect(minus?.[1]).toBe('[F7]');
    expectPieces(f, ['[F7]']);
  });
});
