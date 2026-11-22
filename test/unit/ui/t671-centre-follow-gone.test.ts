/**
 * T-671: centre and follow the thing in Look, and say when it is gone (24 § Inspection). `c` centres
 * once; `f` follows, moving the view only as far as it must to keep the thing inside the middle half
 * of the map view and changing level with it; every way of moving the view ends it, zoom, pause,
 * speed and panel scroll do not. A view whose thing died, was used up or merged, hid or left the map
 * keeps its title, says so with the last place and ends follow.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import type { GameEvent } from '@core/events';
import { TileFlag } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { FortressScreen, followBox, type FortressHost } from '@ui/screens/fortress';
import type { CellPointer, CellWheel } from '@ui/screen';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const LAYOUT = computeLayout(80, 42, true);
const VIEW = LAYOUT.map;

interface Fixture {
  readonly w: TestWorld;
  readonly screen: FortressScreen;
  speed: number;
  zoom: number;
  readonly sent: Command[];
}

/** A screen over a world whose host moves the camera as the app does (`centerOn` centres, `pan` adds). */
function setup(seed: string): Fixture {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const ui = defaultUiState(z);
  const f = { w, speed: 1, zoom: 0, sent: [] } as unknown as Fixture;
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui,
    submit: (cmd) => { f.sent.push(cmd); w.submit(cmd); },
    speed: () => f.speed as 0 | 1 | 2 | 4,
    setSpeed: (s) => { f.speed = s; },
    pan: (dx, dy) => { ui.camX += dx; ui.camY += dy; },
    changeZ: (dz) => { ui.z += dz; },
    centerOn: (x, y, zz) => { ui.camX = x - Math.floor(VIEW.cols / 2); ui.camY = y - Math.floor(VIEW.rows / 2); ui.z = zz; },
    home: () => { ui.camX = 0; ui.camY = 0; },
    zoom: (d) => { f.zoom += d; },
    layout: () => LAYOUT,
    precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 1000,
    confirm: (_id, _params, reply) => reply(true),
  };
  (f as { screen: FortressScreen }).screen = new FortressScreen(host, keymap, strings);
  return f;
}

function sidebar(f: Fixture): string[] {
  const s = surface(80, 42);
  f.screen.draw(s);
  const bar = LAYOUT.sidebar;
  if (bar === null) return [];
  return s.lines().map((line) => Array.from(line).slice(bar.col + 1).join('').trimEnd());
}

/** A click on the first place the sidebar writes `text`. */
function clickText(f: Fixture, text: string): void {
  const s = surface(80, 42);
  f.screen.draw(s);
  const left = LAYOUT.sidebar?.col ?? 0;
  const lines = s.lines();
  const row = lines.findIndex((line) => Array.from(line).slice(left).join('').includes(text));
  expect(row, `"${text}" in the sidebar`).toBeGreaterThanOrEqual(0);
  const col = left + Array.from(lines[row] as string).slice(left).join('').indexOf(text);
  const hit = s.hits.find((h) => h.rect.row <= row && row < h.rect.row + h.rect.rows && h.rect.col <= col && col < h.rect.col + h.rect.cols);
  expect(hit, `a button at "${text}"`).toBeDefined();
  hit?.action();
}

function move(f: Fixture, id: EntityId, x: number, y: number, zz = z): void {
  f.w.game.world.entities.add(id, C.Position, { x, y, z: zz });
}

/** Where the thing is on the map view, in cells from its corner. */
function onView(f: Fixture, x: number, y: number): { col: number; row: number } {
  return { col: x - f.screen.ui.camX, row: y - f.screen.ui.camY };
}

const pointer = (col: number, row: number, button = 0): CellPointer => ({ col, row, button, shift: false, ctrl: false, alt: false, meta: false });
const wheel = (col: number, row: number, dy: number, mods: Partial<CellWheel> = {}): CellWheel => ({ col, row, dy, shift: false, ctrl: false, alt: false, meta: false, ...mods });
const name = (f: Fixture, id: EntityId): string => f.w.readers.entities.get(id, C.Creature)?.name ?? '?';

describe('T-671 the follow box', () => {
  it('moves the camera only as far as it must to keep a cell inside the middle half, clamped to the map', () => {
    // A 40-cell view: the middle half is cells 10..29 of it.
    expect(followBox(30, 20, 40, 200)).toBe(20);
    expect(followBox(49, 20, 40, 200)).toBe(20);
    expect(followBox(25, 20, 40, 200)).toBe(15);
    expect(followBox(55, 20, 40, 200)).toBe(26);
    expect(followBox(2, 20, 40, 200)).toBe(0);
    expect(followBox(199, 150, 40, 200)).toBe(160);
  });

  it('follows a moving dwarf: still while it potters, dragged a tile at a time when it leaves the box, and down a level with it', () => {
    const f = setup('t671-follow');
    const dwarf = f.w.spawnDwarf({ at: f.w.index(60, 60, z) });
    f.screen.inspectCreature(dwarf);
    // `c` centres once; `f` turns follow on and centres.
    f.screen.ui.camX = 0;
    f.screen.ui.camY = 0;
    expect(f.screen.key(press('c'))).toBe(true);
    expect(onView(f, 60, 60)).toEqual({ col: Math.floor(VIEW.cols / 2), row: Math.floor(VIEW.rows / 2) });
    expect(f.screen.lookFollow).toBe(false);
    f.screen.ui.camX = 0;
    expect(f.screen.key(press('f'))).toBe(true);
    expect(f.screen.lookFollow).toBe(true);
    expect(onView(f, 60, 60).col).toBe(Math.floor(VIEW.cols / 2));
    let rows = sidebar(f);
    expect(rows.some((row) => row.includes('[f] follow ■ on'))).toBe(true);
    expect(f.screen.statusRow2()).toBe(`Following ${name(f, dwarf)} · move the view to stop`);

    // Pottering a few tiles: the map stays still.
    const cam = { x: f.screen.ui.camX, y: f.screen.ui.camY };
    move(f, dwarf, 63, 58);
    f.screen.followView();
    expect({ x: f.screen.ui.camX, y: f.screen.ui.camY }).toEqual(cam);

    // Off east past the box: the view moves just enough to keep it on the box's edge.
    const hi = VIEW.cols - 1 - Math.floor(VIEW.cols / 4);
    const x = cam.x + hi + 5;
    move(f, dwarf, x, 58);
    f.screen.followView();
    expect(f.screen.ui.camX).toBe(cam.x + 5);
    expect(onView(f, x, 58).col).toBe(hi);
    expect(f.screen.ui.cursor).toEqual({ x, y: 58 });

    // Down a level: the view goes with it.
    const below = f.w.index(x, 58, z - 1);
    f.w.game.world.services.terrain.setFlag(below, TileFlag.Discovered, true);
    move(f, dwarf, x, 58, z - 1);
    f.screen.followView();
    expect(f.screen.ui.z).toBe(z - 1);
    expect(f.screen.lookFollow).toBe(true);

    // `f` again turns it off; the foot says so.
    f.screen.key(press('f'));
    expect(f.screen.lookFollow).toBe(false);
    rows = sidebar(f);
    expect(rows.some((row) => row.includes('[f] follow off'))).toBe(true);
    // The foot's keys are buttons.
    clickText(f, '[f] follow');
    expect(f.screen.lookFollow).toBe(true);
    clickText(f, '[h] here');
    expect(f.screen.lookAt.kind).toBe('tile');
    expect(f.screen.lookFollow).toBe(false);
  });

  it('c and f are Look\'s only in a creature\'s or an item\'s view: in the tile list c opens Civilizations', () => {
    const f = setup('t671-tile-list');
    f.screen.look({ x: 20, y: 20, z });
    expect(f.screen.key(press('c'))).toBe(true);
    expect(f.screen.ui.panel).toBe('civilizations');
  });

  it('a map selection dragged over an item\'s view takes f for forbid, not follow', () => {
    const f = setup('t671-selection');
    const log = f.w.spawnItem('log', 'oak', f.w.index(20, 20, z));
    f.screen.inspectCreature(f.w.spawnDwarf({ at: f.w.index(30, 30, z) }));
    f.screen.openTarget({ kind: 'item', id: log });
    f.screen.selection = { a: { x: 20, y: 20, z }, b: { x: 21, y: 20, z } };
    f.screen.key(press('F', { shift: true }));
    expect(f.screen.lookFollow).toBe(false);
    expect(f.sent.some((cmd) => cmd.type === 'ForbidItem' || cmd.type.startsWith('Forbid'))).toBe(true);
  });

  it('a barrel\'s view groups what it holds by kind and material, each group a link to its first stack', () => {
    const f = setup('t671-holds');
    const barrel = f.w.spawnItem('barrel', 'oak', f.w.index(20, 20, z));
    const first = f.w.spawnItem('drink', 'ale', { containerId: barrel }, 6);
    for (let k = 0; k < 3; k += 1) f.w.spawnItem('drink', 'ale', { containerId: barrel }, 2);
    f.screen.inspectCreature(f.w.spawnDwarf({ at: f.w.index(30, 30, z) }));
    f.screen.openTarget({ kind: 'item', id: barrel });
    const holds = sidebar(f).filter((row) => row.includes('ale'));
    expect(holds).toEqual([expect.stringMatching(/^ Holds +12 ale$/)]);
    clickText(f, '12 ale');
    expect(f.screen.lookAt).toMatchObject({ kind: 'item', id: first });
  });

  it('an item is followed through its carrier', () => {
    const f = setup('t671-item');
    const log = f.w.spawnItem('log', 'oak', f.w.index(60, 60, z));
    const dwarf = f.w.spawnDwarf({ at: f.w.index(60, 60, z) });
    f.w.items.attachToCarrier(log, dwarf);
    f.screen.inspectCreature(dwarf);
    f.screen.openTarget({ kind: 'item', id: log });
    expect(f.screen.lookAt).toMatchObject({ kind: 'item', id: log });
    f.screen.key(press('f'));
    move(f, dwarf, 60, 60 + Math.floor(VIEW.rows / 2));
    f.screen.followView();
    expect(onView(f, 60, 60 + Math.floor(VIEW.rows / 2)).row).toBe(VIEW.rows - 1 - Math.floor(VIEW.rows / 4));
  });
});

describe('T-671 what ends follow', () => {
  const f = setup('t671-ends');
  const dwarf = f.w.spawnDwarf({ at: f.w.index(60, 60, z) });
  const other = f.w.spawnDwarf({ at: f.w.index(70, 60, z) });
  const mapCell = { col: VIEW.col + 5, row: VIEW.row + 5 };
  const follow = (): void => {
    f.screen.openPanel(null);
    f.screen.inspectCreature(dwarf);
    f.screen.key(press('f'));
    expect(f.screen.lookFollow).toBe(true);
  };
  const ends: [string, () => void][] = [
    ['an arrow', () => f.screen.key(press('←'))],
    ['Shift and an arrow', () => f.screen.key(press('→', { shift: true }))],
    ['a level key', () => f.screen.key(press('<'))],
    ['the other level key', () => f.screen.key(press('>'))],
    ['Home', () => f.screen.key(press('Home'))],
    ['a middle drag', () => { f.screen.pointerDown(pointer(mapCell.col, mapCell.row, 1)); f.screen.pointerMove(pointer(mapCell.col + 2, mapCell.row)); f.screen.pointerUp(pointer(mapCell.col + 2, mapCell.row, 1)); }],
    ['edge scrolling', () => { f.screen.settings.edgeScrolling = true; f.screen.pointerMove(pointer(VIEW.col, VIEW.row + 3)); f.screen.settings.edgeScrolling = false; }],
    ['the wheel over the map', () => f.screen.wheel(wheel(mapCell.col, mapCell.row, 1))],
    ['Shift and the wheel', () => f.screen.wheel(wheel(mapCell.col, mapCell.row, 1, { shift: true }))],
    ['a log line or a job', () => f.screen.focusOn(f.w.index(10, 10, z))],
    ['a danger line', () => f.screen.focusLine(f.w.index(12, 12, z))],
    ['Esc', () => { for (let k = 0; k < 3 && f.screen.ui.panel !== null; k += 1) f.screen.key(press('Esc')); }],
    ['k', () => f.screen.key(press('k'))],
    ['opening another panel', () => f.screen.openPanel('units')],
    ['opening another thing', () => f.screen.openTarget({ kind: 'creature', id: other })],
    ['hiding the sidebar', () => { f.screen.key(press('Tab')); f.screen.followView(); f.screen.key(press('Tab')); }],
  ];
  for (const [what, act] of ends) {
    it(`ends with ${what}`, () => {
      follow();
      act();
      expect(f.screen.lookFollow).toBe(false);
    });
  }

  const keeps: [string, () => void][] = [
    ['zoom', () => f.screen.wheel(wheel(mapCell.col, mapCell.row, -1, { ctrl: true }))],
    ['pause', () => f.screen.key(press('Space'))],
    ['speed', () => f.screen.key(press('+'))],
    ['PageDown', () => f.screen.key(press('PageDown'))],
    ['the wheel over the panel', () => f.screen.wheel(wheel((LAYOUT.sidebar?.col ?? 0) + 4, (LAYOUT.sidebar?.row ?? 0) + 6, 1))],
    ['a frame', () => f.screen.followView()],
  ];
  for (const [what, act] of keeps) {
    it(`stays on through ${what}`, () => {
      follow();
      act();
      expect(f.screen.lookFollow).toBe(true);
    });
  }
});

describe('T-671 when the thing is gone', () => {
  const deliver = (f: Fixture, events: GameEvent[]): void => f.screen.onEvents(events);

  it('a dwarf that died: the day, the cause from the death event, the last place and the body as a link; follow ends', () => {
    const f = setup('t671-died');
    const at = f.w.index(60, 60, z);
    const dwarf = f.w.spawnDwarf({ at });
    const who = name(f, dwarf);
    f.screen.inspectCreature(dwarf);
    f.screen.key(press('f'));
    sidebar(f);
    const corpse = f.w.spawnItem('corpse', 'skull_bone', at);
    f.w.game.world.entities.destroy(dwarf);
    deliver(f, [
      { type: 'CreatureDied', id: dwarf, cause: 'bled_out', killerId: 0, tile: at, name: who, faction: 'fortress' } as unknown as GameEvent,
      { type: 'CorpseCreated', id: corpse, itemId: corpse, creatureId: dwarf } as unknown as GameEvent,
    ]);
    f.screen.followView();
    expect(f.screen.lookFollow).toBe(false);
    const rows = sidebar(f);
    expect(rows[0]).toContain(who);
    expect(rows[1]).toMatch(/·/);
    expect(rows[2]).toMatch(/^ Died on Day \d+ of \w+, Year \d+\.$/);
    expect(rows.map((row) => row.trim()).join(' ')).toContain(`${who} has bled to death. Last at (60, 60, z${z})`);
    expect(rows).toContain(' The body lies there:');
    expect(rows.some((row) => row.includes('[c] center  [h] that tile'))).toBe(true);
    // `f` does not follow a gone thing; `c` centres on its last place.
    f.screen.key(press('f'));
    expect(f.screen.lookFollow).toBe(false);
    f.screen.ui.camX = 0;
    f.screen.key(press('c'));
    expect(onView(f, 60, 60).col).toBe(Math.floor(VIEW.cols / 2));
    // The body opens its view; Backspace returns.
    f.screen.key(press('Tab'));
    f.screen.key(press('Enter'));
    expect(f.screen.lookAt).toMatchObject({ kind: 'item', id: corpse });
    f.screen.key(press('Backspace'));
    expect(f.screen.lookAt).toMatchObject({ kind: 'creature', id: dwarf });
  });

  it('a creature that leaves the map without dying reads "Left the map."', () => {
    const f = setup('t671-left');
    const dwarf = f.w.spawnDwarf({ at: f.w.index(40, 40, z) });
    f.screen.inspectCreature(dwarf);
    sidebar(f);
    f.w.game.world.entities.destroy(dwarf);
    const rows = sidebar(f);
    expect(rows[2]).toBe(' Left the map.');
    expect(rows[3]).toBe(` Last at (40, 40, z${z})`);
  });

  it('a hostile that hides is out of sight, its live facts gone, and comes back when seen', () => {
    const f = setup('t671-hidden');
    const tile = f.w.index(40, 20, z);
    const raider = f.w.spawnCreature('gloam_warrior', tile, 'hostile:gloam');
    f.screen.inspectCreature(raider);
    f.screen.key(press('f'));
    sidebar(f);
    f.w.game.world.entities.add(raider, C.Hostile, { partyId: 0, role: 'thief', behaviorState: 'sneak', stealthed: true, spotted: false, breakingDoorId: 0, breakingSince: 0 });
    f.screen.followView();
    expect(f.screen.lookFollow).toBe(false);
    let rows = sidebar(f);
    expect(rows[2]).toBe(' Out of sight.');
    expect(rows[3]).toBe(` Last seen at (40, 20, z${z})`);
    expect(rows.map((row) => row.trim()).join(' ')).toContain('The view returns when a dwarf sees it again.');
    expect(rows.join('\n')).not.toContain('At (');
    f.w.game.world.entities.add(raider, C.Hostile, { partyId: 0, role: 'thief', behaviorState: 'sneak', stealthed: true, spotted: true, breakingDoorId: 0, breakingSince: 0 });
    rows = sidebar(f);
    expect(rows[2] ?? '').toMatch(/At \(40, 20/);
  });

  it('a stack used up says how, with its last carrier as a link', () => {
    const f = setup('t671-used');
    const at = f.w.index(30, 30, z);
    const dwarf = f.w.spawnDwarf({ at });
    const food = f.w.spawnItem('easy_meal', 'dimcap', at);
    f.w.items.attachToCarrier(food, dwarf);
    f.screen.inspectCreature(dwarf);
    f.screen.openTarget({ kind: 'item', id: food });
    f.screen.key(press('f'));
    sidebar(f);
    f.w.items.destroy(food, 'consumed');
    deliver(f, [{ type: 'ItemDestroyed', id: food, reason: 'consumed' } as unknown as GameEvent]);
    f.screen.followView();
    expect(f.screen.lookFollow).toBe(false);
    const rows = sidebar(f);
    expect(rows[2]).toBe(' Used up.');
    expect(rows[3]).toBe(` Last carried by ${name(f, dwarf)}`);
    expect(rows[4]).toBe(` Last at (30, 30, z${z})`);
    clickText(f, name(f, dwarf));
    expect(f.screen.lookAt).toMatchObject({ kind: 'creature', id: dwarf });
  });

  it('a stack merged into another: the view moves to that stack, follow kept', () => {
    const f = setup('t671-merged');
    const at: TileIndex = f.w.index(30, 30, z);
    const a = f.w.spawnItem('bolt', 'copper', at, 25);
    const b = f.w.items.split(a, 15);
    f.screen.look({ x: 30, y: 30, z });
    f.screen.openTarget({ kind: 'item', id: b });
    f.screen.key(press('f'));
    sidebar(f);
    expect(f.w.items.merge(a, b)).toBe(true);
    f.screen.followView();
    expect(f.screen.lookAt).toMatchObject({ kind: 'item', id: a });
    expect(f.screen.lookFollow).toBe(true);
  });
});
