/**
 * T-439: the tutorial (`ui-screens/menus-and-world.md` § Tutorial; its steps are
 * `03-content/ui-keymap-and-screens.md` § Tutorial). The content table, one test per step check,
 * the site rule, the box and its keys, and the app: the main menu entry, the first New world's
 * offer and a tutorial fortress that ticks as any other.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '@app/game';
import { SettingsStore } from '@app/settings-store';
import { WORLD_SIZE_STANDARD } from '@core/constants';
import { MemoryStorage } from '@platform/storage';
import { localMapSpec, siteSummary } from '@systems/embark';
import { generate } from '@systems/worldgen';
import { TUTORIAL_BOX_COLS, TUTORIAL_WORLD_SEED } from '@ui/constants';
import { FORTRESS_PANEL_KEYS, Keymap, type KeySpec } from '@ui/keymap';
import { UI_PANELS } from '@ui/screens/fortress';
import {
  readTutorialFacts, Tutorial, TUTORIAL_CHECKS, TUTORIAL_FIELDS, tutorialCheck, tutorialRegion,
  type TutorialFacts, type TutorialMemo, type TutorialStep,
} from '@ui/tutorial';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { keymap, press, registry, strings, surface } from './ui-fixture';

const steps = registry.derived<readonly TutorialStep[]>('tutorial');

/** Facts with nothing done: the view at (10, 10, 30), paused, no designations, zones, orders or saves. */
function facts(over: Partial<{
  camX: number; camY: number; z: number; canPan: boolean; lookTile: number | null; lookDwarf: boolean;
  speed: 0 | 1 | 2 | 4; saves: number; dig: number; stairs: number; down: number; zones: Record<string, number>;
  workshops: number; orders: number; labors: string;
}> = {}): TutorialFacts {
  return {
    camX: over.camX ?? 10, camY: over.camY ?? 10, z: over.z ?? 30, canPan: over.canPan ?? true,
    lookTile: over.lookTile ?? null, lookDwarf: over.lookDwarf ?? false, speed: over.speed ?? 0, saves: over.saves ?? 0,
    digDesignations: () => over.dig ?? 0,
    stairDesignations: () => over.stairs ?? 0,
    downStairs: () => over.down ?? 0,
    zones: (type) => over.zones?.[type] ?? 0,
    workshops: () => over.workshops ?? 0,
    orders: () => over.orders ?? 0,
    labors: () => over.labors ?? 'a',
  };
}

/** Run a check over a sequence of facts, the first being the step's start; the result after each. */
function run(check: string, sequence: readonly TutorialFacts[]): boolean[] {
  const memo: TutorialMemo = {};
  return sequence.map((f) => tutorialCheck(check, f, memo));
}

function spec(k: string, mods: Partial<KeySpec> = {}): KeySpec {
  return { key: k, ctrl: false, shift: false, ...mods };
}

function bindingIndex(keys: Keymap, context: string, id: string): number {
  const index = keys.bindings.findIndex((b) => b.context === context && b.id === id);
  expect(index, `${context} ${id}`).toBeGreaterThanOrEqual(0);
  return index;
}

function game(options: { offer?: boolean; store?: SettingsStore } = {}): Game {
  return new Game({ canvas: new MockCanvas(), seed: 't439', registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1,
    width: 1280, height: 800, settingsStore: options.store ?? new SettingsStore(new MemoryStorage()), offerTutorial: options.offer === true,
    randomSeed: () => 't439-world' });
}

async function settle(g: Game): Promise<void> {
  for (let k = 0; k < 5; k += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  await g.settled();
}

describe('T-439 tutorial: the content table', () => {
  it('lists the eleven steps of the work file in order, each with a known check, a highlight and its string', () => {
    expect(steps.map((s) => s.id)).toEqual(['view', 'look', 'dig', 'stairs', 'stockpile', 'workshop', 'order', 'farm', 'labors', 'speed', 'save']);
    expect(steps.map((s) => s.check)).toEqual([...TUTORIAL_CHECKS]);
    const panels = new Set([...UI_PANELS.map((p) => p.id), ...FORTRESS_PANEL_KEYS.map((p) => p.id)]);
    for (const step of steps) {
      expect(TUTORIAL_FIELDS.includes(step.highlight) || panels.has(step.highlight), step.highlight).toBe(true);
      expect(strings.get(`tutorial.${step.id}`)).toBe(step.text);
    }
  });
});

describe('T-439 tutorial: the step checks', () => {
  it('view_moved: the camera moved and the level changed, each at some time in the step', () => {
    expect(run('view_moved', [facts(), facts({ camX: 11 }), facts({ camX: 10 }), facts({ z: 29 })])).toEqual([false, false, false, true]);
    expect(run('view_moved', [facts(), facts({ z: 31 }), facts({ camY: 3, z: 31 })])).toEqual([false, false, true]);
    // A map that fits the view whole cannot move: the level alone does it.
    expect(run('view_moved', [facts({ canPan: false }), facts({ canPan: false, z: 28 })])).toEqual([false, true]);
  });

  it('looked: the look panel on a tile with no dwarf, and on one with a dwarf', () => {
    expect(run('looked', [facts(), facts({ lookTile: 5 }), facts(), facts({ lookTile: 9, lookDwarf: true })])).toEqual([false, false, false, true]);
    expect(run('looked', [facts({ lookTile: 9, lookDwarf: true }), facts({ lookTile: 9, lookDwarf: true })])).toEqual([false, false]);
  });

  it('dig_designated: a tile designated for digging', () => {
    expect(run('dig_designated', [facts(), facts({ dig: 12 })])).toEqual([false, true]);
  });

  it('stairs_designated: a stairs designation, or more stairs down than at the start', () => {
    expect(run('stairs_designated', [facts({ down: 2 }), facts({ down: 2 }), facts({ down: 2, stairs: 1 })])).toEqual([false, false, true]);
    expect(run('stairs_designated', [facts({ down: 2 }), facts({ down: 3 })])).toEqual([false, true]);
  });

  it('stockpile_made: a stockpile zone exists', () => {
    expect(run('stockpile_made', [facts({ zones: { farm_plot: 1 } }), facts({ zones: { stockpile: 1 } })])).toEqual([false, true]);
  });

  it('workshop_placed: a workshop in any state', () => {
    expect(run('workshop_placed', [facts(), facts({ workshops: 1 })])).toEqual([false, true]);
  });

  it('order_queued: a work order exists', () => {
    expect(run('order_queued', [facts(), facts({ orders: 1 })])).toEqual([false, true]);
  });

  it('farm_plot_made: a farm plot zone exists', () => {
    expect(run('farm_plot_made', [facts({ zones: { stockpile: 2 } }), facts({ zones: { stockpile: 2, farm_plot: 1 } })])).toEqual([false, true]);
  });

  it('labors_changed: any labor differs from the start', () => {
    expect(run('labors_changed', [facts({ labors: 'x' }), facts({ labors: 'x' }), facts({ labors: 'y' })])).toEqual([false, false, true]);
  });

  it('paused_and_sped: run at 2× or 4× and paused from running, in either order', () => {
    expect(run('paused_and_sped', [facts(), facts({ speed: 1 }), facts({ speed: 2 }), facts({ speed: 0 })])).toEqual([false, false, false, true]);
    expect(run('paused_and_sped', [facts({ speed: 1 }), facts({ speed: 0 }), facts({ speed: 4 })])).toEqual([false, false, true]);
    // Paused at the start is not a pause; 1× is not a change of speed.
    expect(run('paused_and_sped', [facts(), facts(), facts({ speed: 1 }), facts()])).toEqual([false, false, false, false]);
  });

  it('saved: a manual save written since the start', () => {
    expect(run('saved', [facts({ saves: 3 }), facts({ saves: 3 }), facts({ saves: 4 })])).toEqual([false, false, true]);
  });

  it('a check the table does not know never holds', () => {
    expect(run('nothing', [facts(), facts({ dig: 3 })])).toEqual([false, false]);
  });
});

describe('T-439 tutorial: the site', () => {
  it('embarks on a region that has soil, trees and a river, at peril 0, by the rule and not by an id', () => {
    const world = generate(TUTORIAL_WORLD_SEED, WORLD_SIZE_STANDARD, registry);
    const id = tutorialRegion(world, registry);
    const region = world.regions[id];
    expect(region).toBeDefined();
    const site = siteSummary(localMapSpec(world, id, registry), registry);
    expect(site.lacks).toEqual([]);
    expect(site.water.river).not.toBeNull();
    expect(region?.peril).toBe(0);
    // Nothing ranks before it: no other region lacks nothing at peril 0 with a river and fewer traits in the forest.
    expect(region?.biome).toBe('temperate_forest');
    expect(region?.traits).toEqual([]);
  });
});

describe('T-439 tutorial: the box', () => {
  const map = { col: 0, row: 0, cols: 60, rows: 30 };
  const none = (): null => null;

  it('draws the step and its buttons over the top left corner of the map view, and goes on as each check holds', () => {
    const t = new Tutorial(steps, strings, new Keymap(keymap.bindings));
    const s = surface(80, 40);
    t.draw(s, map, none);
    const lines = s.lines();
    expect(lines[0]).toContain('Tutorial · step 1 of 11');
    expect(lines.join('\n')).toContain('Welcome to your hall.');
    expect(lines.join('\n')).toContain('[F1] skip step  [Shift+F1] end tutorial');
    expect(t.boxRect).toMatchObject({ col: 0, row: 0, cols: TUTORIAL_BOX_COLS });
    expect(Array.from(lines[0] ?? '')[0]).toBe('┌');

    expect(t.update(facts())).toBe(0);
    expect(t.update(facts({ camX: 12, z: 29 }))).toBe(1);
    expect(t.step?.id).toBe('look');
    // A step whose check already holds goes by at once: here dig to farm all hold, labors waits for its start.
    t.index = 2;
    expect(t.update(facts({ dig: 1, stairs: 1, zones: { stockpile: 1, farm_plot: 1 }, workshops: 1, orders: 1 }))).toBe(6);
    expect(t.step?.id).toBe('labors');
  });

  it('highlights a panel title while it is open, its strip entry otherwise, and the status fields', () => {
    const t = new Tutorial(steps, strings, new Keymap(keymap.bindings));
    const landmarks = new Map([['strip:designate', { col: 2, row: 38, cols: 9, rows: 1 }], ['z', { col: 50, row: 37, cols: 4, rows: 1 }]]);
    t.index = 2;
    expect(t.highlight((n) => landmarks.get(n) ?? null)).toEqual({ col: 2, row: 38, cols: 9, rows: 1 });
    landmarks.set('panel:designate', { col: 61, row: 0, cols: 19, rows: 1 });
    expect(t.highlight((n) => landmarks.get(n) ?? null)).toEqual({ col: 61, row: 0, cols: 19, rows: 1 });
    t.index = 0;
    const s = surface(80, 40);
    s.text(50, 37, 'z 31', s.theme.text);
    t.draw(s, map, (n) => landmarks.get(n) ?? null);
    // The highlight changes the colours, never the glyphs.
    expect(s.lines()[37]?.slice(50, 54)).toBe('z 31');
    expect(s.cells.get(50, 37).bg).toEqual(s.theme.key);
    expect(s.cells.get(50, 37).fg).toEqual(s.theme.black);
    t.index = 11;
    expect(t.highlight((n) => landmarks.get(n) ?? null)).toBeNull();
  });

  it('skips a step, ends, and closes after the last step; a press on a button does what its key does', () => {
    const t = new Tutorial(steps, strings, new Keymap(keymap.bindings));
    t.skip();
    expect(t.step?.id).toBe('look');
    const s = surface(80, 40);
    t.draw(s, map, none);
    const row = s.lines().findIndex((line) => line.includes('[F1] skip step'));
    const col = (s.lines()[row] ?? '').indexOf('[F1] skip step');
    expect(t.press(col + 1, row, 0)).toBe(true);
    expect(t.step?.id).toBe('dig');
    // Elsewhere on the box: kept from the map, does nothing.
    expect(t.press(1, 1, 0)).toBe(true);
    expect(t.step?.id).toBe('dig');
    // Off the box: not the tutorial's.
    expect(t.press(70, 30, 0)).toBe(false);
    t.index = steps.length - 1;
    t.skip();
    expect(t.done).toBe(true);
    const done = surface(80, 40);
    t.draw(done, map, none);
    expect(done.lines()[0]).toContain('Tutorial · done');
    expect(done.lines().join('\n')).toContain('That is the tutorial.');
    expect(done.lines().join('\n')).toContain('[F1] close');
    t.skip();
    expect(t.ended).toBe(true);
    const gone = surface(80, 40);
    t.draw(gone, map, none);
    expect(gone.lines().join('').trim()).toBe('');

    const ending = new Tutorial(steps, strings, new Keymap(keymap.bindings));
    const s2 = surface(80, 40);
    ending.draw(s2, map, none);
    const r2 = s2.lines().findIndex((line) => line.includes('[Shift+F1] end tutorial'));
    ending.press((s2.lines()[r2] ?? '').indexOf('[Shift+F1]') + 2, r2, 0);
    expect(ending.ended).toBe(true);
  });

  it('names every key as its binding has it now (T-424)', () => {
    const keys = new Keymap(keymap.bindings);
    expect(keys.rebind(bindingIndex(keys, 'fortress_panel', 'designate'), spec('q'))).toBeNull();
    expect(keys.rebind(bindingIndex(keys, 'map', 'z_down'), spec('F7'))).toBeNull();
    expect(keys.rebind(bindingIndex(keys, 'designate_panel', 'stairs_down'), spec('v'))).toBeNull();
    expect(keys.rebind(bindingIndex(keys, 'global', 'tutorial_skip'), spec('F3'))).toBeNull();
    const t = new Tutorial(steps, strings, keys);
    expect(t.text()).toContain('[F7]');
    expect(t.text()).not.toContain('[<]');
    t.index = 2;
    expect(t.text()).toContain('Open Designate with [q]');
    t.index = 3;
    expect(t.text()).toContain('[v] chooses down stairs');
    const s = surface(80, 40);
    t.draw(s, map, () => null);
    expect(s.lines().join('\n')).toContain('[F3] skip step');
  });

  it('reads the facts of a running fortress: designations, zones, the look and the labors', async () => {
    const g = game();
    await g.start({ seed: 't439-facts', embark: 'default' });
    const readers = g.host.readers;
    const view = { readers, registry, camX: 0, camY: 0, z: g.ui.z, viewCols: 10, viewRows: 10, lookTile: null, speed: 0 as const, saves: 0 };
    const before = readTutorialFacts(view);
    expect(before.canPan).toBe(true);
    expect(before.digDesignations()).toBe(0);
    expect(before.zones('stockpile')).toBe(0);
    expect(before.orders()).toBe(0);
    const dwarf = g.host.readers.of<{ list(): number[] }>('10').list()[0] as number;
    const tile = g.host.headless.movement.tileOf(dwarf);
    expect(readTutorialFacts({ ...view, lookTile: tile }).lookDwarf).toBe(true);
    expect(readers.entities.at(0)).toEqual([]);
    expect(readTutorialFacts({ ...view, lookTile: 0 }).lookDwarf).toBe(false);
    const labors = before.labors();
    expect(labors.length).toBeGreaterThan(0);
    g.host.submit({ type: 'SetLabor', dwarfId: dwarf, labor: 'mining', on: !g.host.readers.of<{ laborEnabled(d: number, l: string): boolean }>('11').laborEnabled(dwarf, 'mining') });
    expect(readTutorialFacts(view).labors()).not.toBe(labors);
  });
});

describe('T-439 tutorial: the app', () => {
  it('starts from the main menu on the tutorial site, paused, and F1 and Shift+F1 skip and end it', async () => {
    const g = game();
    await g.showMainMenu();
    expect(g.textRows().join('\n')).toContain('[t] Tutorial');
    g.handleKey(press('t'));
    await settle(g);
    for (let k = 0; k < 200 && g.screen !== 'fortress'; k += 1) await new Promise((resolve) => setTimeout(resolve, 10));
    expect(g.screen).toBe('fortress');
    expect(g.host.speed()).toBe(0);
    expect(g.tutorialState()).toEqual({ step: 'view', index: 0, total: 11 });
    g.render();
    expect(g.textRows().join('\n')).toContain('Tutorial · step 1 of 11');
    // The z field is highlighted: drawn on the key colour.
    const z = g.fortress.landmarks.get('z');
    expect(z).toBeDefined();
    expect(g.cellBuffer()?.get(z!.col, z!.row).bg).toEqual(g.theme.key);

    // Step 1 by the keys: pan, then a level down.
    g.handleKey(press('→'));
    g.handleKey(press('<'));
    expect(g.tutorialState()?.step).toBe('look');
    g.handleKey(press('F1'));
    expect(g.tutorialState()?.step).toBe('dig');
    g.handleKey(press('F1', { shift: true }));
    expect(g.tutorialState()).toBeNull();
    g.render();
    expect(g.textRows().join('\n')).not.toContain('Tutorial ·');
    // With no tutorial the keys do nothing.
    expect(g.handleKey(press('F1'))).toBe(false);
  });

  it('a tutorial fortress ticks as the same embark without one: the tutorial only reads', async () => {
    const g = game();
    await g.startTutorial();
    const world = generate(TUTORIAL_WORLD_SEED, WORLD_SIZE_STANDARD, registry);
    const plain = game();
    await plain.embarkRegion(world, tutorialRegion(world, registry));
    for (let k = 0; k < 4; k += 1) {
      g.host.step(50);
      g.render();
      plain.host.step(50);
    }
    expect(g.tutorialState()).not.toBeNull();
    expect(g.host.headless.hash()).toBe(plain.host.headless.hash());
  });

  it('offers the tutorial on the first New world only, and a reset keeps it offered', async () => {
    const store = new SettingsStore(new MemoryStorage());
    const g = game({ offer: true, store });
    await g.loadSettings();
    await g.showMainMenu();
    g.handleKey(press('n'));
    expect(g.screen).toBe('confirm');
    expect(g.textRows().join('\n')).toContain('Is this your first fortress?');
    // The default is No: world generation.
    g.handleKey(press('Enter'));
    expect(g.screen).toBe('world_gen');
    await settle(g);
    expect((await store.load())?.preferences.tutorialOffered).toBe(true);

    const again = game({ offer: true, store });
    await again.loadSettings();
    again.resetSettings();
    expect(again.userSettings.tutorialOffered).toBe(true);
    await again.showMainMenu();
    again.handleKey(press('n'));
    expect(again.screen).toBe('world_gen');

    // Without the offer (a test build), New world goes straight on.
    const quiet = game();
    await quiet.showMainMenu();
    quiet.handleKey(press('n'));
    expect(quiet.screen).toBe('world_gen');
  });
});
