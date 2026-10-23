/**
 * T-424: every key the game reacts to is a binding of the keymap that Settings › Keybindings can
 * change, except the fixed keys (`ui-keymap-and-screens.md` § Keymap, § Fixed keys; 24 § Settings).
 */

import { describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import { SettingsStore } from '@app/settings-store';
import { MemoryStorage } from '@platform/storage';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { Keymap, LEGACY_BINDINGS, type Binding, type KeymapRow, type KeySpec } from '@ui/keymap';
import { LaborManagerScreen } from '@ui/screens/labor_manager';
import { TestWorld } from '../../scenarios/test-world';
import { helpKeyRows } from '@ui/panels/help';
import { HINT_KEY_CONTEXTS } from '@ui/panels/log';
import { SettingsScreen } from '@ui/screens/settings';
import { DEFAULT_USER_SETTINGS } from '@ui/settings';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { keymap, press, strings, surface } from './ui-fixture';

const registry = loadContent();

function fresh(): Keymap {
  return new Keymap(keymap.bindings);
}

function at(keys: Keymap, context: string, id: string): number {
  const index = keys.bindings.findIndex((b) => b.context === context && b.id === id);
  expect(index, `${context} ${id}`).toBeGreaterThanOrEqual(0);
  return index;
}

function key(k: string, mods: Partial<KeySpec> = {}): KeySpec {
  return { key: k, ctrl: false, shift: false, ...mods };
}

function keymapIndex(keys: Keymap, context: string, k: string): number {
  return keys.bindings.findIndex((b) => b.context === context && b.spec.key === k);
}

function game(storage = new MemoryStorage()): Game {
  return new Game({ canvas: new MockCanvas(), seed: 't424', registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800, settingsStore: new SettingsStore(storage) });
}

describe('T-424 the keymap covers every screen and panel', () => {
  it('has a context for every panel with keys of its own, and only Esc and the every-letter rows are fixed', () => {
    const contexts = new Set(keymap.bindings.map((b) => b.context));
    for (const context of ['selection', 'designate_panel', 'build_panel', 'zones_panel', 'zone_inspector', 'units_panel', 'labors_panel', 'jobs_panel',
      'orders_panel', 'workshop_panel', 'building_panel', 'stocks_panel', 'depot_panel', 'military_panel', 'animals_panel', 'civilizations_panel',
      'population_panel', 'mood_panel', 'log_panel', 'look_panel', 'help_panel', 'debug_panel', 'labor_manager', 'labor_templates', 'trade_session',
      'game_menu', 'confirm', 'main_menu', 'world_gen', 'world_map', 'embark', 'load']) expect(contexts.has(context as Binding['context']), context).toBe(true);
    const fixed = keymap.bindings.flatMap((b, index) => (keymap.fixed(index) ? [`${b.context}/${b.spec.key}`] : []));
    expect(fixed.sort()).toEqual(['global/Esc', 'labor_manager/Esc', 'labor_manager/letters', 'panel/any-letter', 'trade_session/Esc']);
  });

  it('no two bindings of one context share a key', () => {
    for (const context of new Set(keymap.bindings.map((b) => b.context))) expect(keymap.conflicts(context), context).toEqual([]);
  });
});

describe('T-424 conflicts', () => {
  it('refuses a key that another binding of the same context has, and names it', () => {
    const keys = fresh();
    const idle = at(keys, 'units_panel', 'idle_filter');
    expect(keys.rebind(idle, key('W', { shift: true }))?.id).toBe('wounded_first');
    expect(keys.rebind(at(keys, 'map', 'look'), key('x'))?.id).toBe('cycle_material');
    expect(keys.rebind(at(keys, 'zones_panel', 'stockpile'), key('f'))?.id).toBe('farm_plot');
    expect(keys.overrides()).toEqual([]);
  });

  it('refuses a key that a binding acting at the same time has: the global keys, the panel letters, the list keys', () => {
    const keys = fresh();
    const idle = at(keys, 'units_panel', 'idle_filter');
    expect(keys.rebind(idle, key('F5'))?.id).toBe('quick_save');
    expect(keys.rebind(idle, key('/'))?.id).toBe('filter_focus');
    // A panel's own key that is not an accelerator cannot take a panel letter bare.
    expect(keys.rebind(keys.bindings.findIndex((b) => b.context === 'units_panel' && b.spec.key === '['), key('d'))?.id).toBe('designate');
    expect(keys.rebind(at(keys, 'global', 'pause'), key('v'))?.context).not.toBe('global');
    expect(keys.overrides()).toEqual([]);
  });

  it('refuses a map key that a panel uses and a panel key that the map uses; lets an accelerator take a panel letter (it then takes Shift)', () => {
    const keys = fresh();
    expect(keys.rebind(at(keys, 'jobs_panel', 'cancel_job'), key('k'))?.id).toBe('look');
    expect(keys.rebind(at(keys, 'jobs_panel', 'cancel_job'), key('<'))?.id).toBe('z_down');
    expect(keys.rebind(at(keys, 'map', 'look'), key('q'))?.context).toBe('zone_inspector');
    expect(keys.rebind(at(keys, 'map', 'look'), key('/'))?.id).toBe('filter_focus');
    expect(keys.rebind(at(keys, 'map', 'look'), key(';'))).toBeNull();
    expect(keys.rebind(at(keys, 'jobs_panel', 'cancel_job'), key('z'))).toBeNull();
    expect(keys.bindings[at(keys, 'jobs_panel', 'cancel_job')]?.spec).toEqual({ key: 'z', ctrl: false, shift: false, accel: true });
    expect(keys.resolve('jobs_panel', press('Z', { shift: true }))?.id).toBe('cancel_job');
    expect(keys.resolve('jobs_panel', press('z'))).toBeNull();
    // A map selection's keys act beside every panel's.
    expect(keys.rebind(at(keys, 'jobs_panel', 'job_priority'), key('d'))?.id).toBe('dump');
  });

  it('refuses a browser shortcut that the page cannot keep', () => {
    const keys = fresh();
    const pause = at(keys, 'global', 'pause');
    for (const shortcut of [key('W', { ctrl: true }), key('T', { ctrl: true, shift: true }), key('Tab', { ctrl: true }), key('n', { ctrl: true })]) {
      expect(keys.rebind(pause, shortcut)?.id).toBe('pause');
    }
    expect(keys.overrides()).toEqual([]);
    expect(keys.rebind(pause, key('P', { ctrl: true }))).toBeNull();
  });

  it('gives a binding its default back whatever acts beside it, and refuses a fixed key', () => {
    const keys = fresh();
    const pause = at(keys, 'global', 'pause');
    expect(keys.rebind(pause, key('F8'))).toBeNull();
    expect(keys.resetOne(pause)).toBeNull();
    expect(keys.bindings[pause]?.spec.key).toBe('Space');
    const esc = at(keys, 'global', 'cancel');
    expect(keys.fixed(esc)).toBe(true);
    expect(keys.rebind(esc, key('F8'))?.id).toBe('cancel');
    expect(keys.bindings[esc]?.spec.key).toBe('Esc');
  });
});

describe('T-424 saved keymaps', () => {
  it('saves a rebinding by the binding\'s name, and loads it back', () => {
    const keys = fresh();
    expect(keys.rebind(at(keys, 'units_panel', 'idle_filter'), key('q'))).toBeNull();
    const saved = JSON.parse(JSON.stringify(keys.overrides())) as unknown[];
    expect(saved).toEqual([{ binding: 'units_panel/idle_filter', spec: { key: 'q', ctrl: false, shift: false, accel: true } }]);
    const loaded = fresh();
    loaded.loadOverrides(saved);
    expect(loaded.resolve('units_panel', press('q'))?.id).toBe('idle_filter');
  });

  it('loads a keymap saved by index before the names, by the frozen order of that version', () => {
    const keys = fresh();
    keys.loadOverrides([
      { index: LEGACY_BINDINGS.indexOf('global/Space'), spec: key('F8') },
      { index: LEGACY_BINDINGS.indexOf('map/k'), spec: key(';') },
      // Military and the zone inspector use `q`: the map's z-level up does not get it.
      { index: LEGACY_BINDINGS.indexOf('map/>'), spec: key('q') },
      { index: LEGACY_BINDINGS.indexOf('fortress_panel/p'), spec: key('h') },
      { index: LEGACY_BINDINGS.indexOf('military_panel/w'), spec: key('u') },
      { index: LEGACY_BINDINGS.indexOf('global/Shift+Y'), spec: key('F2') },
      { index: 0, spec: key('F7') },
      { index: 9999, spec: key('F6') },
      { index: 3, spec: { key: 7 } },
    ]);
    expect(keys.resolve('global', press('F8'))?.id).toBe('pause');
    expect(keys.resolve('map', press(';'))?.id).toBe('look');
    expect(keys.resolve('map', press('>'))?.id).toBe('z_up');
    expect(keys.panelLetters().has('h')).toBe(true);
    expect(keys.resolve('military_panel', press('U', { shift: true }))?.id).toBe('weapon');
    expect(keys.resolve('global', press('F2'))?.id).toBe('calendar');
    // `Esc` is fixed: an old rebinding of it is not loaded.
    expect(keys.resolve('global', press('Esc'))?.id).toBe('cancel');
    expect(keys.overrides().map((o) => o.binding).sort()).toEqual(['fortress_panel/population', 'global/calendar', 'global/pause', 'map/look', 'military_panel/weapon']);
  });

  it('loads the names one version saved under, context and default key', () => {
    const keys = fresh();
    keys.loadOverrides([{ binding: 'map/<', spec: key(';') }, { binding: 'units_panel/i', spec: key('h') }]);
    expect(keys.resolve('map', press(';'))?.id).toBe('z_down');
    expect(keys.resolve('units_panel', press('h'))?.id).toBe('idle_filter');
    expect(keys.overrides().map((o) => o.binding).sort()).toEqual(['map/z_down', 'units_panel/idle_filter']);
  });

  it('a save survives a change of the default key', () => {
    const keys = fresh();
    expect(keys.rebind(at(keys, 'map', 'z_down'), key(';'))).toBeNull();
    const saved = JSON.parse(JSON.stringify(keys.overrides())) as unknown[];
    expect(saved).toEqual([{ binding: 'map/z_down', spec: { key: ';', ctrl: false, shift: false } }]);
    // A later table gives z-level down `PageDown` for `<`: the save still finds its binding.
    const rows = registry.derived<readonly KeymapRow[]>('keymap').map((row) => (row.context === 'map' && row.key === '<' ? { ...row, key: 'PageDown' } : row));
    const later = Keymap.fromRows(rows);
    later.loadOverrides(saved);
    expect(later.resolve('map', press(';'))?.id).toBe('z_down');
    expect(later.resolve('map', press('PageDown'))).toBeNull();
    expect(later.resolve('map', press(','))?.id).toBe('z_down');
  });

  it('drops a saved rebinding that would share a key with a binding acting beside it, the later in table order', () => {
    const keys = fresh();
    keys.loadOverrides([
      { binding: 'map/look', spec: key(';') },
      { binding: 'units_panel/sleep_hour', spec: key(';') },
      { binding: 'map/home', spec: key('q') },
    ]);
    expect(keys.resolve('map', press(';'))?.id).toBe('look');
    expect(keys.resolve('units_panel', press('['))?.id).toBe('sleep_hour');
    expect(keys.resolve('map', press('Home'))?.id).toBe('home');
    expect(keys.overrides().map((o) => o.binding)).toEqual(['map/look']);
  });

  it('drops a saved rebinding that would share a key within its context, and keeps the rest', () => {
    const keys = fresh();
    keys.loadOverrides([
      { binding: 'map/k', spec: key('r') },
      { binding: 'global/Space', spec: key('F8') },
      { binding: 'no/such', spec: key('F9') },
    ]);
    expect(keys.resolve('map', press('r'))?.id).toBe('rotate');
    expect(keys.resolve('map', press('k'))?.id).toBe('look');
    expect(keys.resolve('global', press('F8'))?.id).toBe('pause');
  });

  it('a rebinding and a reset survive a reload of the app', async () => {
    const storage = new MemoryStorage();
    const first = game(storage);
    expect(first.keymap.rebind(at(first.keymap, 'map', 'z_down'), key(';'))).toBeNull();
    first.changeSettings({});
    await first.settled();
    const second = game(storage);
    await second.loadSettings();
    await second.start({ embark: 'default' });
    const z = second.ui.z;
    second.handleKey(press(';'));
    expect(second.ui.z).toBe(z - 1);
    second.resetSettings();
    await second.settled();
    const third = game(storage);
    await third.loadSettings();
    expect(third.keymap.overrides()).toEqual([]);
  });
});

describe('T-424 a rebound key acts, and its old key does not', () => {
  it('on the fortress screen: a panel key and a map key', async () => {
    const g = game();
    await g.start({ embark: 'default' });
    const keys = g.keymap;
    expect(keys.rebind(at(keys, 'units_panel', 'idle_filter'), key('q'))).toBeNull();
    expect(keys.rebind(at(keys, 'map', 'z_up'), key('F7'))).toBeNull();
    g.handleKey(press('u'));
    expect(g.ui.panel).toBe('units');
    g.handleKey(press('i'));
    expect(g.fortress.units.idleOnly).toBe(false);
    g.handleKey(press('q'));
    expect(g.fortress.units.idleOnly).toBe(true);
    const z = g.ui.z;
    g.handleKey(press('>'));
    expect(g.ui.z).toBe(z);
    g.handleKey(press('F7'));
    expect(g.ui.z).toBe(z + 1);
  });

  it('a moved default key reaches the other bindings that have it now', async () => {
    const g = game();
    await g.start({ embark: 'default' });
    const keys = g.keymap;
    // Space marks a row in Units; moved to F7 there, it pauses again.
    expect(keys.rebind(at(keys, 'units_panel', 'mark'), key('F7'))).toBeNull();
    g.handleKey(press('u'));
    g.host.setSpeed(1);
    g.handleKey(press(' '));
    expect(g.host.speed()).toBe(0);
    expect(g.fortress.units.marks.size).toBe(0);
    g.handleKey(press('F7'));
    expect(g.fortress.units.marks.size).toBe(1);
  });

  it('on a screen before the fortress, while a text field types every key as it is', () => {
    const g = new Game({ canvas: new MockCanvas(), seed: 't424-gen', registry, createCanvas: mockCanvasFactory(), width: 1280, height: 800, randomSeed: () => 'drawn' });
    expect(g.keymap.rebind(at(g.keymap, 'world_gen', 'randomize'), key('q'))).toBeNull();
    g.openWorldGen();
    for (let k = 0; k < 8; k += 1) g.handleKey(press('Backspace'));
    g.handleKey(press('r'));
    g.handleKey(press('q'));
    expect(g.textRows().join('\n')).toContain('rq');
    g.handleKey(press('Tab'));
    g.handleKey(press('r'));
    expect(g.textRows().join('\n')).toContain('rq');
    g.handleKey(press('q'));
    expect(g.textRows().join('\n')).not.toContain('rq');
  });

  it('the labor manager: a freed letter still jumps to a labor', () => {
    const keys = fresh();
    expect(keys.rebind(at(keys, 'labor_manager', 'templates'), key('q'))).toBeNull();
    const w = new TestWorld({ seed: 't424-labors', world: 'flat-test', embark: 'none' });
    w.spawnDwarf({ at: w.index(10, 10, FLAT_TEST_SURFACE_Z), name: 'Dwarf Stone', ageYears: 30 });
    const screen = new LaborManagerScreen({ readers: w.readers, registry, strings, submit: (c) => w.submit(c), back: () => {} });
    const send = (p: ReturnType<typeof press>): void => { const t = keys.translate(screen.translatedKeys(), p); if (t !== null) screen.key(t); };
    send(press('t'));
    expect(screen.cursorLabor()?.name.toLowerCase().startsWith('t')).toBe(true);
    const at0 = screen.cursorCol;
    send(press('t'));
    expect(screen.cursorCol).not.toBe(at0);
    expect(screen.cursorLabor()?.name.toLowerCase().startsWith('t')).toBe(true);
    send(press('q'));
    expect(screen.translatedKeys()).toEqual(['labor_templates', 'panel']);
  });

  it('a key with Shift reaches a letter binding: the world map cursor moves by eight', () => {
    const keys = fresh();
    expect(keys.rebind(keys.bindings.findIndex((b) => b.context === 'world_map' && b.spec.key === '↓'), key('j'))).toBeNull();
    expect(keys.resolve('world_map', press('J', { shift: true }))).toEqual({ id: 'cursor', arg: '↓', shift: true });
    expect(keys.resolve('world_map', press('j'))).toEqual({ id: 'cursor', arg: '↓', shift: false });
  });

  it('on a screen over the fortress: the confirmation dialog', async () => {
    const g = game();
    await g.start({ embark: 'default' });
    const keys = g.keymap;
    expect(keys.rebind(at(keys, 'confirm', 'yes'), key('j'))).toBeNull();
    const answers: boolean[] = [];
    g.confirm('c_quickload', {}, (yes) => answers.push(yes));
    g.handleKey(press('y'));
    expect(answers).toEqual([]);
    g.handleKey(press('j'));
    expect(answers).toEqual([true]);
  });
});

describe('T-424 the keybinding editor', () => {
  function editor(keys: Keymap): { screen: SettingsScreen; saved: () => number; text: () => string } {
    let saved = 0;
    const screen = new SettingsScreen({ keymap: keys, strings, settings: () => DEFAULT_USER_SETTINGS,
      change: () => {}, bindingsChanged: () => { saved += 1; }, resetDefaults: () => {}, back: () => {} });
    screen.key(press('↓'));
    for (let k = 0; k < 9; k += 1) screen.key(press('↓'));
    screen.key(press('Enter'));
    const text = (): string => { const s = surface(90, 42); screen.draw(s); return s.lines().join('\n'); };
    return { screen, saved: () => saved, text };
  }

  it('lists the bindings under their screen and panel headings, in the order of the keymap table', () => {
    const { screen } = editor(fresh());
    expect(screen.keybindings).toBe(true);
    const headings = screen.rows().flatMap((row) => ('heading' in row ? [row.heading] : []));
    expect(headings.slice(0, 6)).toEqual(['Global', 'Map', 'Fortress panels', 'Panels', 'Map selection', 'Designate panel']);
    expect(headings).toContain('Zone inspector');
    expect(headings.slice(-5)).toEqual(['Main menu', 'World generation', 'World map', 'Embark', 'Load']);
    expect(screen.rows().filter((row) => 'index' in row)).toHaveLength(keymap.bindings.length);
  });

  it('rebinds the row under the cursor, resets it, and resets every binding', () => {
    const keys = fresh();
    const { screen, saved, text } = editor(keys);
    const idle = at(keys, 'units_panel', 'idle_filter');
    screen.bindingList.selected = idle;
    screen.key(press('Enter'));
    expect(screen.capturing).toBe(true);
    // A modifier on its own waits for the key it goes with.
    screen.key(press('Shift', { shift: true }));
    expect(screen.capturing).toBe(true);
    // A letter given to an accelerator stays an accelerator, whatever Shift said.
    screen.key(press('Q', { shift: true }));
    expect(screen.capturing).toBe(false);
    expect(keys.bindings[idle]?.spec).toEqual({ key: 'q', ctrl: false, shift: false, accel: true });
    expect(saved()).toBe(1);
    expect(text()).toContain('[q]  (default [i])');
    screen.key(press('Delete'));
    expect(keys.bindings[idle]?.spec.key).toBe('i');
    expect(screen.conflict).toBe('show only idle dwarves / all: back to [i].');
    // A key that is not an accelerator keeps its Shift.
    const wounded = at(keys, 'units_panel', 'wounded_first');
    screen.bindingList.selected = wounded;
    screen.key(press('Enter'));
    screen.key(press('K', { shift: true }));
    expect(keys.bindings[wounded]?.spec).toEqual({ key: 'K', ctrl: false, shift: true });
    expect(text()).toContain('[S-k]  (default [S-w])');
    screen.key(press('Backspace'));
    expect(keys.bindings[wounded]?.spec.key).toBe('W');
    expect(saved()).toBe(4);
    expect(keys.rebind(at(keys, 'map', 'look'), key(';'))).toBeNull();
    expect(keys.rebind(at(keys, 'global', 'pause'), key('F8'))).toBeNull();
    screen.key(press('d'));
    expect(keys.overrides()).toEqual([]);
    expect(screen.conflict).toBe('Every key is back to its default.');
    expect(saved()).toBe(5);
  });

  it('shows a refused key\'s binding in the bad colour, and says a fixed key cannot be rebound', () => {
    const keys = fresh();
    const { screen, text } = editor(keys);
    screen.bindingList.selected = at(keys, 'units_panel', 'idle_filter');
    screen.key(press('Enter'));
    screen.key(press('W', { shift: true }));
    expect(screen.conflict).toBe('Conflicts with Units panel: wounded dwarves first / list order');
    expect(screen.conflictWith?.id).toBe('wounded_first');
    expect(text()).toContain(screen.conflict);
    screen.key(press('Esc'));
    screen.bindingList.selected = at(keys, 'global', 'cancel');
    screen.key(press('Enter'));
    expect(screen.capturing).toBe(false);
    expect(screen.conflict).toBe('Esc is a fixed key and cannot be rebound.');
    expect(text()).toMatch(/cancel tool → close panel → game menu +Esc {2}fixed/);
    // A browser shortcut is refused by name.
    screen.bindingList.selected = at(keys, 'global', 'pause');
    screen.key(press('Enter'));
    screen.key(press('w', { ctrl: true }));
    expect(screen.conflict).toBe('Ctrl+W belongs to the browser, which acts on it first.');
    expect(screen.capturing).toBe(true);
    expect(keys.overrides()).toEqual([]);
  });
});

describe('T-424 a rebound key is named wherever a key is named', () => {
  it('captions, notes and hints name the key the binding has now; nothing changes with the defaults', () => {
    const keys = fresh();
    const hint = '☼ Click a door and choose Lock on alert. Then [m] and [3] raise the Hearth alert.';
    expect(keys.relabel(hint, HINT_KEY_CONTEXTS)).toBe(hint);
    expect(keys.rebind(at(keys, 'fortress_panel', 'military'), key('y'))).toBeNull();
    expect(keys.rebind(keys.bindings.findIndex((b) => b.context === 'military_panel' && b.spec.key === '3'), key('F3'))).toBeNull();
    expect(keys.relabel(hint, HINT_KEY_CONTEXTS)).toBe('☼ Click a door and choose Lock on alert. Then [y] and [F3] raise the Hearth alert.');
    expect(keys.relabel('[b > Workshops]', ['fortress_panel'])).toBe('[b > Workshops]');
    expect(keys.relabel('[+] new squad  [x] disband', ['military_panel'])).toBe('[+] new squad  [x] disband');
    expect(keys.rebind(at(keys, 'military_panel', 'disband'), key('i'))).toBeNull();
    expect(keys.relabel('[+] new squad  [x] disband', ['military_panel'])).toBe('[+] new squad  [i] disband');
    expect(keys.rebind(at(keys, 'orders_panel', 'new_order'), key('F6'))).toBeNull();
    expect(keys.relabel('No order is selected: [S-n] adds one.', ['orders_panel', 'panel'])).toBe('No order is selected: [F6] adds one.');
  });

  it('Help lists the key a binding has now, in its notes too', () => {
    const keys = fresh();
    expect(keys.rebind(at(keys, 'orders_panel', 'repeat'), key('F6'))).toBeNull();
    expect(keys.rebind(at(keys, 'panel', 'activate'), key('F4'))).toBeNull();
    const rows = helpKeyRows(keys, strings).map((r) => r.text);
    expect(rows).toContain('F6  repeat the selected order, or the last finished one');
    expect(rows).toContain('F6  repeat the selected or last finished order');
    expect(rows.some((r) => r.startsWith('↑↓ F4  choose a mode'))).toBe(true);
    expect(keys.rebind(at(keys, 'global', 'undo'), key('U', { ctrl: true }))).toBeNull();
    expect(keys.rebind(keys.bindings.findIndex((b) => b.context === 'panel' && b.spec.key === '↑'), key('F2'))).toBeNull();
    const again = helpKeyRows(keys, strings).map((r) => r.text);
    expect(again.some((r) => r.startsWith('Ctrl+U or click undo'))).toBe(true);
    expect(again.some((r) => r.startsWith('F2 ↓ F4  choose a mode'))).toBe(true);
  });

  it('the order picker is a text field: its captions keep the keys it reads', async () => {
    const g = game();
    await g.start({ embark: 'default' });
    expect(g.keymap.rebind(keymapIndex(g.keymap, 'panel', 'Enter'), key('F4'))).toBeNull();
    expect(g.keymap.rebind(keymapIndex(g.keymap, 'panel', 'Tab'), key('F3'))).toBeNull();
    g.handleKey(press('o'));
    g.handleKey(press('N', { shift: true }));
    expect(g.fortress.orders.picker.open).toBe(true);
    g.render();
    const text = g.textRows().join('\n');
    expect(text).toContain('[Enter] add');
    expect(text).toContain('[Tab] next');
    const help = helpKeyRows(g.keymap, strings).map((r) => r.text);
    expect(help).toContain(strings.get('ui.help.orders.picker'));
    expect(help).toContain(strings.get('ui.help.jobs.filter'));
  });

  it('the fortress status row and the drawn strip name a rebound panel letter, and a click on it presses that key', async () => {
    const g = game();
    await g.start({ embark: 'default' });
    expect(g.keymap.rebind(at(g.keymap, 'fortress_panel', 'designate'), key('q'))).toBeNull();
    expect(g.fortress.statusRow2()).toContain('[q] dig');
    g.render();
    expect(g.textRows().join('\n')).toContain('[q] dig');
    const row = g.textRows().findIndex((r) => r.includes('[q] dig'));
    const col = (g.textRows()[row] as string).indexOf('[q] dig');
    const center = g.cellCenter(col + 1, row);
    g.pointerDown({ x: center.x, y: center.y, button: 0, shift: false, ctrl: false, alt: false, meta: false });
    expect(g.ui.panel).toBe('designate');
  });
});
