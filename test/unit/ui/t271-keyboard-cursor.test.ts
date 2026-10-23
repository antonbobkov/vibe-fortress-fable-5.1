/**
 * T-271: the keyboard has a tile cursor for every tool, and Build chooses first and places second
 * (`24-ui-and-input.md` § Rules, `fortress-screen.md` § Build tool).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { Command } from '@core/commands';
import { computeLayout } from '@render/cellbuffer';
import { drawBuildPanel } from '@ui/panels/build';
import { CURSOR_SCROLL_MARGIN } from '@ui/constants';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { Keymap, type KeyOverride, type KeymapRow } from '@ui/keymap';
import { press, registry, strings, surface, keymap } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const LAYOUT = computeLayout(80, 42, true);

interface Fixture { readonly w: TestWorld; readonly screen: FortressScreen; readonly sent: Command[] }

function setup(seed: string): Fixture {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const sent: Command[] = [];
  const ui = defaultUiState(z);
  const map = w.readers.map;
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui,
    submit: (cmd) => { sent.push(cmd); w.submit(cmd); },
    speed: () => 0,
    setSpeed: () => {},
    // The camera stays inside the map, as the game's does.
    pan: (dx, dy) => {
      ui.camX = Math.max(0, Math.min(map.w - LAYOUT.map.cols, ui.camX + dx));
      ui.camY = Math.max(0, Math.min(map.h - LAYOUT.map.rows, ui.camY + dy));
    },
    changeZ: () => {},
    centerOn: () => {},
    home: () => {},
    zoom: () => {},
    layout: () => LAYOUT,
    precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 1000,
  };
  const screen = new FortressScreen(host, keymap, strings);
  ui.camX = 20;
  ui.camY = 20;
  return { w, screen, sent };
}

/** The keys as the platform names them: the arrows by their glyph, Escape as `Esc`. */
const KEY_NAMES: Readonly<Record<string, string>> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc' };

function keys(f: Fixture, ...names: string[]): void {
  for (const name of names) {
    const shift = name.startsWith('Shift+');
    const key = shift ? name.slice(6) : name;
    f.screen.key(press(KEY_NAMES[key] ?? key, { shift }));
  }
}

const cursorOf = (f: Fixture): { x: number; y: number } | null => f.screen.ui.cursor;
const mouse = (col: number, row: number) => ({ col, row, button: 0, shift: false, ctrl: false, alt: false, meta: false });

describe('T-271 the cursor reaches every tile with a panel open', () => {
  it('shows with a tool armed and moves by one tile, ten with Shift, scrolling the view to keep its margin', () => {
    const f = setup('t271-reach');
    keys(f, 'd');
    expect(cursorOf(f)).not.toBeNull();
    const start = { ...cursorOf(f)! };
    keys(f, 'ArrowRight');
    expect(cursorOf(f)).toEqual({ x: start.x + 1, y: start.y });
    keys(f, 'Shift+ArrowDown');
    expect(cursorOf(f)).toEqual({ x: start.x + 1, y: start.y + 10 });
    // To the west edge of the map: the cursor gets there, the view scrolls after it.
    for (let k = 0; k < 20; k += 1) keys(f, 'Shift+ArrowLeft');
    expect(cursorOf(f)!.x).toBe(0);
    expect(f.screen.ui.camX).toBe(0);
    for (let k = 0; k < 20; k += 1) keys(f, 'Shift+ArrowUp');
    expect(cursorOf(f)).toEqual({ x: 0, y: 0 });
    // Back east: the cursor stays CURSOR_SCROLL_MARGIN tiles inside the view while the view follows.
    for (let k = 0; k < 8; k += 1) keys(f, 'Shift+ArrowRight');
    const c = cursorOf(f)!;
    expect(c.x).toBe(80);
    expect(c.x - f.screen.ui.camX).toBeLessThanOrEqual(LAYOUT.map.cols - 1 - CURSOR_SCROLL_MARGIN);
    expect(c.x - f.screen.ui.camX).toBeGreaterThanOrEqual(CURSOR_SCROLL_MARGIN);
  });

  it('without a tool the arrows pan the view and no cursor is shown', () => {
    const f = setup('t271-pan');
    keys(f, 'ArrowRight');
    expect(f.screen.ui.camX).toBe(21);
    expect(cursorOf(f)).toBeNull();
  });

  it('follows the pointer while a tool is armed, and a key moves it from there', () => {
    const f = setup('t271-mouse');
    keys(f, 'd');
    f.screen.pointerMove(mouse(LAYOUT.map.col + 5, LAYOUT.map.row + 6));
    expect(cursorOf(f)).toEqual({ x: 25, y: 26 });
    keys(f, 'ArrowLeft');
    expect(cursorOf(f)).toEqual({ x: 24, y: 26 });
  });

  it('hides when the tool or the panel is closed, and `k` twice leaves none behind', () => {
    const f = setup('t271-hide');
    keys(f, 'd', 'Escape');
    expect(cursorOf(f)).toBeNull();
    keys(f, 'Escape');
    keys(f, 'k');
    expect(cursorOf(f)).not.toBeNull();
    keys(f, 'k');
    expect(cursorOf(f)).toBeNull();
  });
});

describe('T-271 a dig rectangle by keys alone', () => {
  it('Enter marks the first corner at the cursor and the second sends the designation', () => {
    const f = setup('t271-dig');
    keys(f, 'd');
    const a = { ...cursorOf(f)! };
    keys(f, 'Enter', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'Enter');
    const sent = f.sent.find((cmd) => cmd.type === 'Designate') as unknown as { tiles: number[] } | undefined;
    expect(sent).toBeDefined();
    const map = f.w.readers.map;
    expect(sent!.tiles).toEqual(expect.arrayContaining([map.index(a.x, a.y, z), map.index(a.x + 2, a.y + 1, z)]));
    expect(sent!.tiles).toHaveLength(6);
  });
});

describe('T-271 Build chooses first and places second', () => {
  it('a category opens its list with nothing armed; Enter picks, a second Enter places at the cursor', () => {
    const f = setup('t271-build');
    keys(f, 'b', 'w');
    expect(f.screen.build.listing).toBe(true);
    expect(f.screen.build.active).toBe(false);
    expect(f.screen.statusRow2()).toBe('↑↓ choose · Enter pick · Esc back');
    keys(f, 'Enter');
    expect(f.sent.filter((cmd) => cmd.type === 'PlaceBuilding')).toHaveLength(0);
    expect(f.screen.build.active).toBe(true);
    keys(f, 'Enter');
    const placed = f.sent.filter((cmd) => cmd.type === 'PlaceBuilding');
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({ type: 'PlaceBuilding', buildingType: 'bowyer' });
  });

  it('Up and Down never change an armed tool: they move the cursor', () => {
    const f = setup('t271-armed');
    keys(f, 'b', 'w', 'ArrowDown', 'Enter');
    const picked = f.screen.build.current(f.screen.ctx)?.id;
    expect(picked).toBe('butcher');
    const before = { ...cursorOf(f)! };
    keys(f, 'ArrowDown', 'ArrowUp', 'ArrowUp');
    expect(f.screen.build.current(f.screen.ctx)?.id).toBe(picked);
    expect(cursorOf(f)).toEqual({ x: before.x, y: before.y - 1 });
  });

  it('Backspace returns to the list with the tool dropped; Esc leaves the list, then closes the panel', () => {
    const f = setup('t271-back');
    keys(f, 'b', 'w', 'Enter', 'Backspace');
    expect(f.screen.build.active).toBe(false);
    expect(f.screen.build.listing).toBe(true);
    keys(f, 'Escape');
    expect(f.screen.build.listing).toBe(false);
    expect(f.screen.ui.panel).toBe('build');
    keys(f, 'Escape');
    expect(f.screen.ui.panel).toBeNull();
  });

  it('a click on the map with a list open and nothing picked places nothing', () => {
    const f = setup('t271-click');
    keys(f, 'b', 'w');
    f.screen.pointerDown(mouse(LAYOUT.map.col + 5, LAYOUT.map.row + 5));
    expect(f.sent.filter((cmd) => cmd.type === 'PlaceBuilding')).toHaveLength(0);
    expect(f.screen.ui.panel).toBe('build');
  });
});

describe('T-271 a zone and a kill order by keys', () => {
  it('selects a zone at the map edge by moving the cursor onto it and pressing Enter', () => {
    const f = setup('t271-zone');
    const tiles = [f.w.index(1, 1, z), f.w.index(2, 1, z), f.w.index(1, 2, z), f.w.index(2, 2, z)];
    const zone = f.w.zone('stockpile', tiles);
    f.w.step(2);
    keys(f, 'z');
    expect(cursorOf(f)).not.toBeNull();
    for (let k = 0; k < 20; k += 1) keys(f, 'Shift+ArrowLeft', 'Shift+ArrowUp');
    expect(cursorOf(f)).toEqual({ x: 0, y: 0 });
    keys(f, 'ArrowRight', 'ArrowDown', 'Enter');
    expect(f.screen.zones.selected).toBe(zone);
  });

  it('picks the creature for a kill order with Enter, and says so when there is none', () => {
    const f = setup('t271-kill');
    f.w.submit({ type: 'CreateSquad', name: 'The Hearthguard' });
    f.w.step(1);
    const wolf = f.w.spawnCreature('wolf', f.w.index(30, 30, z), 'wild');
    keys(f, 'm');
    f.screen.military.settingKill = true;
    keys(f, 'Enter');
    expect(f.screen.statusRow2()).toBe('No creature there.');
    expect(f.screen.military.settingKill).toBe(true);
    // Move onto the wolf.
    const cur = { ...cursorOf(f)! };
    for (let k = 0; k < Math.abs(30 - cur.x); k += 1) keys(f, cur.x < 30 ? 'ArrowRight' : 'ArrowLeft');
    for (let k = 0; k < Math.abs(30 - cur.y); k += 1) keys(f, cur.y < 30 ? 'ArrowDown' : 'ArrowUp');
    expect(cursorOf(f)).toEqual({ x: 30, y: 30 });
    keys(f, 'Enter');
    const order = f.sent.find((cmd) => cmd.type === 'SquadOrder');
    expect(order).toMatchObject({ type: 'SquadOrder', order: { kind: 'kill', targetId: wolf } });
    expect(f.screen.military.settingKill).toBe(false);
  });
});

describe('T-271 a pick that waits for the map ends with the military panel', () => {
  it('Shift+K, then another panel: the arrows pan and Enter sends nothing', () => {
    const f = setup('t271-pick-ends');
    f.w.submit({ type: 'CreateSquad', name: 'The Hearthguard' });
    f.w.step(1);
    f.w.spawnCreature('wolf', f.w.index(30, 30, z), 'wild');
    keys(f, 'm', 'Shift+K');
    expect(f.screen.military.settingKill).toBe(true);
    keys(f, 'b');
    expect(f.screen.military.settingKill).toBe(false);
    const cam = f.screen.ui.camX;
    keys(f, 'ArrowRight');
    expect(f.screen.ui.camX).toBe(cam + 1);
    keys(f, 'Enter');
    expect(f.sent.filter((cmd) => cmd.type === 'SquadOrder')).toHaveLength(0);
    // Closing the panel ends it too.
    keys(f, 'm', 'Shift+K', 'm');
    expect(f.screen.military.settingKill).toBe(false);
  });
});

describe('T-271 the build help rows follow the state', () => {
  it('say Enter picks while the list is open and nothing is picked, and the ghost rows once a building is', () => {
    const f = setup('t271-help');
    keys(f, 'b', 'w');
    expect(f.screen.build.active).toBe(false);
    const list = surface(36, 32);
    drawBuildPanel(list, { col: 0, row: 0, cols: 36, rows: 32 }, f.screen.build, f.screen.ctx);
    expect(list.lines().join(' ')).toContain('Enter picks the');
    expect(list.lines().join(' ')).not.toContain('Enter places');
    keys(f, 'Enter');
    const armed = surface(36, 32);
    drawBuildPanel(armed, { col: 0, row: 0, cols: 36, rows: 32 }, f.screen.build, f.screen.ctx);
    expect(armed.lines().join(' ')).toContain('Ghost at the cursor');
    expect(armed.lines().join(' ')).toContain('Enter');
  });
});

describe('T-271 a saved custom keymap holds binding names and keys, not the wording of a row', () => {
  it('a rebound pan key survives into a keymap built from the reworded rows', () => {
    const rows = registry.derived<readonly KeymapRow[]>('keymap');
    const first = Keymap.fromRows(rows);
    const index = (first as unknown as { current: { id: string; arg?: string }[] }).current.findIndex((b) => b.id === 'pan' && b.arg === '←');
    expect(index).toBeGreaterThanOrEqual(0);
    expect(first.rebind(index, { key: 'h', ctrl: false, shift: false })).toBeNull();
    const saved = JSON.parse(JSON.stringify(first.overrides())) as KeyOverride[];
    expect(JSON.stringify(saved)).not.toContain('pan by');
    expect(saved.every((o) => Object.keys(o).sort().join() === 'binding,spec')).toBe(true);
    const second = Keymap.fromRows(rows);
    second.loadOverrides(saved);
    expect(second.resolve('map', press('h'))).toMatchObject({ id: 'pan', arg: '←' });
  });
});
